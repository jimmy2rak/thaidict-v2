# Thai Segment Service（PyThaiNLP newmm）

本服务为「中泰词典」提供服务端泰语分词，基于 PyThaiNLP 的 `newmm` 引擎，用于：
1. 实时分词兜底（前端分词失败/缺失时）。
2. 批量回填数据库例句的 `segmented` 字段。

## 接口

- `POST /segment` — 单句分词
  ```json
  { "text": "เขาสารภาพโทษ" }
  ```
  返回：
  ```json
  {
    "text": "เขาสารภาพโทษ",
    "tokens": [
      { "text": "เขา", "type": "word" },
      { "text": "สารภาพ", "type": "word" },
      { "text": "โทษ", "type": "word" }
    ]
  }
  ```
- `POST /batch` — 批量分词（回填脚本用）。
- `POST /legacy` — 兼容前端旧结构 `{ data: [...] }`。
- `GET /health` — 健康检查。

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `THAI_SEGMENT_PORT` | 服务端口 | `8000` |
| `THAI_CUSTOM_DICT` | 自定义词典文件路径（每行一词，可选） | — |
| `DICT_CACHE_TTL_MS` | 自定义词典重载间隔 | `300000` |

## 本地运行

```bash
cd services/thai-segment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 部署建议

- **Railway / Render / Fly.io**：Docker 部署，暴露 8000 端口，记下公网 URL。
- **自有服务器**：`docker compose up -d` 或直接 `uvicorn`。

部署后在前端项目环境变量中设置：

```env
THAI_SEGMENT_SERVICE_URL=https://your-service-url.com/segment
```

Next.js `/api/thai-segment` 会自动调用该服务；服务不可用时降级为前端 JS 分词器。
