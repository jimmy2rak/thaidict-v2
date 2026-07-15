# 泰语分词微服务（PyThaiNLP newmm）
# ------------------------------------------------
# 独立部署，Next.js 前端通过 THAI_SEGMENT_SERVICE_URL 调用。
# 启动：uvicorn main:app --host 0.0.0.0 --port 8000

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import time

app = FastAPI(title="Thai Segment Service", version="1.0.0")

# ---------- 配置 ----------
DICT_CACHE_TTL_MS = int(os.getenv("DICT_CACHE_TTL_MS", "300000"))  # 5 min
# Supabase 自定义词典（可选）。若为空则使用 PyThaiNLP 自带词典。
CUSTOM_DICT = None


# ---------- 模型 ----------
class SegmentReq(BaseModel):
    text: str
    engine: Optional[str] = "newmm"  # newmm / mm / dict
    custom_dict_url: Optional[str] = None  # 可临时传入自定义词典 URL


class Token(BaseModel):
    text: str
    type: str = "word"  # word | space | punct | residual


class SegmentResp(BaseModel):
    text: str
    tokens: List[Token]


# ---------- 词典加载 ----------
_last_dict_load = 0

def _ensure_dict():
    """若配置了自定义词典，加载到 PyThaiNLP 的 pythainlp.corpus 中。"""
    global CUSTOM_DICT, _last_dict_load
    # 这里预留自定义词典扩展：可从环境变量 THAI_CUSTOM_DICT 读取本地 TSV/TXT 路径
    custom_path = os.getenv("THAI_CUSTOM_DICT", "")
    if custom_path and os.path.exists(custom_path) and (time.time() - _last_dict_load) * 1000 > DICT_CACHE_TTL_MS:
        # PyThaiNLP 支持通过 pythainlp.corpus 的 trie 追加自定义词
        from pythainlp.tokenize import Tokenizer
        # 简单实现：把文件按行读取为 list，然后 newmm 每次分词都合并
        CUSTOM_DICT = [line.strip() for line in open(custom_path, "r", encoding="utf-8") if line.strip()]
        _last_dict_load = time.time()


# ---------- 分词 ----------
_is_pythainlp_ok = True

def _segment_with_pythainlp(text: str) -> List[Token]:
    from pythainlp.tokenize import word_tokenize
    _ensure_dict()
    words = word_tokenize(text, engine="newmm", custom_dict=CUSTOM_DICT)
    tokens: List[Token] = []
    for w in words:
        if not w:
            continue
        if w.strip() == "":
            tokens.append(Token(text=w, type="space"))
        elif w in " \t\n\r":
            tokens.append(Token(text=w, type="space"))
        else:
            tokens.append(Token(text=w, type="word"))
    return tokens


def _segment_safe(text: str) -> List[Token]:
    """安全分词：捕获所有异常，避免返回空。"""
    global _is_pythainlp_ok
    if not _is_pythainlp_ok:
        # PyThaiNLP 不可用时的最终兜底：整句不拆
        return [Token(text=text, type="word")]
    try:
        return _segment_with_pythainlp(text)
    except Exception as e:
        print(f"[thai-segment] pythainlp failed: {e}")
        _is_pythainlp_ok = False
        return [Token(text=text, type="word")]


# ---------- 路由 ----------
@app.get("/health")
def health():
    return {"ok": True, "pythainlp": _is_pythainlp_ok}


@app.post("/segment", response_model=SegmentResp)
def segment(req: SegmentReq):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is empty")
    tokens = _segment_safe(req.text)
    return SegmentResp(text=req.text, tokens=tokens)


@app.post("/batch", response_model=List[SegmentResp])
def batch(reqs: List[SegmentReq]):
    out = []
    for r in reqs:
        tokens = _segment_safe(r.text) if r.text and r.text.strip() else [Token(text=r.text, type="word")]
        out.append(SegmentResp(text=r.text, tokens=tokens))
    return out


# 兼容旧前端 /api/thai-segment 返回结构：{ data: [...] }
@app.post("/legacy", response_model=dict)
def legacy(req: SegmentReq):
    if not req.text or not req.text.strip():
        return {"data": []}
    tokens = _segment_safe(req.text)
    return {"data": [{"text": t.text, "type": t.type} for t in tokens]}
