# 在 宝塔(Baota) + 谷歌云 e2-micro 用 Docker 部署泰语分词服务

本服务基于 PyThaiNLP `newmm`，独立运行，前端通过 `THAI_SEGMENT_SERVICE_URL` 调用。
**本教程用 Docker 部署**，不需要在服务器上装 Python / venv / pip 依赖——只需装一个 Docker，其余全在容器里。

e2-micro 只有 **1 核 / 1 GB 内存 / 30 GB 磁盘**，按本教程部署完全够用（newmm 是词典分词，不是深度学习，内存占用小；**构建镜像时需要 swap**，否则 pip 装包装崩）。

---

## 第 0 步：谷歌云网络与静态 IP（一次性）

1. 进入 **VPC 网络 → 外部 IP 地址**，把当前临时的外部 IP 改成 **预留静态 IP**（名称随意）。这样关机重启 IP 不变，Vercel 才能稳定调用。
2. 进入 **VPC 网络 → 防火墙**，确认以下规则允许 `0.0.0.0/0`：
   - `default-allow-http`（tcp:80）
   - `default-allow-https`（tcp:443）
   - 另建一条 `allow-baota`：`tcp:8888`（仅你自己的办公 IP，用完可删；不要用 0.0.0.0/0 暴露宝塔到全网）。
3. 准备一个域名（如 `thai.yourdomain.com`），把 **A 记录**指向这个静态 IP。没有域名也可以先用 IP，但 Let's Encrypt 需要域名才能签发证书。

> 安全提示：宝塔默认用 `http://<IP>:8888/<随机串>` 登录，登录后**立即改端口 + 改用户名密码 + 开启 BasicAuth**（宝塔面板 → 面板设置）。

---

## 第 1 步：登录宝塔，只装 Nginx

1. 浏览器打开 `http://<IP>:8888/<随机串>`，用安装时给的账号登录。
2. 弹出「推荐安装」时**取消**（别装 LNMP 全家桶，占内存）。
3. 进入 **软件商店** → 安装 **Nginx**（纯净版 1.24/1.26 即可，无需 MySQL/PHP）。
   - **不需要**装 Python 项目管理器——Docker 自己管运行时。

---

## 第 2 步：装 Docker（唯一要装的“环境”）

SSH 进服务器（或宝塔「终端」），执行：

```bash
# 一键安装 Docker + docker compose 插件
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker

# 验证
docker --version
docker compose version
```

> 国内服务器若 `get.docker.com` 慢，可换阿里云镜像源：
> `curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo -o /etc/yum.repos.d/docker-ce.repo && sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin`

---

## 第 3 步：拿代码 + 确保有 swap

```bash
# 进入站点目录
cd /www/wwwroot

# 如果还没克隆仓库：
git clone https://github.com/jimmy2rak/thaidict-v2.git
# 如果已经克隆过（你之前手动装过），直接更新：
# cd /www/wwwroot/thaidict-v2 && git pull

cd thaidict-v2/services/thai-segment
```

确认 swap 已生效（你之前已经建好了）：

```bash
free -h          # 应能看到 swap 列（如 2.0G）
swapon --show    # 应能看到 /swapfile active
```

> 没 swap 就补上（e2-micro 构建镜像会 OOM）：
> ```bash
> sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
> sudo chmod 600 /swapfile
> sudo mkswap /swapfile
> sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

---

## 第 4 步：构建镜像并启动容器

```bash
# 构建镜像（会预下载 PyThaiNLP 词典数据，e2-micro 上约 5~15 分钟，耐心等）
docker compose build

# 后台启动
docker compose up -d

# 看日志（首次启动会初始化，稍等几十秒）
docker compose logs -f
```

构建完成后词典数据已固化进镜像，容器**秒起**，首次请求也不会卡。

本地验证（容器在 127.0.0.1:8000 监听）：

```bash
curl -s -X POST http://127.0.0.1:8000/legacy \
  -H "Content-Type: application/json" \
  -d '{"text":"ของนาฬิกา ควบคุมราคาสินค้า"}'
# 期望：{"data":[{"text":"ของ"},{"text":"นาฬิกา"},{"text":" "},{"text":"ควบคุม"},{"text":"ราคา"},{"text":"สินค้า"}]}
```

健康检测：

```bash
curl -s http://127.0.0.1:8000/health
# 期望：{"ok":true,"pythainlp":true}
```

日常运维：

```bash
docker compose ps          # 看状态
docker compose restart     # 重启
docker compose down        # 停止并删容器（镜像保留）
docker compose build && docker compose up -d   # 升级（改了代码后）
```

---

## 第 5 步：宝塔 Nginx 反向代理（对外暴露 + HTTPS）

1. 宝塔 → **网站 → 添加站点**：
   - 域名：`thai.yourdomain.com`（没有域名就填服务器公网 IP，但无法用 HTTPS）。
   - 不创建 FTP / 不创建数据库。
2. 进入该站点 → **反向代理 → 添加反向代理**：
   - 代理名称：`thai-segment`
   - 目标 URL：`http://127.0.0.1:8000`
   - 发送域名：`thai.yourdomain.com`
   - 保存。此后 `https://thai.yourdomain.com/segment`、`/legacy`、`/health` 都会转发到容器。
3. 若用域名：站点 → **SSL → Let's Encrypt** 申请免费证书，勾选「强制 HTTPS」。

再次用公网域名验证：

```bash
curl -s -X POST https://thai.yourdomain.com/legacy \
  -H "Content-Type: application/json" \
  -d '{"text":"มีประสิทธิภาพสูง"}'
```

---

## 第 6 步：前端接上（Vercel 环境变量）

在 Vercel 项目 **Settings → Environment Variables** 增加：

```
THAI_SEGMENT_SERVICE_URL=https://thai.yourdomain.com
```

> 填**服务根地址**即可（不要带 `/segment`）。`/api/thai-segment` 会自动补 `/legacy`。
> 想直接填完整端点也行：`https://thai.yourdomain.com/legacy`。

改完 **Redeploy** 一次。之后所有例句分词优先走 PyThaiNLP，分词质量从 `ของนาฬิกา`→`ของ+นาฬิกา` 这类都正确。

---

## 第 7 步：回填旧数据（可选）

> 回填脚本 `scripts/segment_existing_data.py` **直接 `import pythainlp`**，所以跑它的环境必须装 pythainlp（容器本身不需要）。
> **推荐在你本机（Mac/本地）跑**，不动服务器、不重复下载词典：

```bash
cd thaidict-v2/scripts
python3 -m venv venv && source venv/bin/activate
pip install pythainlp supabase python-dotenv
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=xxxx
DRY_RUN=1 ONLY_EMPTY=1 python3 segment_existing_data.py   # 先只看日志，不写库
ONLY_EMPTY=1 python3 segment_existing_data.py            # 确认无误后正式写回
```

> 若坚持在 GCP 服务器跑：先确保 swap 生效，再 `pip install pythainlp supabase python-dotenv`（会再下载一次词典，约数百 MB）。

---

## 排错

- **502 Bad Gateway**：Nginx 起了但容器没起。查 `docker compose ps` 和 `docker compose logs`；确认 8000 在监听（`ss -ltnp | grep 8000`）。
- **分词返回整句不拆**：PyThaiNLP 数据没下全。重跑 `docker compose build`（构建脚本会重新下载）。
- **OOM / 构建卡死**：确认第 3 步 swap 已生效（`free -h` 看到 swap）。
- **拉镜像/依赖慢**：可给 Docker 配国内镜像加速（阿里云容器镜像服务 → 镜像加速器）。
- **宝塔进不去**：防火墙是否放了 8888；`bt 14` 看面板地址，`bt 5` 改端口。
- **域名无法访问**：A 记录是否生效；谷歌云防火墙是否放 80/443。
