# seg_utils.py —— 分词共享工具（脚本与 Docker 服务共用）
# ----------------------------------------------------
# 提供：
#   load_custom_map(path) -> {短语: [分词1, 分词2, ...]}
#   load_wordlist_from_supabase(supabase, table, column) -> set(词)
#   greedy_segment(text, word_set) -> [{text, type}]   # 左到右最长匹配
#   segment(text, engine, custom_map, word_set) -> [{text, type}]  # newmm + 长词兜底 + 自定义映射递归展开
#   expand_tokens(tokens, custom_map) -> 命中短语则递归展开
#
# 自定义词典格式（TSV，每行一个映射，# 开头为注释）：
#   完整短语<TAB>分词1|分词2|...
# 例：เข้าตามตรอกออกตามประตู	เข้าตามตรอก|ออกตามประตู
#
# 设计要点：
#   - PyThaiNLP newmm 会把泰语成语/谚语当成一个词返回（单 token）。
#   - 我们自己的 6 万词泰语词库（dictionary.word）是这些成语的成分词集合。
#   - 若 newmm 产出一个「长单 token」（很可能是未被拆开的成语），用词库做
#     贪婪最长匹配把它拆成已知成分词，实现「所有短语自动拆分」。

import os
from typing import Dict, List, Optional, Set


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
                continue
            key = key.strip()
            parts = [p.strip() for p in parts.split("|") if p.strip()]
            if key and len(parts) > 1:
                m[key] = parts
    return m


def load_wordlist_from_supabase(supabase, table: str = "dictionary",
                                column: str = "word", batch: int = 1000) -> Set[str]:
    """从我们自己的泰语词库拉取全部词，构建分词词集。
    服务角色可直读 dictionary 基表；词库很大（6 万+），分页拉取。
    注意：Supabase REST 默认单次最多返回 1000 行（db-max-rows），故 batch<=1000，
    并以「返回空」判定结束——绝不能用 batch>1000 + 「len<batch 即末页」，否则
    第一页被截成 1000 行就误判结束，只拉到约千词。"""
    words: Set[str] = set()
    page = 0
    while True:
        try:
            resp = (
                supabase.table(table)
                .select(column)
                .range(page * batch, (page + 1) * batch - 1)
                .execute()
            )
        except Exception as e:
            print(f"[wordlist] fetch error: {e}")
            break
        data = getattr(resp, "data", None) or []
        if not data:
            break
        for r in data:
            w = (r.get(column) or "").strip()
            # 只收不含空格、长度合理的词条，避免脏数据
            if w and " " not in w and len(w) <= 50:
                words.add(w)
        # batch<=1000（不超过 db-max-rows），返回不足一页即末尾
        if len(data) < batch:
            break
        page += 1
    return words


def load_wordlist_from_file(path: str) -> Set[str]:
    """从每行一个词的文本文件加载词集（用于镜像内持久化，避免每次重启都查库）。"""
    words: Set[str] = set()
    if not path or not os.path.exists(path):
        return words
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            w = line.strip()
            if w and " " not in w:
                words.add(w)
    return words


def save_wordlist_to_file(words: Set[str], path: str):
    try:
        with open(path, "w", encoding="utf-8") as f:
            for w in sorted(words):
                f.write(w + "\n")
    except Exception as e:
        print(f"[wordlist] save error: {e}")


def greedy_segment(text: str, word_set: Set[str], max_len: int = 40) -> List[dict]:
    """左到右最长匹配：把文本拆成词库中的已知词。
    无法匹配的字符保持原样（单字），由调用方决定是否采用。"""
    if not text or not text.strip():
        return []
    tokens: List[dict] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch.isspace():
            tokens.append({"text": ch, "type": "space"})
            i += 1
            continue
        matched = None
        # 从最长可能子串开始尝试
        for l in range(min(max_len, n - i), 0, -1):
            cand = text[i:i + l]
            if cand in word_set:
                matched = cand
                break
        if matched and len(matched) >= 2:
            tokens.append({"text": matched, "type": "word"})
            i += len(matched)
        else:
            # 词库中无匹配：保留原字符（避免拆成无意义单字时仍回落到整串）
            tokens.append({"text": ch, "type": "word"})
            i += 1
    return tokens


def _maybe_break_idiom(tokens: List[dict], word_set: Set[str]) -> List[dict]:
    """newmm 仍合并成的长单词（成语/谚语），尝试用词库贪婪切分。
    仅当能切成 >=2 个有效词（每段 >=2 字符）时才采用，避免误拆。"""
    if not word_set:
        return tokens
    out: List[dict] = []
    for t in tokens:
        if t.get("type") == "word" and len(t["text"]) >= 6:
            g = greedy_segment(t["text"], word_set)
            valid = [x for x in g if x["type"] == "word" and len(x["text"]) >= 2]
            if len(valid) >= 2:
                out.extend(g)
                continue
        out.append(t)
    return out


def segment(text: str, engine: str = "newmm",
            custom_map: Optional[Dict[str, List[str]]] = None,
            word_set: Optional[Set[str]] = None,
            _depth: int = 0) -> List[dict]:
    """newmm 分词 + 长词（成语）兜底拆词 + 自定义映射递归展开。返回 [{text, type}]。"""
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
    # 长词兜底：newmm 把成语合成一个词时，用词库拆开
    if word_set:
        tokens = _maybe_break_idiom(tokens, word_set)
    # 自定义俗语精确映射（非组合型成语的最终兜底）
    if custom_map:
        tokens = expand_tokens(tokens, custom_map, word_set=word_set, _depth=_depth)
    return tokens


def expand_tokens(tokens: List[dict], custom_map: Dict[str, List[str]],
                  word_set: Optional[Set[str]] = None,
                  _depth: int = 0) -> List[dict]:
    """若某 token 的 text 精确命中 custom_map 的键，
    则对该键对应的每个小句递归调用 segment（小句本身会再被 newmm 细分，并保留词库兜底）。"""
    if not custom_map:
        return tokens
    out: List[dict] = []
    for t in tokens:
        txt = (t.get("text") or "")
        if txt in custom_map and _depth < 10:
            for part in custom_map[txt]:
                out.extend(segment(part, custom_map=custom_map, word_set=word_set, _depth=_depth + 1))
        else:
            out.append(t)
    return out
