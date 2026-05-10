#!/bin/bash

# M365 Admin - 一键启动脚本
# 在一个终端同时运行前端和后端

cd /root/M365-Multi-Tenant-Admin

echo "================================================"
echo "  启动 M365 多租户管理平台"
echo "================================================"

# 启动后端（后台运行）
echo "[1/2] 启动后端服务..."
cd backend
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "后端已启动 (PID: $BACKEND_PID)"

# 等待后端启动
sleep 3

# 启动前端（前台运行）
echo "[2/2] 启动前端服务..."
cd ../frontend
npm run dev -- --host

# 当前端退出时，清理后端进程
echo "正在停止后端服务..."
kill $BACKEND_PID 2>/dev/null
echo "服务已全部停止"
