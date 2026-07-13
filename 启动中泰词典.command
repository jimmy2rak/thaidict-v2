#!/bin/zsh
# =====================================================================
#  中泰词典（ThaiDict）· 一键启动脚本
# ---------------------------------------------------------------------
#  用法：直接【双击】本文件即可。
#  它会自动完成：进入项目目录 → 检查环境 → 安装依赖(首次) →
#              启动本地开发服务器 → 打开浏览器 http://localhost:3000
#  想停止运行：回到这个黑色终端窗口，按 Control + C，或直接关闭窗口。
# =====================================================================

# 遇到错误不要立刻退出，方便把提示留在屏幕上给你看
set +e

# ---- 0. 一些颜色，让提示更好看 ----
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

echo ""
echo "${BLUE}==================================================${NC}"
echo "${BLUE}        中泰词典 ThaiDict · 一键启动${NC}"
echo "${BLUE}==================================================${NC}"
echo ""

# ---- 1. 切换到脚本所在目录（也就是项目根目录）----
# 无论你从哪里双击，都能正确定位到项目
cd "$(dirname "$0")" || { echo "${RED}无法进入项目目录，脚本已退出。${NC}"; read; exit 1; }
PROJECT_DIR="$(pwd)"
echo "${GREEN}[1/5]${NC} 项目目录：$PROJECT_DIR"

# ---- 2. 找到 node / npm（优先使用 WorkBuddy 托管版本）----
# 把托管版 Node 加入 PATH，避免双击启动时找不到命令
MANAGED_NODE_BIN="$HOME/.workbuddy/binaries/node/versions/22.22.2/bin"
if [ -d "$MANAGED_NODE_BIN" ]; then
  export PATH="$MANAGED_NODE_BIN:$PATH"
fi
# 兼容常见的 Homebrew / nvm 安装位置
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "${RED}[错误] 没有找到 Node.js。请先安装 Node.js 后再运行本脚本。${NC}"
  echo "按回车键关闭窗口……"; read; exit 1
fi
echo "${GREEN}[2/5]${NC} Node 版本：$(node -v)   npm 版本：$(npm -v)"

# ---- 3. 检查依赖是否已安装（node_modules）----
if [ ! -d "node_modules" ]; then
  echo "${YELLOW}[3/5]${NC} 首次运行，正在安装依赖（可能需要几分钟，请耐心等待）……"
  npm install
  if [ $? -ne 0 ]; then
    echo "${RED}依赖安装失败，请检查网络后重试。${NC}"
    echo "按回车键关闭窗口……"; read; exit 1
  fi
else
  echo "${GREEN}[3/5]${NC} 依赖已就绪（node_modules 已存在）。"
fi

# ---- 4. 如果 3000 端口已被占用，先释放它 ----
PORT=3000
OCCUPY_PID=$(lsof -ti :$PORT 2>/dev/null)
if [ -n "$OCCUPY_PID" ]; then
  echo "${YELLOW}[4/5]${NC} 端口 $PORT 已被占用（进程 $OCCUPY_PID），正在关闭旧进程……"
  kill -9 $OCCUPY_PID 2>/dev/null
  sleep 1
else
  echo "${GREEN}[4/5]${NC} 端口 $PORT 空闲，可以启动。"
fi

# ---- 5. 启动开发服务器，并在启动后自动打开浏览器 ----
echo "${GREEN}[5/5]${NC} 正在启动开发服务器……"
echo ""
echo "${BLUE}--------------------------------------------------${NC}"
echo "  启动成功后浏览器会自动打开：${GREEN}http://localhost:$PORT${NC}"
echo "  停止运行：在本窗口按 ${YELLOW}Control + C${NC}，或直接关闭窗口。"
echo "${BLUE}--------------------------------------------------${NC}"
echo ""

# 后台等待端口就绪后自动打开浏览器（最多等 30 秒）
(
  for i in $(seq 1 30); do
    if lsof -ti :$PORT >/dev/null 2>&1; then
      sleep 1
      open "http://localhost:$PORT"
      break
    fi
    sleep 1
  done
) &

# 前台运行 dev server（日志会实时打印在窗口里）
npm run dev

# 如果 dev server 意外退出，停在这里让你看到报错信息
echo ""
echo "${YELLOW}开发服务器已停止。按回车键关闭窗口……${NC}"
read
