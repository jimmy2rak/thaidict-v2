# 泰语分词微服务（PyThaiNLP newmm + 自定义映射）
# ------------------------------------------------
# 独立部署，Next.js 前端通过 THAI_SEGMENT_SERVICE_URL 调用。
# 启动：uvicorn main:app --host 0.0.0.0 --port 8000
#
# 响应约定（同时满足两套调用方）：
#   /legacy -> {"data": [{"text", "type"}]}        # 本项目 route.js 根地址模式
#   /segment -> {"text", "tokens":[{text,type}], "result":[str]}  # route.js 读 tokens；其它调用方可读 result
#   /batch  -> [{"text", "tokens":[...], "result":[...]}, ...]
#   /health -> {"ok": true, "pythainlp": bool, "status": "ok", "custom_words": n}
# 引擎固定 newmm，不可更换。
# 自定义俗语映射见 custom_dict.txt（THAI_CUSTOM_DICT 可覆盖路径）。

import os
import time
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from seg_utils import load_custom_map, segment as _seg

app = FastAPI(title="Thai Segment Service", version="1.1.0")

# ---------- 配置 ----------
CUSTOM_DICT_PATH = os.getenv("THAI_CUSTOM_DICT", "/app/custom_dict.txt")
CUSTOM_MAP = load_custom_map(CUSTOM_DICT_PATH)
_dict_loaded_at = time.time()
DICT_RELOAD_MS = int(os.getenv("DICT_RELOAD_MS", "3600000"))  # 1h 自动重载


def _get_map():
    global CUSTOM_MAP, _dict_loaded_at
    if time.time() - _dict_loaded_at > DICT_RELOAD_MS / 1000:
        CUSTOM_MAP = load_custom_map(CUSTOM_DICT_PATH)
        _dict_loaded_at = time.time()
    return CUSTOM_MAP


# ---------- 请求模型 ----------
class SegmentReq(BaseModel):
    text: str
    engine: Optional[str] = "newmm"  # 固定 newmm，保留字段兼容旧调用


# ---------- 分词（带兜底） ----------
def _segment_safe(text: str, engine: str = "newmm"):
    try:
        return _seg(text, engine=engine, custom_map=_get_map())
    except Exception as e:
        print(f"[thai-segment] pythainlp error: {e}")
        return [{"text": text, "type": "word"}]


# ---------- 路由 ----------
@app.get("/health")
def health():
    return {
        "ok": True,
        "pythainlp": True,
        "status": "ok",
        "custom_dict": CUSTOM_DICT_PATH,
        "custom_words": len(CUSTOM_MAP),
    }


@app.post("/segment")
def segment(req: SegmentReq):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is empty")
    tokens = _segment_safe(req.text, req.engine)
    return {
        "text": req.text,
        "tokens": tokens,                       # 本项目 route.js 读取（{text,type} 对象）
        "result": [t["text"] for t in tokens],  # 兼容其它调用方期望的纯字符串列表
    }


@app.post("/batch")
def batch(reqs: List[SegmentReq]):
    out = []
    for r in reqs:
        toks = _segment_safe(r.text, r.engine) if r.text and r.text.strip() \
            else [{"text": r.text, "type": "word"}]
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
    tokens = _segment_safe(req.text, req.engine)
    return {"data": [{"text": t["text"], "type": t["type"]} for t in tokens]}
