# M365 Multi-Tenant Admin - Docker 部署
# 多阶段构建：前端构建 + 后端运行

# ==================== Stage 1: 构建前端 ====================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# 复制前端依赖文件
COPY frontend/package*.json ./

# 安装依赖
RUN npm ci --silent

# 复制前端源码
COPY frontend/ .

# 构建生产版本
RUN npm run build

# ==================== Stage 2: 后端 + Nginx ====================
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖和 Nginx
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制后端依赖
COPY backend/requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ .

# 从构建阶段复制前端静态文件
COPY --from=frontend-builder /frontend/dist /usr/share/nginx/html

# 复制配置文件
COPY docker/nginx.conf /etc/nginx/sites-available/default
COPY docker/start.sh /app/start.sh

# 设置脚本权限并转换行结束符
RUN chmod +x /app/start.sh && \
    sed -i 's/\r$//' /app/start.sh

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# 启动服务
CMD ["/app/start.sh"]
