#!/usr/bin/env python3
"""
segment_existing_data.py
----------------------
用 PyThaiNLP newmm 为数据库里所有例句补全 segmented 字段。

涉及两张表：
1. dictionary.senses[].examples[].th -> 在 senses JSON 内写入 segmented 数组
2. sentences.text -> 写入 segmented 字段

运行前需要设置环境变量：
  export SUPABASE_URL=https://...supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=eyJ...

可选：
  export BATCH_SIZE=100          # 每批处理条数，默认 100
  export ONLY_EMPTY=1            # 只处理 segmented 为空的数据（默认开）
  export ONLY_SINGLE=1           # 只重跑 segmented 为单 token 的行（如俗语被当成一个词）
  export ONLY_CATEGORY=idioms   # 只处理该 category 的 sentences（短语库：idioms/buddhist/daily）
  export DRY_RUN=1               # 只打印，不写入
  export THAI_SEGMENT_ENGINE=newmm # newmm | mm | dict
注：分词自动用「词库兜底拆词」——newmm 把成语合成一个长词时，会用 dictionary 表
的 6 万词做贪婪最长匹配拆开，从而自动拆分【所有】短语，无需逐条加 custom_dict。
自定义俗语映射见 services/thai-segment/custom_dict.txt，作为非组合型成语的最终兜底。

用法：
  python scripts/segment_existing_data.py
"""

import os
import sys
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Supabase Python client
from supabase import create_client, Client

# 复用服务端分词工具（自定义俗语映射 + 词库兜底拆词，单一数据源）
import sys as _sys
_sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "thai-segment"))
from seg_utils import load_custom_map, segment as _seg, load_wordlist_from_supabase, load_wordlist_from_file  # noqa: E402

CUSTOM_DICT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "services", "thai-segment", "custom_dict.txt"
)
CUSTOM_MAP = load_custom_map(CUSTOM_DICT_PATH)


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))
ONLY_EMPTY = os.getenv("ONLY_EMPTY", "1") == "1"
ONLY_SINGLE = os.getenv("ONLY_SINGLE", "0") == "1"  # 只重跑 segmented 为单 token 的行
ONLY_CATEGORY = os.getenv("ONLY_CATEGORY", "")      # 只处理该 category 的 sentences（如 idioms/buddhist/daily）
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
ENGINE = os.getenv("THAI_SEGMENT_ENGINE", "newmm")
# 词库兜底拆词用到的词集（启动时从 Supabase 拉取，6 万+ 词）
WORDSET = set()


def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def segment_text(text: str, custom_map=None) -> List[Dict[str, str]]:
    """返回前端 ThaiSentence 兼容的 token 数组：[{text, type}]。
    复用 seg_utils.segment：newmm + 词库长词兜底（成语自动拆词）+ 自定义映射递归展开。"""
    if not text or not text.strip():
        return []
    return _seg(text, engine=ENGINE, custom_map=custom_map, word_set=WORDSET)


def update_dictionary_examples(supabase: Client, table_name: str = "dictionary"):
    """回填 dictionary / community_words 表 senses 内例句的 segmented 字段。"""
    log(f"开始读取 {table_name} 表...")
    rows = []
    page = 0
    pk = "word" if table_name == "dictionary" else "id"
    while True:
        resp = (
            supabase.table(table_name)
            .select(f"{pk}, senses")
            .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1)
            .execute()
        )
        data = resp.data or []
        if not data:
            break
        rows.extend(data)
        page += 1
        log(f"  已读取 {len(rows)} 行...")

    log(f"共读取 {table_name} {len(rows)} 行")

    updated = 0
    skipped = 0
    for row in rows:
        pk_val = row.get(pk)
        senses = row.get("senses")
        if not isinstance(senses, list) or not pk_val:
            skipped += 1
            continue

        changed = False
        new_senses = []
        for s in senses:
            examples = s.get("examples") or []
            new_examples = []
            for ex in examples:
                th = ex.get("th") or ex.get("thai") or ex.get("text") or ""
                existing_seg = ex.get("segmented")
                is_single = isinstance(existing_seg, list) and len(existing_seg) == 1
                if ONLY_SINGLE:
                    # 只重跑单 token 的例句（如俗语被当成一个词）
                    if not is_single:
                        new_examples.append(ex)
                        continue
                elif ONLY_EMPTY and isinstance(existing_seg, list) and len(existing_seg) > 0:
                    new_examples.append(ex)
                    continue
                if not th.strip():
                    new_examples.append(ex)
                    continue
                seg = segment_text(th, CUSTOM_MAP)
                if seg:
                    new_ex = dict(ex)
                    new_ex["segmented"] = seg
                    new_examples.append(new_ex)
                    changed = True
                else:
                    new_examples.append(ex)
            new_s = dict(s)
            new_s["examples"] = new_examples
            new_senses.append(new_s)

        if not changed:
            skipped += 1
            continue

        if DRY_RUN:
            log(f"[DRY_RUN] 将更新 {table_name} {pk}='{pk_val}'，{len(new_senses)} 个义项")
            updated += 1
            continue

        try:
            supabase.table(table_name).update({"senses": new_senses}).eq(pk, pk_val).execute()
            updated += 1
        except Exception as e:
            log(f"[ERR] 更新 {table_name} {pk}='{pk_val}' 失败: {e}")

        if updated % 100 == 0:
            log(f"  已更新 {updated} 行...")

    log(f"{table_name} 表处理完成：更新 {updated} 行，跳过 {skipped} 行")


def update_sentences(supabase: Client):
    """回填 sentences 表 segmented 字段。
    ONLY_CATEGORY 非空时只处理该 category（如 idioms/buddhist/daily 短语库）。"""
    log("开始读取 sentences 表...")
    rows = []
    page = 0
    query = supabase.table("sentences").select("id, text, segmented, category")
    while True:
        resp = query.range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1).execute()
        data = resp.data or []
        if not data:
            break
        rows.extend(data)
        page += 1
        log(f"  已读取 {len(rows)} 行...")

    log(f"共读取 sentences {len(rows)} 行" + (f"（仅 category={ONLY_CATEGORY}）" if ONLY_CATEGORY else ""))

    updated = 0
    skipped = 0
    for row in rows:
        # 仅处理指定 category（短语库）
        if ONLY_CATEGORY and (row.get("category") or "") != ONLY_CATEGORY:
            skipped += 1
            continue

        text = row.get("text") or ""
        if not text.strip():
            skipped += 1
            continue

        existing_seg = row.get("segmented")
        is_single = isinstance(existing_seg, list) and len(existing_seg) == 1
        if ONLY_SINGLE and not is_single:
            skipped += 1
            continue

        if DRY_RUN:
            log(f"[DRY_RUN] 将更新 sentences id={row['id']}")
            updated += 1
            continue

        seg = segment_text(text, CUSTOM_MAP)
        if not seg:
            skipped += 1
            continue

        try:
            supabase.table("sentences").update({"segmented": seg}).eq("id", row["id"]).execute()
            updated += 1
        except Exception as e:
            log(f"[ERR] 更新 sentences id={row['id']} 失败: {e}")

        if updated % 100 == 0:
            log(f"  已更新 {updated} 行...")

    log(f"sentences 表处理完成：更新 {updated} 行，跳过 {skipped} 行")


def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        log("错误：请设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量")
        sys.exit(1)

    log(f"DRY_RUN={DRY_RUN}, ONLY_EMPTY={ONLY_EMPTY}, ONLY_SINGLE={ONLY_SINGLE}, ONLY_CATEGORY={ONLY_CATEGORY}, BATCH_SIZE={BATCH_SIZE}, ENGINE={ENGINE}, CUSTOM_DICT={CUSTOM_DICT_PATH}")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 加载 6 万词泰语词库，用于成语/谚语兜底拆词（自动拆分所有短语）
    # 优先读烤进镜像/仓库的 wordlist.txt（无需运行时 Supabase 凭据）；
    # 文件不存在时回退到从 Supabase 拉取。
    global WORDSET
    WORDLIST_FILE = os.path.join(os.path.dirname(__file__), "..", "services", "thai-segment", "wordlist.txt")
    WORDSET = load_wordlist_from_file(WORDLIST_FILE)
    if WORDSET:
        log(f"词库从文件加载：{len(WORDSET)} 词（{WORDLIST_FILE}）")
    else:
        try:
            WORDSET = load_wordlist_from_supabase(supabase)
            log(f"词库从 Supabase 加载完成：{len(WORDSET)} 词（用于成语兜底拆词）")
        except Exception as e:
            log(f"[WARN] 词库加载失败，成语将无法自动拆词：{e}")

    update_dictionary_examples(supabase, "dictionary")
    update_dictionary_examples(supabase, "community_words")
    update_sentences(supabase)

    log("全部完成")


if __name__ == "__main__":
    main()
