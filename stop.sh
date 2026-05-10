#!/bin/bash

# 停止所有服务
echo "停止 M365 管理平台服务..."

# 停止前端
pkill -f "vite" 2>/dev/null

# 停止后端
pkill -f "uvicorn app.main:app" 2>/dev/null

echo "服务已停止"
