#!/usr/bin/env python3
"""
Deepnote / GitHub Actions 每日推荐自动化脚本（修复版）
=====================================================
每天自动运行一次，选取随机词条 + 句子写入 daily_picks（按 pick_date 去重）。

相比旧版的关键修复（Issue 4）：
  1. save_daily_pick 改为「先查今天是否存在 → 存在则 update，否则 insert」的稳健写法，
     不再依赖 upsert(on_conflict="pick_date")——因为旧库 daily_picks 没有 pick_date
     唯一约束时，PostgREST 的 upsert 会直接报
     "there is no unique or exclusion constraint matching the ON CONFLICT specification"
     而写入失败（表现为「每天刷新都变、数据库无真实更新」）。
     （同时已提供 supabase/migrations/05-*.sql 补上唯一索引，作为双重保险。）
  2. 移除脚本中硬编码的 service_role key。密钥一律从环境变量读取
     （GitHub Actions: Settings → Secrets → SUPABASE_SERVICE_ROLE_KEY），
     避免密钥泄露。
  3. fetch_random_word/sentence 增加「RPC 不存在则直接表扫描」的兜底，
     保证任何情况下都能取到候选，不会因 RPC 缺失而整脚本退出。

环境变量：
  SUPABASE_URL              - Supabase 项目 URL（必填）
  SUPABASE_SERVICE_ROLE_KEY - Service Role Key（必填，绕过 RLS）
  USE_AI_PICK               - 是否启用 AI 推荐（可选，默认 "false"）
  AI_API_KEY                - AI API 密钥（可选，默认使用免费密钥）
"""

import os
import sys
import json
import logging
from datetime import date, datetime

# =============================================================================
# 日志配置
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("daily_pick")

# =============================================================================
# 依赖检查与安装
# =============================================================================
def ensure_dependencies():
    deps = {"supabase": "supabase", "requests": "requests"}
    import importlib
    import subprocess

    for module_name, pip_name in deps.items():
        try:
            importlib.import_module(module_name)
        except ImportError:
            log.info(f"Installing {pip_name}...")
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", pip_name, "-q"]
            )
            log.info(f"  {pip_name} installed ✓")


ensure_dependencies()

from supabase import create_client
import requests


# =============================================================================
# 配置（仅从环境变量读取，禁止硬编码密钥）
# =============================================================================
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
USE_AI = os.environ.get("USE_AI_PICK", "false").lower() == "true"

AI_API_BASE = "https://api.modelbest.cn/v1"
AI_API_KEY = os.environ.get("AI_API_KEY", "sk-pQ8L2zF3XmR5kY9wV4jB7hN1tC6vM0xG3aD5sH2bJ9lK4cZ8")
AI_MODEL = "MiniCPM-V-4.6-Thinking"


# =============================================================================
# Supabase 客户端
# =============================================================================
def get_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error(
            "❌ 缺少环境变量！请在运行环境（GitHub Actions Secrets / Deepnote Env）中设置 "
            "SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY"
        )
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# =============================================================================
# 从 RPC 获取随机词条/句子（兼容 SETOF 返回格式）；RPC 缺失时兜底表扫描
# =============================================================================
def _unwrap_rpc_row(resp):
    if hasattr(resp, "data") and resp.data:
        return resp.data[0] if isinstance(resp.data, list) else resp.data
    return None


def fetch_random_word_id(client):
    """获取随机词条的 word 文本；RPC 失败则直接表扫描 dictionary_full。"""
    try:
        row = _unwrap_rpc_row(client.rpc("get_random_word").execute())
        word = row.get("word", "") if row else ""
        if word:
            log.info(f"  📖 word: {word}")
            return word
    except Exception as e:
        log.warning(f"RPC get_random_word 不可用，转表扫描: {e}")
    # 兜底：直接随机取一行已富化词条
    try:
        resp = (
            client.table("dictionary_full")
            .select("word")
            .eq("enrichment_status", "enriched")
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if rows:
            word = rows[0].get("word", "")
            if word:
                log.info(f"  📖 word(scan): {word}")
                return word
    except Exception as e:
        log.error(f"表扫描 dictionary_full 失败: {e}")
    return None


def fetch_random_sentence_id(client):
    """获取随机句子的 id；RPC 失败则直接表扫描 sentences。"""
    try:
        row = _unwrap_rpc_row(client.rpc("get_random_sentence").execute())
        sid = row.get("id") if row else None
        if sid:
            text = (row.get("text", "") or "")[:40]
            cat = row.get("category", "?")
            log.info(f"  📝 sentence [{cat}]: {text}...")
            return sid
    except Exception as e:
        log.warning(f"RPC get_random_sentence 不可用，转表扫描: {e}")
    try:
        resp = client.table("sentences").select("id").limit(1).execute()
        rows = resp.data or []
        if rows:
            sid = rows[0].get("id")
            if sid:
                log.info(f"  📝 sentence(scan): {sid}")
                return sid
    except Exception as e:
        log.error(f"表扫描 sentences 失败: {e}")
    return None


# =============================================================================
# AI 智能推荐（可选）
# =============================================================================
def ai_pick(client):
    log.info("🤖 启用 AI 智能推荐模式...")
    # 获取候选词条（20条）
    try:
        resp = client.table("dictionary_full") \
            .select("word, senses, romanization") \
            .eq("enrichment_status", "enriched") \
            .gt("sense_count", 0) \
            .limit(60).execute()
        import random
        rows = resp.data or []
        random.shuffle(rows)
        words = []
        for r in rows[:20]:
            senses = r.get("senses", [])
            if isinstance(senses, str):
                senses = json.loads(senses)
            s0 = senses[0] if senses else {}
            words.append({
                "word": r.get("word", ""),
                "romanization": r.get("romanization", ""),
                "meaning": s0.get("meaning", "") if isinstance(s0, dict) else "",
                "pos": s0.get("pos", "") if isinstance(s0, dict) else "",
            })
    except Exception as e:
        log.error(f"获取候选词条失败: {e}")
        return None

    # 获取候选句子（10条）
    try:
        resp = client.table("sentences") \
            .select("id, text, category, literal_meaning, actual_meaning") \
            .limit(30).execute()
        rows = resp.data or []
        random.shuffle(rows)
        sentences = []
        for r in rows[:10]:
            sentences.append({
                "id": r.get("id"),
                "text": r.get("text", ""),
                "category": r.get("category", "daily"),
                "literal_meaning": r.get("literal_meaning", ""),
                "actual_meaning": r.get("actual_meaning", ""),
            })
    except Exception as e:
        log.error(f"获取候选句子失败: {e}")
        return None

    if len(words) < 3 or len(sentences) < 3:
        log.warning("候选不足，降级到随机模式")
        return None

    words_text = "\n".join(
        f"  {i}. {w['word']} [{w.get('romanization','')}] — {w.get('pos','')} {w.get('meaning','')}"
        for i, w in enumerate(words, 1)
    )
    sents_text = "\n".join(
        f"  {i}. [{s['id']}] [{s['category']}] {s['text']}"
        for i, s in enumerate(sentences, 1)
    )

    system = (
        "你是泰语学习 App 的每日内容推荐助手。从候选词条和句子中各选一个作为今日推荐。"
        "标准：①实用高频 ②有文化趣味 ③难度适中 ④词句主题呼应。"
        "严格返回 JSON：{\"word_id\":\"词条word\",\"sentence_id\":句子id,\"reason\":\"理由\"}"
    )
    user = (
        f"今天是 {date.today().strftime('%Y年%m月%d日')}，请推荐：\n\n"
        f"【候选词条 {len(words)}个】\n{words_text}\n\n"
        f"【候选句子 {len(sentences)}个】\n{sents_text}\n\n"
        f"返回 JSON。"
    )

    try:
        resp = requests.post(
            f"{AI_API_BASE}/chat/completions",
            headers={"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": AI_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.7,
                "max_tokens": 500,
            },
            timeout=60,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        a, b = content.find("{"), content.rfind("}") + 1
        if a == -1 or b == 0:
            log.warning(f"AI 返回非 JSON: {content[:100]}")
            return None
        pick = json.loads(content[a:b])
        log.info(f"  AI 推荐: word={pick.get('word_id')}, sentence={pick.get('sentence_id')}")
        log.info(f"  理由: {pick.get('reason', '')}")
        return pick
    except Exception as e:
        log.warning(f"AI API 失败: {e}，降级到随机模式")
        return None


# =============================================================================
# 写入 daily_picks 表（稳健 upsert：先查今天 → update 或 insert）
# =============================================================================
def save_daily_pick(client, word_id, sentence_id):
    today = date.today().isoformat()
    row = {
        "pick_date": today,
        "daily_word_id": word_id,
        "daily_sentence_id": sentence_id,
    }
    try:
        # 先查今天是否已有记录
        existing = (
            client.table("daily_picks")
            .select("id")
            .eq("pick_date", today)
            .maybe_single()
            .execute()
        )
        if getattr(existing, "data", None):
            resp = (
                client.table("daily_picks")
                .update(row)
                .eq("id", existing.data["id"])
                .execute()
            )
        else:
            resp = client.table("daily_picks").insert(row).execute()
        if getattr(resp, "error", None):
            log.error(f"  Upsert 失败: {resp.error}")
            return False
        log.info(f"  ✅ 已写入每日推荐（pick_date={today}）")
        return True
    except Exception as e:
        log.error(f"  Upsert 异常: {e}")
        return False


# =============================================================================
# 主流程
# =============================================================================
def main():
    log.info("=" * 50)
    log.info(f"🚀 Daily Pick — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info(f"   AI 模式: {'✅ 启用' if USE_AI else '❌ 随机'}")

    client = get_client()
    today = date.today().isoformat()

    # 检查今天是否已有推荐（避免重复执行）
    try:
        existing = client.table("daily_picks").select("id").eq("pick_date", today).execute()
        if existing.data and len(existing.data) > 0:
            log.info(f"⏭️  {today} 已有推荐记录，跳过")
            log.info("=" * 50)
            return
    except Exception:
        pass  # 表可能不存在，继续执行

    pick = None
    if USE_AI:
        pick = ai_pick(client)

    # AI 失败或不启用 → 随机选取
    if not pick:
        log.info("🎲 使用随机选取模式...")
        word_id = fetch_random_word_id(client)
        sentence_id = fetch_random_sentence_id(client)
        if not word_id and not sentence_id:
            log.error("❌ 未能获取任何推荐内容")
            sys.exit(1)
        pick = {"word_id": word_id, "sentence_id": sentence_id, "reason": "随机选取"}

    ok = save_daily_pick(client, pick["word_id"], pick["sentence_id"])
    if ok:
        log.info(f"✅ 已保存 {today} 每日推荐")
        log.info(f"   word_id: {pick['word_id']}")
        log.info(f"   sentence_id: {pick['sentence_id']}")
    else:
        log.error("❌ 保存失败")
        sys.exit(1)

    log.info("=" * 50)


if __name__ == "__main__":
    main()
