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
  export ONLY_EMPTY=1            # 只处理 segmented 为空的数据
  export DRY_RUN=1               # 只打印，不写入
  export THAI_SEGMENT_ENGINE=newmm # newmm | mm | dict

用法：
  python scripts/segment_existing_data.py
"""

import os
import sys
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# PyThaiNLP
from pythainlp.tokenize import word_tokenize

# Supabase Python client
from supabase import create_client, Client


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))
ONLY_EMPTY = os.getenv("ONLY_EMPTY", "1") == "1"
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
ENGINE = os.getenv("THAI_SEGMENT_ENGINE", "newmm")


def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def segment_text(text: str) -> List[Dict[str, str]]:
    """返回前端 ThaiSentence 兼容的 token 数组：[{text, type}]"""
    if not text or not text.strip():
        return []
    words = word_tokenize(text, engine=ENGINE)
    tokens = []
    for w in words:
        if not w:
            continue
        if w.strip() == "":
            tokens.append({"text": w, "type": "space"})
        elif w in " \t\n\r":
            tokens.append({"text": w, "type": "space"})
        else:
            tokens.append({"text": w, "type": "word"})
    return tokens


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
                if ONLY_EMPTY and isinstance(existing_seg, list) and len(existing_seg) > 0:
                    new_examples.append(ex)
                    continue
                if not th.strip():
                    new_examples.append(ex)
                    continue
                seg = segment_text(th)
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
    """回填 sentences 表 segmented 字段。"""
    log("开始读取 sentences 表...")
    rows = []
    page = 0
    query = supabase.table("sentences").select("id, text")
    while True:
        resp = query.range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1).execute()
        data = resp.data or []
        if not data:
            break
        rows.extend(data)
        page += 1
        log(f"  已读取 {len(rows)} 行...")

    log(f"共读取 sentences {len(rows)} 行")

    updated = 0
    skipped = 0
    for row in rows:
        text = row.get("text") or ""
        if not text.strip():
            skipped += 1
            continue

        if DRY_RUN:
            log(f"[DRY_RUN] 将更新 sentences id={row['id']}")
            updated += 1
            continue

        seg = segment_text(text)
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

    log(f"DRY_RUN={DRY_RUN}, ONLY_EMPTY={ONLY_EMPTY}, BATCH_SIZE={BATCH_SIZE}, ENGINE={ENGINE}")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    update_dictionary_examples(supabase, "dictionary")
    update_dictionary_examples(supabase, "community_words")
    update_sentences(supabase)

    log("全部完成")


if __name__ == "__main__":
    main()
