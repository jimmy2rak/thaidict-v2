# seg_utils.py —— 分词共享工具（脚本与 Docker 服务共用）
# ----------------------------------------------------
# 提供：
#   load_custom_map(path) -> {短语: [分词1, 分词2, ...]}
#   segment(text, engine, custom_map) -> [{text, type}]（已展开）
#   expand_tokens(tokens, custom_map) -> 命中短语则递归展开
#
# 自定义词典格式（TSV，每行一个映射，# 开头为注释）：
#   完整短语<TAB>分词1|分词2|...
# 例：เข้าตามตรอกออกตามประตู	เข้าตามตรอก|ออกตามประตู
#
# 递归细分：展开后的每个小句会再走一次 newmm，
# 例如 เข้าตามตรอก -> เข้า|ตาม|ตรอก，确保粒度足够细。

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


def segment(text: str, engine: str = "newmm",
            custom_map: Optional[Dict[str, List[str]]] = None,
            _depth: int = 0) -> List[dict]:
    """newmm 分词 + 自定义映射递归展开。返回 [{text, type}]。"""
    from pythainlp.tokenize import word_tokenize

    if not text or not text.strip():
        return []
    # 深度保护：自定义词典若出现 A->B->A 循环，最多展开 10 层后停止
    if _depth > 10:
        return [{"text": text, "type": "word"}]
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
        tokens = expand_tokens(tokens, custom_map, _depth)
    return tokens


def expand_tokens(tokens: List[dict], custom_map: Dict[str, List[str]],
                  _depth: int = 0) -> List[dict]:
    """若某 token 的 text 精确命中 custom_map 的键，
    则对该键对应的每个小句递归调用 segment（小句本身会再被 newmm 细分）。"""
    if not custom_map:
        return tokens
    out: List[dict] = []
    for t in tokens:
        txt = (t.get("text") or "")
        if txt in custom_map and _depth < 10:
            for part in custom_map[txt]:
                # 递归：part 通常不是映射键，会被 newmm 正常细分；
                # 若 part 也是键，则继续展开（带深度保护，防止循环）。
                out.extend(segment(part, custom_map=custom_map, _depth=_depth + 1))
        else:
            out.append(t)
    return out
