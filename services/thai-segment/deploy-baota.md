# 在 宝塔(Baota) + 谷歌云 e2-micro 部署泰语分词服务

本服务基于 PyThaiNLP `newmm`，独立运行，前端通过 `THAI_SEGMENT_SERVICE_URL` 调用。
e2-micro 只有 **1 核 / 1 GB 内存 / 30 GB 磁盘**，按本教程部署完全够用（newmm 是词典分词，不是深度学习，内存占用小；主要注意安装/下载数据时加 swap）。

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

## 第 1 步：登录宝塔，安装软件

1. 浏览器打开 `http://<IP>:8888/<随机串>`，用安装时给的账号登录。
2. 弹出「推荐安装」时**取消**（别装 LNMP 全家桶，占内存）。
3. 进入 **软件商店**：
   - 安装 **Nginx**（选纯净版 1.24/1.26 即可，无需 MySQL/PHP）。
   - 安装 **Python 项目管理器**（搜索「Python」→ 安装）。
   - 可选：安装 **堡塔应用防火墙** 或 **fail2ban**（免费版够用）。

---

## 第 2 步：上传服务代码

推荐用 git，方便以后 `git pull` 升级：

```bash
# 在宝塔「终端」或本地 SSH 进服务器执行
cd /www/wwwroot
git clone https://github.com/jimmy2rak/thaidict-v2.git
# 服务代码在 thaidict-v2/services/thai-segment
```

服务目录实际路径为：`/www/wwwroot/thaidict-v2/services/thai-segment`
（没有 git 也可以：宝塔「文件」→ 上传本目录的 zip → 解压到 `/www/wwwroot/thai-segment`）。

---

## 第 3 步：安装 Python + 依赖（关键：先加 swap）

e2-micro 内存小，`pip install pythainlp` 可能 OOM。先加 2 GB swap：

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# 开机自动挂载（可选）
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

然后在宝塔 **Python 项目管理器 → 版本管理 → 安装 3.11**（等待安装完成）。

新建项目：
- 项目名称：`thai-segment`
- 路径：`/www/wwwroot/thaidict-v2/services/thai-segment`
- Python 版本：`3.11`
- 框架：`其他`（或 FastAPI，不同版本叫法不同）
- 启动方式：`uvicorn`
- 启动文件 / 启动命令：`main:app`
- 端口：`8000`
- 勾选「开机启动」

点击「创建」，宝塔会自动建 venv 并执行 `pip install -r requirements.txt`。

> 若宝塔 Python 管理器版本较旧、识别不到 `main:app`，改用第 6 步的 systemd 方式手动跑，更稳。

---

## 第 4 步：触发 PyThaiNLP 数据下载（首次约数百 MB）

SSH 进服务器，进入项目 venv 跑一次分词即可自动下载词典：

```bash
cd /www/wwwroot/thaidict-v2/services/thai-segment
source venv/bin/activate        # 宝塔的 venv 路径一般是 项目目录下 venv/
python -c "from pythainlp.tokenize import word_tokenize; print(word_tokenize('ของนาฬิกา ควบคุมราคาสินค้า', engine='newmm'))"
```

看到正确输出 `['ของ', 'นาฬิกา', ' ', 'ควบคุม', 'ราคา', 'สินค้า']` 即成功。
下载过一次后会缓存在 `~/.cache/pythainlp/`，之后秒起。

本地手动验证服务：

```bash
curl -s -X POST http://127.0.0.1:8000/legacy \
  -H "Content-Type: application/json" \
  -d '{"text":"ของนาฬิกา"}'
# 期望返回 {"data":[{"text":"ของ",...},{"text":"นาฬิกา",...}]}
```

---

## 第 5 步：宝塔 Nginx 反向代理（对外暴露）

1. 宝塔 → **网站 → 添加站点**：
   - 域名：`thai.yourdomain.com`（没有域名就填服务器公网 IP，但无法用 HTTPS）。
   - 不创建 FTP / 不创建数据库。
2. 进入该站点 → **反向代理 → 添加反向代理**：
   - 代理名称：`thai-segment`
   - 目标 URL：`http://127.0.0.1:8000`
   - 发送域名：`thai.yourdomain.com`
   - 保存。这样 `https://thai.yourdomain.com/segment`、`/legacy`、`/health` 都会转发到后端。
3. 若用域名：站点 → **SSL → Let's Encrypt** 申请免费证书，勾选「强制 HTTPS」。

再次验证（用公网域名）：

```bash
curl -s -X POST https://thai.yourdomain.com/legacy \
  -H "Content-Type: application/json" \
  -d '{"text":"มีประสิทธิภาพสูง"}'
```

---

## 第 6 步（可选，更稳）：用 systemd 跑服务

如果宝塔 Python 管理器不稳定，用系统服务托管（先去宝塔把第 3 步建的项目删掉，避免端口冲突）。

1. 把本目录的 `thai-segment.service` 放到 `/etc/systemd/system/`：
   ```bash
   sudo cp /www/wwwroot/thaidict-v2/services/thai-segment/thai-segment.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now thai-segment
   sudo systemctl status thai-segment   # 确认 active(running)
   ```
2. 然后照第 5 步配 Nginx 反向代理即可。

---

## 第 7 步：前端接上（Vercel 环境变量）

在 Vercel 项目 **Settings → Environment Variables** 增加：

```
THAI_SEGMENT_SERVICE_URL=https://thai.yourdomain.com
```

> 注意：填**服务根地址**即可（不要带 `/segment`）。`/api/thai-segment` 会自动补 `/legacy`。
> 想直接填完整端点也行：`https://thai.yourdomain.com/legacy`。

改完 **Redeploy** 一次。之后所有例句分词优先走 PyThaiNLP，分词质量从 `ของนาฬิกา`→`ของ+นาฬิกา` 这类都正确。

---

## 第 8 步：回填旧数据（可选）

在能联网 + 能访问 Supabase 的机器（可以是这台服务器）运行：

```bash
cd /www/wwwroot/thaidict-v2/scripts
export SUPABASE_URL=https://xxxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=xxxx
python segment_existing_data.py        # 先 DRY_RUN=1 看日志
# 确认无误后：
python segment_existing_data.py        # 正式写回 dictionary / sentences 的 segmented
```

---

## 排错

- **502 Bad Gateway**：Nginx 起来了但后端没起。查 `systemctl status thai-segment` 或宝塔 Python 管理器日志；确认 8000 端口在监听（`ss -ltnp | grep 8000`）。
- **分词返回整句不拆**：PyThaiNLP 没装上 / 数据没下载。重跑第 4 步。
- **OOM / 装包卡死**：确认第 3 步 swap 已生效（`free -h` 看到 swap）。
- **宝塔进不去**：安全组 / 防火墙是否放了 8888；或 `bt 14` 查看面板地址，`bt 5` 改端口。
- **域名无法访问**：A 记录是否生效；谷歌云防火墙是否放 80/443。
