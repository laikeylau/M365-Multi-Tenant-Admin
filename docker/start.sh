#!/bin/bash
set -e

echo "Starting M365 Multi-Tenant Admin..."

# 启动 Nginx
nginx

# 启动后端
exec uvicorn app.main:app --host 127.0.0.1 --port 8000
