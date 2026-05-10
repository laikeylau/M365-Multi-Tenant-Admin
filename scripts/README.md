# Azure AD 应用自动注册脚本

此目录包含用于自动化创建 Azure AD 应用注册的 PowerShell 脚本。

## 前置要求

1. **PowerShell 5.1+** 或 **PowerShell Core 7+**
2. **Microsoft.Graph PowerShell 模块**（脚本会自动安装）
3. **全局管理员** 或 **应用程序管理员** 权限

## 脚本说明

### 1. Register-M365AdminApp.ps1 (单租户)

在单个租户中创建应用注册并配置所有必要的 API 权限。

```powershell
# 基本用法 - 使用默认设置
.\Register-M365AdminApp.ps1

# 自定义应用名称
.\Register-M365AdminApp.ps1 -AppName "My Custom App"

# 设置密钥有效期为 1 年
.\Register-M365AdminApp.ps1 -SecretValidityYears 1

# 不自动授予管理员同意
.\Register-M365AdminApp.ps1 -GrantAdminConsent $false
```

### 2. Register-M365AdminApp-Batch.ps1 (多租户批量)

从 CSV 文件读取租户列表，批量创建应用注册。

```powershell
# 准备租户列表文件
# 格式: TenantId,TenantName,AdminEmail

# 运行批量处理
.\Register-M365AdminApp-Batch.ps1 -TenantListFile "tenants.csv"
```

**tenants.csv 示例:**
```csv
TenantId,TenantName,AdminEmail
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx,Contoso,admin@contoso.onmicrosoft.com
yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy,Fabrikam,admin@fabrikam.onmicrosoft.com
```

## 配置的 API 权限

### Application 权限 (需管理员同意)

| 权限名称 | 描述 |
|---------|------|
| AuditLog.Read.All | 读取审计日志数据 |
| Directory.Read.All | 读取目录数据 |
| Organization.Read.All | 读取组织信息 |
| Reports.Read.All | 读取使用情况报告 |
| Sites.Read.All | 读取 SharePoint 网站 |
| User.Read.All | 读取所有用户资料 |

### Delegated 权限 (委派权限)

| 权限名称 | 描述 |
|---------|------|
| BookingsAppointment.ReadWrite.All | 读写 Bookings 预约 |
| Calendars.Read | 读取日历 |
| Contacts.Read | 读取联系人 |
| Directory.Read.All | 读取目录 |
| Files.Read.All | 读取文件 |
| Files.ReadWrite.All | 读写文件 |
| Group.Read.All | 读取组 |
| Mail.Read | 读取邮件 |
| MailboxSettings.Read | 读取邮箱设置 |
| Notes.Read.All | 读取 OneNote |
| offline_access | 离线访问 |
| openid | OpenID 登录 |
| People.Read.All | 读取人员 |
| Presence.Read.All | 读取状态 |
| profile | 基本资料 |
| Sites.Read.All | 读取网站 |
| Tasks.ReadWrite | 读写任务 |
| User.Read | 读取当前用户 |
| User.Read.All | 读取所有用户 |

## 输出结果

### 单租户脚本输出

脚本会创建 `app-config-YYYYMMDD-HHMMSS.json` 文件：

```json
{
    "TenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "ClientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "ClientSecret": "xxxxxxxxxxxxx",
    "ObjectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "CreatedAt": "2024-01-01 12:00:00",
    "SecretExpiry": "2026-01-01"
}
```

### 批量脚本输出

脚本会创建 `batch-results-YYYYMMDD-HHMMSS.csv` 文件：

| TenantId | TenantName | Status | ClientId | ClientSecret | SecretExpiry | Error |
|----------|-----------|--------|----------|--------------|--------------|-------|
| xxx... | Contoso | Success | xxx... | xxx... | 2026-01-01 | |
| yyy... | Fabrikam | Failed | | | | 错误信息 |

## 常见问题

### Q: 运行脚本时提示权限不足

确保使用具有以下角色之一的账户登录：
- 全局管理员
- 应用程序管理员

### Q: 如何在没有交互式登录的情况下运行？

对于完全无人值守的自动化，你需要创建一个具有 `Application.ReadWrite.All` 权限的服务主体，然后使用证书认证：

```powershell
Connect-MgGraph -ClientId $ClientId -TenantId $TenantId -CertificateThumbprint $Thumbprint
```

### Q: 如何修改权限列表？

编辑脚本中的 `$ApplicationPermissions` 和 `$DelegatedPermissions` 数组即可。

## 安全提示

⚠️ **重要安全事项：**

1. 客户端密钥只在创建时显示一次，请立即保存
2. 结果文件包含敏感信息，请妥善保管
3. 定期轮换客户端密钥
4. 使用最小权限原则，只授予必要的权限
