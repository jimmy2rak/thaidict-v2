#!/usr/bin/env python3
"""
ThaiDict 每日推荐脚本（独立版）
===============================
每天随机选取一条泰语词条 + 一句泰语例句，写入 daily_picks 表。

特点：
  - 单文件、零配置即可运行（默认密钥已内嵌）
  - 优先使用 Supabase RPC 随机取词；RPC 不可用时自动降级为「计数+随机偏移」
  - 写入时先查今天是否已有记录：有则更新，无则插入
  - 幂等：同一天多次运行只写入/更新同一行

运行方式：
  python3 scripts/daily_pick.py

依赖：
  pip install supabase requests
"""

import os
import sys
import json
import random
import logging
from datetime import date, datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("daily_pick")

# =============================================================================
# 内嵌默认配置（可被环境变量覆盖）
# =============================================================================
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://zvemahqskgluhirzbcqu.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZW1haHFza2dsdWhpcnpiY3F1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkxNTE1NiwiZXhwIjoyMDk2NDkxMTU2fQ.hgzdlM3o7ns664vrtq5e8ncYsly5oXJFYlyUhRDQCHs",
)

# =============================================================================
# 依赖检查（如果缺失则给出明确安装命令）
# =============================================================================
def ensure_dependencies():
    missing = []
    for module, pkg in [("supabase", "supabase"), ("requests", "requests")]:
        try:
            __import__(module)
        except ImportError:
            missing.append(pkg)
    if missing:
        log.error(
            "❌ 缺少依赖：%s\n   请运行：pip install %s",
            ", ".join(missing),
            " ".join(missing),
        )
        sys.exit(1)


ensure_dependencies()

from supabase import create_client


# =============================================================================
# Supabase 客户端
# =============================================================================
def get_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("❌ SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 为空")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# =============================================================================
# 工具函数
# =============================================================================
def unwrap_rpc(resp):
    """兼容 supabase-py 返回 list/dict 的情况。"""
    data = getattr(resp, "data", None)
    if isinstance(data, list) and data:
        return data[0]
    if isinstance(data, dict):
        return data
    return None


def random_row(client, table, columns, filters=None):
    """
    通用随机取一行。先尝试按 id 随机偏移，失败则回退到 limit(1)。
    """
    query = client.table(table).select(columns)
    if filters:
        for col, op, val in filters:
            if op == "eq":
                query = query.eq(col, val)
    try:
        count_resp = query.execute()
        rows = getattr(count_resp, "data", []) or []
        if rows:
            return random.choice(rows)
    except Exception as e:
        log.warning(f"直接随机取 {table} 失败: {e}")
    return None


# =============================================================================
# 获取随机词条/句子
# =============================================================================
def fetch_random_word(client):
    try:
        row = unwrap_rpc(client.rpc("get_random_word").execute())
        word = row.get("word", "") if row else ""
        if word:
            log.info(f"  📖 word: {word}")
            return word
    except Exception as e:
        log.warning(f"RPC get_random_word 不可用: {e}")

    # 兜底：随机取一条已富化词条
    row = random_row(
        client,
        "dictionary_full",
        "word",
        filters=[["enrichment_status", "eq", "enriched"]],
    )
    word = (row or {}).get("word", "")
    if word:
        log.info(f"  📖 word(fallback): {word}")
    return word


def fetch_random_sentence(client):
    try:
        row = unwrap_rpc(client.rpc("get_random_sentence").execute())
        sid = row.get("id") if row else None
        if sid:
            text = (row.get("text", "") or "")[:40]
            log.info(f"  📝 sentence: {text}...")
            return sid
    except Exception as e:
        log.warning(f"RPC get_random_sentence 不可用: {e}")

    # 兜底：随机取一条句子
    row = random_row(client, "sentences", "id")
    sid = (row or {}).get("id")
    if sid:
        log.info(f"  📝 sentence(fallback): {sid}")
    return sid


# =============================================================================
# 写入 daily_picks
# =============================================================================
def save_daily_pick(client, word_id, sentence_id):
    today = date.today().isoformat()
    row = {
        "pick_date": today,
        "daily_word_id": word_id,
        "daily_sentence_id": sentence_id,
    }
    try:
        existing = (
            client.table("daily_picks")
            .select("id")
            .eq("pick_date", today)
            .limit(1)
            .execute()
        )
        rows = getattr(existing, "data", []) or []
        if rows:
            resp = (
                client.table("daily_picks")
                .update(row)
                .eq("id", rows[0]["id"])
                .execute()
            )
        else:
            resp = client.table("daily_picks").insert(row).execute()

        if getattr(resp, "error", None):
            log.error(f"  写入失败: {resp.error}")
            return False
        log.info(f"  ✅ 已保存 {today} 每日推荐")
        return True
    except Exception as e:
        log.error(f"  写入异常: {e}")
        return False


# =============================================================================
# 主流程
# =============================================================================
def main():
    log.info("=" * 50)
    log.info(f"🚀 ThaiDict Daily Pick — {datetime.now():%Y-%m-%d %H:%M:%S}")

    client = get_client()
    today = date.today().isoformat()

    # 幂等：今天已有记录则跳过
    try:
        existing = (
            client.table("daily_picks")
            .select("id")
            .eq("pick_date", today)
            .limit(1)
            .execute()
        )
        if getattr(existing, "data", []):
            log.info(f"⏭️  {today} 已有推荐记录，跳过")
            log.info("=" * 50)
            return
    except Exception as e:
        log.warning(f"检查今日记录失败，继续执行: {e}")

    word_id = fetch_random_word(client)
    sentence_id = fetch_random_sentence(client)

    if not word_id and not sentence_id:
        log.error("❌ 未能获取任何推荐内容")
        sys.exit(1)

    ok = save_daily_pick(client, word_id, sentence_id)
    if ok:
        log.info(f"✅ 完成")
        log.info(f"   word_id:     {word_id}")
        log.info(f"   sentence_id: {sentence_id}")
    else:
        log.error("❌ 保存失败")
        sys.exit(1)

    log.info("=" * 50)


if __name__ == "__main__":
    main()
