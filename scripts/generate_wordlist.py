#!/usr/bin/env python3
"""
generate_wordlist.py
-------------------
生成 services/thai-segment/wordlist.txt（每行一个泰语词），作为分词兜底词库。
从 Supabase 的 dictionary.word 与 community_words.word 拉取。

只需在有 Supabase 凭据的机器上运行【一次】，结果提交进仓库。
之后 Docker 镜像与回填脚本都直接读文件，无需运行时凭据——这是让「所有短语
自动拆词」稳定生效的关键（否则容器拿不到 SUPABASE_SERVICE_ROLE_KEY 时词库永远为空）。

用法：
  export SUPABASE_URL=https://xxx.supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=eyJ...
  python3 scripts/generate_wordlist.py [--force]   # --force 覆盖已存在的文件
"""
import os
import sys
import argparse

# 复用服务端分词工具
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "thai-segment"))
from seg_utils import load_wordlist_from_supabase, save_wordlist_to_file  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO_ROOT, "services", "thai-segment", "wordlist.txt")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="覆盖已存在的 wordlist.txt")
    args = ap.parse_args()

    if os.path.exists(OUT) and not args.force:
        print(f"[generate_wordlist] 已存在 {OUT}，跳过（用 --force 覆盖）")
        return

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("错误：请先设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量")
        sys.exit(1)

    from supabase import create_client
    sb = create_client(url, key)

    words = load_wordlist_from_supabase(sb, "dictionary", "word")
    print(f"[generate_wordlist] dictionary 词数：{len(words)}")

    # 并入社区词库（若存在），避免遗漏用户贡献词
    try:
        cw = load_wordlist_from_supabase(sb, "community_words", "word")
        words |= cw
        print(f"[generate_wordlist] + community_words：{len(cw)}（合计 {len(words)}）")
    except Exception as e:
        print(f"[generate_wordlist] community_words 跳过：{e}")

    save_wordlist_to_file(words, OUT)
    print(f"[generate_wordlist] 已写入 {len(words)} 词 -> {OUT}")


if __name__ == "__main__":
    main()
