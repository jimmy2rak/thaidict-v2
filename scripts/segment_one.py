#!/usr/bin/env python3
"""
segment_one.py —— 单句分词测试（不连数据库）

用法：
  python scripts/segment_one.py "เขาสารภาพโทษ"
"""

import sys
from pythainlp.tokenize import word_tokenize


def segment(text: str):
    words = word_tokenize(text, engine="newmm")
    return words


if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else "เขาสารภาพโทษ"
    print("input: ", text)
    print("tokens:", " | ".join(segment(text)))
