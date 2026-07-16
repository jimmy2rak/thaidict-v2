#!/usr/bin/env python3
"""
segment_one.py —— 单句分词测试（不连数据库）

用法：
  python scripts/segment_one.py "เขาสารภาพโทษ"

自定义俗语映射见 services/thai-segment/custom_dict.txt
"""

import sys
import os

# 复用服务端的分词工具（单一数据源）
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "thai-segment"))
from seg_utils import load_custom_map, segment  # noqa: E402

DICT_PATH = os.path.join(os.path.dirname(__file__), "..", "services", "thai-segment", "custom_dict.txt")


def main():
    text = sys.argv[1] if len(sys.argv) > 1 else "เขาสารภาพโทษ"
    cmap = load_custom_map(DICT_PATH)
    toks = segment(text, engine="newmm", custom_map=cmap)
    print("input: ", text)
    print("tokens:", " | ".join(t["text"] for t in toks))


if __name__ == "__main__":
    main()
