#!/usr/bin/env bash
# e2-micro (1GB RAM) 安装 PyThaiNLP 前先加 2GB swap，避免 OOM
set -e
if [ -f /swapfile ]; then
  echo "swapfile 已存在，跳过"
  exit 0
fi
echo "创建 2GB swap..."
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo "done. 当前内存情况："
free -h
