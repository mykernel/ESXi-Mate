#!/bin/bash

# 激活虚拟环境（可选）
if [ -d "venv" ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

# 启动 FastAPI 服务
echo "🚀 Starting ESXi-Mate Backend Server..."
python main.py
