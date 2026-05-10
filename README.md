# M365 Multi-Tenant Admin Platform

Microsoft 365 多租户管理平台，支持通过 Graph API 统一管理多个 M365 租户的全部核心服务。

## 功能特性

### 🔐 身份与访问管理 (Entra ID)
- 👥 **用户管理** — 用户列表、邀请、批量导入、编辑、删除
- 👔 **组和角色** — 组管理、成员管理、目录角色分配
- 🆔 **Entra ID** — 条件访问策略、应用注册、服务主体、风险用户、MFA 注册状态
- 🌐 **域名管理** — 域名配置和验证
- 📜 **许可证管理** — 查看和分配许可证

### ⚙️ 服务管理
- 📧 **Exchange Online** — 邮件流规则、邮箱设置（自动回复/转发）、邮件文件夹
- 💬 **Teams 管理** — 团队列表/创建/删除、频道管理、成员查看、标签
- 📁 **SharePoint 管理** — 站点管理、文档库、列表、存储
- 💾 **存储管理** — 邮箱/OneDrive/SharePoint 使用量报告
- 📱 **Intune 设备管理** — 设备列表、合规策略、配置文件、远程操作（擦除/退役/锁定/同步）

### 🛡️ 安全与合规
- 🚨 **Security / Defender** — 安全警报、安全事件、安全评分
- 📋 **Purview 合规** — 保留标签、敏感度标签、DLP 策略

### 📈 监控与报告
- 💚 **服务健康** — M365 服务状态监控
- 📋 **审计日志** — 登录日志、目录审计、操作日志追踪
- 📊 **报表中心** — 用户/许可证/安全/Exchange/Teams/SharePoint 综合报告
- 📈 **报告导出** — CSV 数据导出

### 🏢 系统管理
- 📊 **仪表盘** — 多租户概览，用户和许可证统计
- 🏢 **多租户管理** — 租户注册、连接测试、凭据管理
- ⚙️ **账户设置** — 密码修改、账户信息

## 技术栈

- **后端**: Python FastAPI + SQLite + Microsoft Graph API
- **前端**: React + TypeScript + Vite
- **安全**: JWT 认证 + Fernet 租户凭据加密
- **部署**: Docker + Docker Compose + Nginx
- **脚本**: PowerShell (Azure AD 应用批量注册)

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
   - `Group.ReadWrite.All`
   - `Domain.Read.All`
   - `AuditLog.Read.All`
   - `SecurityEvents.ReadWrite.All`
   - `DeviceManagementManagedDevices.Read.All`
   - `DeviceManagementConfiguration.Read.All`
   - `Team.ReadBasic.All`
   - `TeamSettings.ReadWrite.All`
   - `Channel.ReadBasic.All`
   - `Sites.ReadWrite.All`
   - `MailboxSettings.ReadWrite`
   - `InformationProtectionPolicy.Read.All`
   - `Application.Read.All`
   - `Policy.Read.All`
   - `ServiceHealth.Read.All`（可选）
4. 创建 Client Secret 并记录
5. 记录 Tenant ID、Client ID、Client Secret

### 部署

```bash
# 克隆项目
git clone https://github.com/laikeylau/M365-Multi-Tenant-Admin.git
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
│   │   ├── main.py               # FastAPI 入口
│   │   ├── config.py             # 配置管理
│   │   ├── database.py           # 数据库连接
│   │   ├── deps.py               # 共享依赖
│   │   ├── models.py             # 数据模型
│   │   ├── schemas.py            # Pydantic 模式
│   │   ├── routers/              # API 路由
│   │   │   ├── auth.py           # 认证
│   │   │   ├── dashboard.py      # 仪表盘
│   │   │   ├── tenants.py        # 租户管理
│   │   │   ├── users.py          # 用户管理
│   │   │   ├── licenses.py       # 许可证
│   │   │   ├── groups.py         # 组和角色
│   │   │   ├── domains.py        # 域名
│   │   │   ├── audit.py          # 审计日志
│   │   │   ├── health.py         # 服务健康
│   │   │   ├── reports.py        # 报告导出
│   │   │   ├── storage.py        # 存储管理
│   │   │   ├── exchange.py       # Exchange Online 管理
│   │   │   ├── entra.py          # Entra ID 管理
│   │   │   ├── security_defender.py  # Security/Defender
│   │   │   ├── intune.py         # Intune 设备管理
│   │   │   ├── compliance.py     # Purview 合规
│   │   │   ├── sharepoint_admin.py   # SharePoint 管理
│   │   │   └── teams_admin.py    # Teams 管理
│   │   ├── security/
│   │   │   └── tenant_secrets.py # 租户凭据加密
│   │   └── services/
│   │       ├── graph_client.py   # Graph API 客户端
│   │       └── cache.py          # 缓存服务
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx       # 分组侧边栏导航
│   │   │   └── TenantSelector.tsx # 可复用租户选择器
│   │   ├── pages/                # 21 个页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── Tenants.tsx
│   │   │   ├── Licenses.tsx
│   │   │   ├── Groups.tsx
│   │   │   ├── Domains.tsx
│   │   │   ├── Audit.tsx
│   │   │   ├── Health.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Storage.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── Exchange.tsx      # Exchange Online
│   │   │   ├── EntraId.tsx       # Entra ID
│   │   │   ├── SecurityDefender.tsx # Security/Defender
│   │   │   ├── Intune.tsx        # Intune 设备管理
│   │   │   ├── Compliance.tsx    # Purview 合规
│   │   │   ├── SharePointAdmin.tsx # SharePoint
│   │   │   └── TeamsAdmin.tsx    # Teams
│   │   ├── services/api.ts       # API 服务层
│   │   └── contexts/             # React 上下文
│   └── package.json
├── scripts/                      # PowerShell 脚本
├── docker/                       # Nginx + 部署脚本
├── Dockerfile
├── docker-compose.yml
├── deploy.sh
└── README.md
```

## Graph API 权限一览

| 功能模块 | 所需权限 |
|----------|---------|
| 用户管理 | `User.ReadWrite.All` |
| 组管理 | `Group.ReadWrite.All` |
| 许可证 | `Organization.Read.All` |
| 域名 | `Domain.Read.All` |
| 审计日志 | `AuditLog.Read.All` |
| 服务健康 | `ServiceHealth.Read.All` |
| Exchange | `MailboxSettings.ReadWrite` |
| Entra ID | `Application.Read.All`, `Policy.Read.All`, `IdentityRiskEvent.Read.All` |
| Security | `SecurityEvents.ReadWrite.All`, `SecurityActions.ReadWrite.All` |
| Intune | `DeviceManagementManagedDevices.Read.All`, `DeviceManagementConfiguration.Read.All` |
| 合规 | `InformationProtectionPolicy.Read.All` |
| SharePoint | `Sites.ReadWrite.All` |
| Teams | `Team.ReadBasic.All`, `TeamSettings.ReadWrite.All`, `Channel.ReadBasic.All` |
| 报告 | `Reports.Read.All` |

## 许可证

MIT License
