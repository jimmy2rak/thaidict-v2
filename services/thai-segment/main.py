# 泰语分词微服务（PyThaiNLP newmm）
# ------------------------------------------------
# 独立部署，Next.js 前端通过 THAI_SEGMENT_SERVICE_URL 调用。
# 启动：uvicorn main:app --host 0.0.0.0 --port 8000
#
# 响应约定（同时满足两套调用方）：
#   /legacy -> {"data": [{"text", "type"}]}        # 本项目 route.js 根地址模式
#   /segment -> {"text", "tokens":[{text,type}], "result":[str]}  # route.js 读 tokens；其它调用方可读 result
#   /batch  -> [{"text", "tokens":[...], "result":[...]}, ...]
#   /health -> {"ok": true, "pythainlp": bool, "status": "ok"}
# 引擎固定 newmm，不可更换。

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import time

app = FastAPI(title="Thai Segment Service", version="1.0.0")

# ---------- 配置 ----------
DICT_CACHE_TTL_MS = int(os.getenv("DICT_CACHE_TTL_MS", "300000"))  # 5 min
# 可选自定义词典（本地 TSV/TXT 路径，按行一个词）
CUSTOM_DICT = None
_last_dict_load = 0


# ---------- 请求模型 ----------
class SegmentReq(BaseModel):
    text: str
    engine: Optional[str] = "newmm"  # 固定 newmm，保留字段兼容旧调用


# ---------- 词典加载（可选扩展） ----------
def _ensure_dict():
    global CUSTOM_DICT, _last_dict_load
    custom_path = os.getenv("THAI_CUSTOM_DICT", "")
    if custom_path and os.path.exists(custom_path) and \
       (time.time() - _last_dict_load) * 1000 > DICT_CACHE_TTL_MS:
        CUSTOM_DICT = [line.strip() for line in open(custom_path, "r", encoding="utf-8") if line.strip()]
        _last_dict_load = time.time()


# ---------- 分词 ----------
_is_pythainlp_ok = True


def _segment_with_pythainlp(text: str):
    from pythainlp.tokenize import word_tokenize
    _ensure_dict()
    words = word_tokenize(text, engine="newmm", custom_dict=CUSTOM_DICT)
    tokens = []
    for w in words:
        if not w:
            continue
        if w.strip() == "" or w in " \t\n\r":
            tokens.append({"text": w, "type": "space"})
        else:
            tokens.append({"text": w, "type": "word"})
    return tokens


def _segment_safe(text: str):
    """安全分词：捕获异常，PyThaiNLP 不可用时整句不拆兜底。"""
    global _is_pythainlp_ok
    if not _is_pythainlp_ok:
        return [{"text": text, "type": "word"}]
    try:
        return _segment_with_pythainlp(text)
    except Exception as e:
        print(f"[thai-segment] pythainlp failed: {e}")
        _is_pythainlp_ok = False
        return [{"text": text, "type": "word"}]


# ---------- 路由 ----------
@app.get("/health")
def health():
    # 兼容两种健康检查约定
    return {"ok": True, "pythainlp": _is_pythainlp_ok, "status": "ok"}


@app.post("/segment")
def segment(req: SegmentReq):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is empty")
    tokens = _segment_safe(req.text)
    return {
        "text": req.text,
        "tokens": tokens,                      # 本项目 route.js 读取（{text,type} 对象）
        "result": [t["text"] for t in tokens],  # 兼容其它调用方期望的纯字符串列表
    }


@app.post("/batch")
def batch(reqs: List[SegmentReq]):
    out = []
    for r in reqs:
        toks = _segment_safe(r.text) if r.text and r.text.strip() else [{"text": r.text, "type": "word"}]
        out.append({
            "text": r.text,
            "tokens": toks,
            "result": [t["text"] for t in toks],
        })
    return out


# 兼容旧前端 /api/thai-segment 返回结构：{ data: [{text, type}] }
@app.post("/legacy")
def legacy(req: SegmentReq):
    if not req.text or not req.text.strip():
        return {"data": []}
    tokens = _segment_safe(req.text)
    return {"data": [{"text": t["text"], "type": t["type"]} for t in tokens]}
