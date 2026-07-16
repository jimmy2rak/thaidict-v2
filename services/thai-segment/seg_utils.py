# seg_utils.py —— 分词共享工具（脚本与 Docker 服务共用）
# ----------------------------------------------------
# 提供：
#   load_custom_map(path) -> {短语: [分词1, 分词2, ...]}
#   expand_tokens(tokens, custom_map) -> 命中短语则展开
#   segment(text, engine, custom_map) -> [{text, type}]（已展开）
#
# 自定义词典格式（TSV，每行一个映射，# 开头为注释）：
#   完整短语<TAB>分词1|分词2|...
# 例：เข้าตามตรอกออกตามประตู	เข้าตามตรอก|ออกตามประตู

import os
from typing import Dict, List, Optional


def load_custom_map(path: str) -> Dict[str, List[str]]:
    """读取自定义分词映射。文件不存在返回空字典。"""
    m: Dict[str, List[str]] = {}
    if not path or not os.path.exists(path):
        return m
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            if "\t" in line:
                key, parts = line.split("\t", 1)
            else:
                # 退化行（无分隔符）忽略
                continue
            key = key.strip()
            parts = [p.strip() for p in parts.split("|") if p.strip()]
            if key and len(parts) > 1:
                m[key] = parts
    return m


def expand_tokens(tokens: List[dict], custom_map: Dict[str, List[str]]) -> List[dict]:
    """若某 token 的 text 精确命中 custom_map 的键，则展开为多个 word token。"""
    if not custom_map:
        return tokens
    out: List[dict] = []
    for t in tokens:
        txt = (t.get("text") or "")
        if txt in custom_map:
            for p in custom_map[txt]:
                out.append({"text": p, "type": "word"})
        else:
            out.append(t)
    return out


def segment(text: str, engine: str = "newmm",
            custom_map: Optional[Dict[str, List[str]]] = None) -> List[dict]:
    """newmm 分词 + 自定义映射展开。返回 [{text, type}]。"""
    from pythainlp.tokenize import word_tokenize

    if not text or not text.strip():
        return []
    words = word_tokenize(text, engine=engine)
    tokens: List[dict] = []
    for w in words:
        if not w:
            continue
        if w.strip() == "" or w in " \t\n\r":
            tokens.append({"text": w, "type": "space"})
        else:
            tokens.append({"text": w, "type": "word"})
    if custom_map:
        tokens = expand_tokens(tokens, custom_map)
    return tokens
