#!/usr/bin/env bash
# 一键将 .env.local 导入 Vercel 环境变量
# 前置：npm i -g vercel && vercel login
set -e
cd "$(dirname "$0")/.."
if [ ! -f .env.local ]; then
  echo "❌ 未找到 .env.local，请先复制 .env.example 为 .env.local 并填入真实密钥"
  exit 1
fi
vercel env import .env.local
echo "✅ 已导入 Vercel 环境变量。"
echo "   也可在 Vercel Dashboard → Settings → Environment Variables → Import from .env 直接上传 .env.local"
