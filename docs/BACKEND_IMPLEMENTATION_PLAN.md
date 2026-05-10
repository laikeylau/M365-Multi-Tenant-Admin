# M365 多租户管理平台（后端）实施规划（方案 A：应用内轻量增强）

> 目标：在不引入新基础设施（Redis/队列）的前提下，优先补齐**稳定性/安全性/可观测性**底座；再做分页/批量能力；最后完善细粒度权限与审计闭环。  
> 范围：`backend/`（FastAPI + SQLite + Microsoft Graph API）

---

## 0. 现状与设计原则（简要）

### 现状痛点（来自代码现状）
- Graph 调用缺少“可恢复错误”的策略化处理：`GraphClient._request()`直接 `raise_for_status()`；路由层多处 `except Exception` → 500 且返回 `str(e)`（例如 `backend/app/routers/users.py`）。
- 出站 httpx 客户端每次新建，连接池不复用：`async with httpx.AsyncClient()`（`backend/app/services/graph_client.py`）。
- 分页不完整：list API 基本只返回 `value` 列表，丢弃 `@odata.nextLink`，导致前端只能靠 `$top` 或无法继续翻页。
- 输入风险：OData `$filter` 直接拼接 `search`；`update_user` 接受裸 `dict`。
- 权限控制粗：全局 `require_auth`，缺少 tenant-scoped 授权与 action-level 权限。
- 审计写入与事务边界不清：`get_db()`依赖自动 commit，且 `log_action()`内部 commit，难以保证“业务写入 + 审计写入”的一致性。

### 设计原则
- **单一入口治理**：错误、日志、Correlation-ID 在 middleware/exception handler 层统一；Graph 弹性在 service 层统一。
- **安全默认**：不向客户端回传底层异常细节；对外只返回稳定错误码与短消息。
- **渐进演进**：P0/P1/P2 逐步落地；为未来方案 B（Redis/任务队列）预留扩展点（接口与模块边界）。
- **不破坏现有 API**：优先新增“v2 契约”或向后兼容字段（如分页），避免一次性破坏前端。

---

## 1. 架构设计（中间件、服务层封装）

### 1.1 中间件（Middleware）
建议新增目录：`backend/app/middleware/`

1) **Correlation-ID Middleware**
- 行为：
  - 入站读取 `X-Request-ID`；若无则生成 UUID。
  - 写回响应头 `X-Request-ID`。
  - 将 request_id 注入 `request.state.request_id`，供日志/审计/错误响应引用。

2) **Request Logging Middleware（结构化日志）**
- 行为：
  - 记录：method、path、status_code、latency_ms、request_id、user（如果已解析）、tenant_id（若能从 path/参数识别）、client_ip。
  - 对敏感信息脱敏（Authorization、client_secret 等）。
  - 使用 JSON 日志（便于后续接入 ELK/Seq/Datadog）。

> 说明：FastAPI 解析 user 需要依赖注入，middleware 不易直接拿到 Depends 的结果；建议在“认证依赖”或“审计依赖”里把 `user_id/username` 写到 `request.state`，middleware 只负责输出。

### 1.2 统一异常处理（Exception Handlers）
建议新增：`backend/app/errors.py`

目标：
- 统一返回格式（稳定、可机器解析），例如：
  - `code`: 业务/平台错误码（字符串）
  - `message`: 面向用户的短消息（中文）
  - `request_id`: 便于定位
  - `details`: 可选（仅对可安全暴露的校验错误）

覆盖类型：
- `HTTPException`：保留 status_code，但统一 body。
- `RequestValidationError`：输出字段级校验信息（不包含敏感数据）。
- Graph/HTTPX/MSAL 相关异常：映射为 4xx/5xx，并分类（见 P0-1.3）。
- 兜底异常：500 + 固定 message，不回传 `str(e)`。

### 1.3 Graph Service Layer（弹性、并发、分页、批量）
建议拆分：
- `backend/app/services/graph_client.py`：保留 GraphClient，但增强为可注入 httpx client、可插拔重试策略
- 新增 `backend/app/services/graph_resilience.py`：重试/退避/并发控制/错误映射
- 新增 `backend/app/services/graph_batch.py`：$batch 组包/拆包/部分失败聚合

关键能力：
1) **出站重试**
- 重试条件（建议）：
  - HTTP 429（节流）：必须尊重 `Retry-After`（优先 header，其次退避）
  - HTTP 503/504/502/500：指数退避 + 抖动
  - 网络类：timeout、connect error、read error（httpx）
- 不重试：
  - 4xx（除 429）
  - 401/403 通常是权限/凭据问题（可在刷新 token 后重试 1 次，但要谨慎）
- 重试预算：
  - `max_attempts`（如 4）
  - `max_total_sleep_ms` 或 `max_elapsed_ms`
  - 指数退避上限（如 10s）

2) **并发控制**
- 目标：避免同一 tenant 或全局并发把 Graph 打爆导致 429。
- 建议：
  - `tenant_semaphore[tenant_id] = asyncio.Semaphore(N)`（例如 N=4）
  - 可选全局 semaphore（例如 20）

3) **httpx.AsyncClient 复用**
- 目标：连接池复用、降低 TLS/连接开销。
- 方式：
  - 在 `lifespan` 启动创建单例 AsyncClient（或每 tenant 一个，但优先全局一个）
  - GraphClient 使用注入的 httpx client（不要每次 `async with` 新建）

4) **分页封装**
- 目标：让路由层不再手写 `$top/$filter` 且能返回 continuation。
- 方式：
  - GraphClient `list_users(...)` 返回 `{items, next_link}`（或 `{items, next_token}`）
  - 路由支持：
    - `page_size`（替代 top，保留 top 兼容）
    - `next_link` 或 `skip_token`（推荐对外暴露自家 token，内部映射 Graph nextLink，避免前端拿到完整 URL）

5) **$batch**
- 目标：把 `bulk-import` 从逐条 create → 20 条/批，显著减少请求次数与节流。
- 需要：
  - 统一 request_id/operation_id
  - 结果聚合：成功/失败（含原因与可重试标识）

### 1.4 安全与权限（P2 将落地，但 P0 需要预留）
建议新增：
- `backend/app/security/authorization.py`：RBAC/ABAC 策略与依赖（Depends）
- `backend/app/models.py` + `backend/app/schemas.py`：角色/权限/用户-租户绑定模型

策略建议：
- tenant-scoped：用户是否被授权访问 tenant_id（从 DB 映射）
- action-level：如 `tenant:read`、`user:write`、`report:export`
- superuser 拥有全租户权限（但建议仍审计）

### 1.5 审计（P2）
建议新增：
- `backend/app/services/audit_service.py`：审计写入统一入口（不在 router 内 scattered）
- `backend/app/routers/audit.py`：保留查询接口；写入由 service 触发

审计字段建议（最小集）：
- actor_user_id / actor_username
- tenant_id（平台租户记录 ID，非 AAD tenant GUID）
- action（CRUD/EXPORT/LOGIN/TEST_CONNECTION…）
- resource_type/resource_id
- outcome（SUCCESS/FAILURE）
- request_id、ip、user_agent
- error_code（内部）与 error_summary（脱敏）

---

## 2. 文件修改清单（按优先级）

> 说明：以下是“计划需要修改/新增”的文件集合，具体以实现阶段为准。

### P0（立刻提升稳定性/安全性）
- 修改：`backend/app/main.py`（注册 middleware + exception handlers；在 lifespan 初始化共享 httpx client）
- 修改：`backend/app/services/graph_client.py`（复用 AsyncClient；引入重试/并发控制挂钩；错误映射）
- 修改：`backend/app/routers/users.py`（分页契约雏形、输入校验、去除裸 dict）
- 修改：`backend/app/routers/*`（将 `except Exception → HTTPException(500, str(e))` 迁移到统一异常处理；路由只抛业务异常）
- 修改：`backend/app/database.py`（明确事务边界策略：避免依赖层自动 commit 与审计内 commit 冲突；至少统一约定）
- 新增：`backend/app/middleware/correlation_id.py`
- 新增：`backend/app/middleware/request_logging.py`
- 新增：`backend/app/errors.py`（统一错误响应模型、异常映射）
- 新增：`backend/app/services/graph_resilience.py`（retry/backoff/semaphore）

### P1（功能增强：分页、批量）
- 修改：`backend/app/services/graph_client.py`（分页助手、统一 list 返回结构）
- 修改：`backend/app/routers/users.py`（返回 `items + next_token` 或向后兼容）
- 修改：`backend/app/routers/licenses.py` / `groups.py` / `domains.py`（同类 list API 契约一致）
- 新增：`backend/app/services/graph_batch.py`（$batch 组装/解析）
- 修改：`backend/app/routers/users.py`（`bulk-import` 改为 $batch + 并发控制 + 部分失败分类）

### P2（安全与审计）
- 修改：`backend/app/models.py`（新增 Role/Permission/UserTenantAccess/AuditLog 扩展字段与索引）
- 修改：`backend/app/schemas.py`（新增 RBAC/审计 schema、错误响应 schema）
- 修改：`backend/app/routers/auth.py`（在 token 里加入 user_id；或查库后写入 request.state，用于审计）
- 修改：`backend/app/main.py`（对路由分组挂载更细粒度 dependencies）
- 新增：`backend/app/security/authorization.py`
- 新增：`backend/app/services/audit_service.py`
- 修改：`backend/app/routers/audit.py`（查询增强：按 request_id/outcome/action/actor 过滤；写入走 service）

---

## 3. 实施步骤（按 P0/P1/P2）

## P0：立刻提升稳定性/安全性（建议 3–7 天）

### P0-1 统一异常处理机制
1. 定义错误响应格式（ErrorResponse）与错误码枚举（如 `PLATFORM_INTERNAL_ERROR`、`GRAPH_THROTTLED`、`GRAPH_FORBIDDEN`）。
2. 增加异常映射策略：
   - httpx/network → 502/504
   - Graph 429 → 429 + `retry_after_ms`（可选）
   - Graph 401/403 → 401/403（不暴露底层细节）
   - Graph 404 → 404（资源不存在）
3. 在 FastAPI 注册 exception handlers：
   - `HTTPException`
   - `RequestValidationError`
   - 自定义 `GraphAPIError`（建议封装）
   - `Exception` 兜底

**验收标准**
- 任意 Graph 调用失败时，客户端响应不包含 raw `str(e)`、不包含 access token/client_secret。
- 错误响应包含 `request_id` 且在服务端日志可检索到同一 request_id 的完整链路。

### P0-2 结构化日志 + Correlation-ID
1. 实现 Correlation-ID middleware：
   - 读取/生成 request_id
   - 写回响应头
2. 实现 request logging middleware：
   - 输出 JSON 日志
   - 记录 latency 与 status
   - 脱敏 headers/query
3. 在认证依赖（`require_auth` 或其 wrapper）把 `user_id/username` 写入 `request.state`（供日志与审计）

**验收标准**
- 每个请求响应头包含 `X-Request-ID`。
- 日志为 JSON 且包含：`request_id`、`path`、`method`、`status_code`、`latency_ms`。

### P0-3 GraphClient 出站重试与并发控制
1. 引入“Graph 弹性层”：
   - per-tenant semaphore + 可选 global semaphore
   - retry/backoff（含 jitter）与 `Retry-After` 支持
2. 改造 GraphClient：
   - 复用共享 `httpx.AsyncClient`（lifespan 注入/单例）
   - 将 `response.raise_for_status()` 替换为捕获并转换成自定义异常（包含 status_code、graph_error_code、request_id 等）
3. 在多租户汇总（dashboard）场景增加并发上限（避免 `asyncio.gather` 无限制并发）

**验收标准**
- 压测/并发调用时，Graph 429 发生后服务不会快速失败或 retry storm（观察重试次数与退避）。
- 相同场景下平均延迟下降或稳定（httpx client 复用可观测到连接复用）。

### P0-4 修复入参风险（$filter 拼接、裸 dict）
1. `$filter` 拼接：
   - 对 `search` 做严格校验（长度、字符白名单、转义单引号）
   - 或改为固定模板（只允许 startswith），禁止任意表达式
2. `update_user` 裸 dict：
   - 增加 Pydantic schema（只允许可更新字段白名单）
   - 对 mail/UPN 等字段做格式校验
3. 对 `tenant_id`、`user_id` 等 path 参数做更严格类型与格式限制（如 UUID 校验）

**验收标准**
- `search` 包含 `'`、特殊字符时不会导致 500；返回 400 且提示参数非法。
- `update_user` 传入未允许字段时返回 422/400；不会被直接透传到 Graph。

---

## P1：功能增强（分页契约、批量接口）（建议 1–2 周）

### P1-1 分页契约改造
1. 统一 list API 响应结构：
   - `items: []`
   - `next_token: str | null`（推荐）
   - 可选 `total_count`（仅在明确需要且成本可控时）
2. Graph 侧：
   - 解析 `@odata.nextLink`
   - 将 nextLink 映射为自家 `next_token`（例如 base64 编码的 nextLink，或只提取 skiptoken）
3. API 向后兼容策略（两选一）：
   - A) 增加新 endpoint（例如 `GET /users/{tenant_id}/paged`）
   - B) 原 endpoint 增加 query `paged=true` 或 header `X-Response-Mode=paged`

**验收标准**
- 前端可不通过增大 `$top` 实现稳定翻页。
- 翻页过程中不会丢失/重复数据（允许 eventual consistency，但要可预期）。

### P1-2 批量接口设计（Graph $batch）
1. 定义批量 API：
   - `POST /users/{tenant_id}/bulk-import`：
     - 输入：用户列表 + `operation_id`（可选，幂等）
     - 输出：`success[]/failed[]` + 每条失败的 `error_code` 与 `retryable` 标识
2. Graph $batch：
   - 每批最多 20 个子请求
   - 子请求 id 关联原始输入序号，便于回填结果
3. 失败分类与重试策略：
   - 429/5xx/network：retryable=true
   - 4xx 校验/权限：retryable=false

**验收标准**
- 100 用户导入：Graph 请求次数显著减少（约从 100 次降至 5 次 + 重试）。
- 部分失败场景下，返回能定位到具体哪条失败及原因，且不会全体失败。

---

## P2：安全与审计（权限细化、审计完善）（建议 2–4 周）

### P2-1 权限细化模型
1. 数据模型（SQLite 可先落地，后续可迁移）
   - `roles`：角色定义（admin/readonly/superuser…）
   - `permissions`：权限点（tenant:read/user:write…）
   - `role_permissions`：角色-权限映射
   - `user_tenant_access`：用户可访问哪些 tenant（以及角色）
2. 授权依赖（Depends）：
   - `require_tenant_access(tenant_id, permission)`：校验用户对 tenant 的权限
3. 路由挂载策略：
   - `main.py` 继续全局 `require_auth`
   - 每个 router/endpoint 增加更细粒度 dependency（按资源/动作）

**验收标准**
- 非授权用户访问其他 tenant 的资源返回 403（并写审计）。
- readonly 角色无法执行写操作（POST/PATCH/DELETE），返回 403。

### P2-2 审计日志完善
1. 统一审计写入点（service）：
   - 对关键操作（登录、租户增删改、用户/组/许可证变更、报表导出）落审计
2. 审计内容标准化：
   - actor、tenant、action、resource、outcome、request_id、ip、user_agent
3. 事务与一致性：
   - 关键写操作与审计写入同事务提交（或采用 outbox/异步补偿，方案 A 先做同事务）

**验收标准**
- 任意写操作均可在 `/audit/local` 中追溯到：谁在何时对哪个 tenant 做了什么，结果如何。
- 失败的写操作同样有审计记录（outcome=FAILURE，错误脱敏）。

---

## 4. 交付物与验收清单（汇总）

### P0 交付物
- 统一错误响应（包含 request_id）
- JSON 结构化日志 + Correlation-ID
- Graph 调用：重试/退避、并发控制、httpx client 复用
- 输入校验：filter 处理与 update 白名单

### P1 交付物
- list API 分页契约（items + next_token）
- $batch 批量导入（部分失败、可重试标识、幂等建议）

### P2 交付物
- RBAC/tenant-scoped 授权模型与依赖
- 审计写入标准化与查询增强

---

## 5. 非目标（本阶段不做，但需记录）
- 引入 Redis/任务队列（方案 B），但 P0/P1 设计需预留可替换点
- 数据库从 SQLite 迁移到 Postgres（建议后续迭代）
- 全链路指标/Tracing（可在日志稳定后再做 OpenTelemetry）

