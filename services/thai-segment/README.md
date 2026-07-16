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

部署后在前端项目环境变量中设置（填**服务根地址**即可，`/api/thai-segment` 会自动补 `/legacy`）：

```env
THAI_SEGMENT_SERVICE_URL=https://thai.yourdomain.com
# 也可以直接填完整端点：https://thai.yourdomain.com/legacy
```

Next.js `/api/thai-segment` 会自动调用该服务；服务不可用时降级为前端 JS 分词器。

## 在 宝塔(Baota) + 谷歌云 e2-micro 上部署

详见同目录 `deploy-baota.md`（中文逐步教程），要点：

1. 谷歌云防火墙放开 80/443（以及临时 8888 用于登录宝塔）。
2. 宝塔 → 软件商店 安装 **Nginx** 与 **Python 项目管理器**。
3. 把本目录代码放到 `/www/wwwroot/thai-segment`（建议 `git clone` 整个仓库后指向子目录）。
4. Python 项目管理器：添加 3.11 版本 → 新建项目（框架=其他 / 启动方式=uvicorn / 启动文件=`main:app` / 端口=`8000`）。
5. SSH 进服务器跑一次分词触发 PyThaiNLP 数据下载（首次约数百 MB）。
6. 宝塔 → 网站 → 添加站点（域名或 IP）→ 反向代理到 `http://127.0.0.1:8000`。
7. 设好域名 A 记录 + Let's Encrypt SSL。
8. Vercel 环境变量加 `THAI_SEGMENT_SERVICE_URL=https://你的域名`。

e2-micro 只有 1GB 内存，装包/下载数据时建议先加 2GB swap（`setup-swap.sh`）。
