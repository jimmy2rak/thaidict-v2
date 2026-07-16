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

## 本地运行（开发调试）

```bash
cd services/thai-segment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Docker 部署（推荐，无需装 Python 环境）

镜像在构建期已预下载 PyThaiNLP 词典数据，容器秒起、首次请求不卡。

```bash
cd services/thai-segment
docker compose build      # 首次约 5~15 分钟（需联网下载词典）
docker compose up -d
curl -s -X POST http://127.0.0.1:8000/legacy -H "Content-Type: application/json" -d '{"text":"ของนาฬิกา"}'
```

- `Dockerfile` 使用 `requirements.service.txt`（仅 fastapi/uvicorn/pythainlp，不含无关的 supabase 包）。
- `docker-compose.yml`：容器仅监听 `127.0.0.1:8000`，内存上限 800m，带健康检查。

## 部署建议

- **Railway / Render / Fly.io**：直接 Docker 部署，暴露 8000 端口，记下公网 URL。
- **宝塔 + 谷歌云 e2-micro**：见同目录 `deploy-baota.md`（全程 Docker，只装一个 Docker，不装 Python 环境）。

部署后在前端项目环境变量中设置（填**服务根地址**即可，`/api/thai-segment` 会自动补 `/legacy`）：

```env
THAI_SEGMENT_SERVICE_URL=https://thai.yourdomain.com
# 也可以直接填完整端点：https://thai.yourdomain.com/legacy
```

Next.js `/api/thai-segment` 会自动调用该服务；服务不可用时降级为前端 JS 分词器。

## 在 宝塔(Baota) + 谷歌云 e2-micro 上部署（全程 Docker）

详见同目录 `deploy-baota.md`，要点（**只装一个 Docker，不装 Python 环境**）：

1. 谷歌云防火墙放开 80/443（以及临时 8888 用于登录宝塔）；域名 A 记录指向静态 IP。
2. 宝塔只装 **Nginx**（纯净版），不装 Python 项目管理器。
3. 服务器装 Docker：`curl -fsSL https://get.docker.com | sudo sh`。
4. `git clone` 仓库 → `services/thai-segment` → `docker compose build && docker compose up -d`（构建期自动下载词典，需 swap 防 OOM）。
5. 宝塔 → 网站 → 添加站点（域名或 IP）→ 反向代理到 `http://127.0.0.1:8000` → Let's Encrypt SSL。
6. Vercel 环境变量加 `THAI_SEGMENT_SERVICE_URL=https://你的域名`。

e2-micro 只有 1GB 内存，构建镜像时务必先加 2GB swap（`setup-swap.sh` 或手动 dd）。
