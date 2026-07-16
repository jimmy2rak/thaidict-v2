#!/usr/bin/env python3
"""
generate_wordlist.py
-------------------
生成 services/thai-segment/wordlist.txt（每行一个泰语词），作为分词兜底词库。
从 Supabase 的 dictionary.word 与 community_words.word 拉取。

【无第三方依赖】：仅用 Python 标准库（urllib）直接调用 Supabase REST 接口，
因此可在任意装有 python3 的机器（含未装 supabase 包的部署宿主机）上直接运行，
无需 pip install。

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
import json
import argparse
import urllib.request
import urllib.error

# 复用服务端分词工具里的写文件函数（seg_utils 顶层仅依赖标准库，可安全 import）
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "thai-segment"))
from seg_utils import save_wordlist_to_file  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO_ROOT, "services", "thai-segment", "wordlist.txt")

# Supabase REST 默认单次最多返回 1000 行（db-max-rows）。用 Range 头分页，
# 每页 <=1000，靠「返回 0 行」判定结束，绝不能用 limit=2000+「len<2000 即末页」
# ——那样第一页被截成 1000 行就误判结束（这正是只拉到 987 词的根因）。
PAGE = 1000


def fetch_table(base_url: str, key: str, table: str, column: str) -> set:
    """用 Supabase REST 接口分页拉取某列全部值，返回词集。
    用 Range 头分页，直到某页返回 0 行才停止。"""
    words: set = set()
    offset = 0
    while True:
        url = f"{base_url}/rest/v1/{table}?select={column}&order={column}.asc"
        req = urllib.request.Request(url, headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
            # Range 分页（PostgREST 官方分页方式），闭区间
            "Range-Unit": "items",
            "Range": f"{offset}-{offset + PAGE - 1}",
        })
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "ignore")
            print(f"[generate_wordlist] HTTP {e.code}: {body}")
            break
        except Exception as e:
            print(f"[generate_wordlist] fetch error: {e}")
            break
        if not data:
            break
        for r in data:
            w = (r.get(column) or "").strip()
            # 只收不含空格、长度合理的词条，避免脏数据
            if w and " " not in w and len(w) <= 50:
                words.add(w)
        n = len(data)
        print(f"[generate_wordlist]   {table}: +{n}（offset {offset}，累计词 {len(words)}）")
        # 返回不足一页说明已到末尾
        if n < PAGE:
            break
        offset += n
    return words


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

    base = url.rstrip("/")
    words = fetch_table(base, key, "dictionary", "word")
    print(f"[generate_wordlist] dictionary 词数：{len(words)}")

    # 并入社区词库（若存在），避免遗漏用户贡献词
    try:
        cw = fetch_table(base, key, "community_words", "word")
        words |= cw
        print(f"[generate_wordlist] + community_words：{len(cw)}（合计 {len(words)}）")
    except Exception as e:
        print(f"[generate_wordlist] community_words 跳过：{e}")

    save_wordlist_to_file(words, OUT)
    print(f"[generate_wordlist] 已写入 {len(words)} 词 -> {OUT}")


if __name__ == "__main__":
    main()
