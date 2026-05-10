# M365 Multi-Tenant Admin Platform

Microsoft 365 多租户管理平台，支持通过 Graph API 统一管理多个 M365 租户。

## 功能特性

- 📊 **仪表盘** - 多租户概览，用户和许可证统计
- 👥 **用户管理** - 用户列表、邀请、批量导入
- 📜 **许可证管理** - 查看和分配许可证
- 👔 **组和角色** - 组管理和角色分配
- 🌐 **域名管理** - 域名配置和验证
- 📋 **审计日志** - 操作日志追踪
- 💚 **服务健康** - M365 服务状态监控
- 📈 **报告导出** - CSV 数据导出

## 技术栈

- **后端**: Python FastAPI + SQLite + Microsoft Graph API
- **前端**: React + TypeScript + Vite
- **部署**: Docker + Docker Compose

## 快速开始

### 前置要求

- Ubuntu 20.04/22.04 或其他 Linux 发行版
- Docker 和 Docker Compose
- Azure AD 应用程序注册（每个租户）

### Azure AD 应用配置

每个要管理的 M365 租户都需要在 Azure AD 中注册一个应用：

1. 登录 [Azure Portal](https://portal.azure.com)
2. 进入 Azure Active Directory > App registrations > New registration
3. 配置应用权限（Application permissions）：
   - `User.Read.All`
   - `Directory.Read.All`
   - `Organization.Read.All`
   - `Reports.Read.All`
   - `ServiceHealth.Read.All`（可选）
4. 创建 Client Secret 并记录
5. 记录 Tenant ID、Client ID、Client Secret

### 部署

```bash
# 克隆项目
git clone <repository-url>
cd M365-Multi-Tenant-Admin

# 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

部署完成后访问: `http://your-server:8000`

### 本地开发

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# 前端
cd frontend
npm install
npm run dev
```

## API 文档

启动后访问 `http://localhost:8000/docs` 查看 Swagger API 文档。

## 目录结构

```
M365-Multi-Tenant-Admin/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI 入口
│   │   ├── config.py         # 配置管理
│   │   ├── database.py       # 数据库连接
│   │   ├── models.py         # 数据模型
│   │   ├── schemas.py        # Pydantic 模式
│   │   ├── routers/          # API 路由
│   │   └── services/         # 业务服务
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # React 组件
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API 服务
│   │   └── styles/          # 样式文件
│   └── package.json
├── Dockerfile
├── docker-compose.yml
├── deploy.sh
└── README.md
```

## 许可证

MIT License
