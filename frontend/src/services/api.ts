import axios from 'axios';

// 始终使用相对路径，通过 Vite 代理访问后端 API
// 这样在 Cloudflare 代理下也能正常工作
const API_BASE = '/api/v1';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器 - 自动添加 token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 响应拦截器 - 处理 401 错误
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            // 刷新页面，触发登录
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Types
export interface Tenant {
    id: number;
    name: string;
    tenant_id: string;
    client_id: string;
    domain?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface TenantCreate {
    name: string;
    tenant_id: string;
    client_id: string;
    client_secret: string;
    domain?: string;
}

export interface TenantSummary {
    id: number;
    name: string;
    tenant_id: string;
    display_name?: string;
    user_count: number;
    active_users: number;
    total_licenses: number;
    consumed_licenses: number;
    license_usage_percent: number;
    is_connected: boolean;
    error?: string;
}

export interface DashboardStats {
    total_tenants: number;
    connected_tenants: number;
    error_tenants: number;
    total_users: number;
    active_users: number;
    total_licenses: number;
    consumed_licenses: number;
    license_usage_percent: number;
    last_updated: string;
}

export interface M365User {
    id: string;
    displayName?: string;
    userPrincipalName?: string;
    mail?: string;
    accountEnabled?: boolean;
    createdDateTime?: string;
    jobTitle?: string;
    department?: string;
}

export interface License {
    skuId: string;
    skuPartNumber: string;
    consumedUnits: number;
    enabledUnits: number;
    availableUnits: number;
}

// Dashboard API
export const dashboardApi = {
    getStats: () => api.get<DashboardStats>('/dashboard'),
    getTenantSummaries: () => api.get<TenantSummary[]>('/dashboard/tenants'),
    refresh: () => api.get<DashboardStats>('/dashboard/refresh'),
};

// Tenant API
export const tenantApi = {
    list: () => api.get<Tenant[]>('/tenants'),
    get: (id: number) => api.get<Tenant>(`/tenants/${id}`),
    create: (data: TenantCreate) => api.post<Tenant>('/tenants', data),
    update: (id: number, data: Partial<Tenant>) => api.patch<Tenant>(`/tenants/${id}`, data),
    delete: (id: number) => api.delete(`/tenants/${id}`),
    getSummary: (id: number) => api.get<TenantSummary>(`/tenants/${id}/summary`),
    testConnection: (id: number) => api.post(`/tenants/${id}/test-connection`),
};

// Users API
export const usersApi = {
    list: (tenantId: number, params?: { top?: number; search?: string }) =>
        api.get<M365User[]>(`/users/${tenantId}`, { params }),
    get: (tenantId: number, userId: string) =>
        api.get<M365User>(`/users/${tenantId}/${userId}`),
    create: (tenantId: number, data: any) =>
        api.post(`/users/${tenantId}`, data),
    update: (tenantId: number, userId: string, data: any) =>
        api.patch(`/users/${tenantId}/${userId}`, data),
    delete: (tenantId: number, userId: string) =>
        api.delete(`/users/${tenantId}/${userId}`),
    invite: (tenantId: number, data: { email: string; redirect_url?: string }) =>
        api.post(`/users/${tenantId}/invite`, data),
    bulkImport: (tenantId: number, users: any[]) =>
        api.post(`/users/${tenantId}/bulk-import`, users),
    getLicenses: (tenantId: number, userId: string) =>
        api.get(`/users/${tenantId}/${userId}/licenses`),
};

// Licenses API
export const licensesApi = {
    list: (tenantId: number) => api.get<License[]>(`/licenses/${tenantId}`),
    getSummary: (tenantId: number) => api.get(`/licenses/${tenantId}/summary`),
    assign: (tenantId: number, userId: string, skuId: string) =>
        api.post(`/licenses/${tenantId}/assign`, { user_id: userId, sku_id: skuId }),
    remove: (tenantId: number, userId: string, skuId: string) =>
        api.post(`/licenses/${tenantId}/remove`, { user_id: userId, sku_id: skuId }),
};

// Groups API
export const groupsApi = {
    list: (tenantId: number) => api.get(`/groups/${tenantId}`),
    get: (tenantId: number, groupId: string) => api.get(`/groups/${tenantId}/${groupId}`),
    getMembers: (tenantId: number, groupId: string) =>
        api.get(`/groups/${tenantId}/${groupId}/members`),
    create: (tenantId: number, data: any) => api.post(`/groups/${tenantId}`, data),
    delete: (tenantId: number, groupId: string) => api.delete(`/groups/${tenantId}/${groupId}`),
    getRoles: (tenantId: number) => api.get(`/groups/${tenantId}/roles`),
};

// Domains API
export const domainsApi = {
    list: (tenantId: number) => api.get(`/domains/${tenantId}`),
    get: (tenantId: number, domainId: string) => api.get(`/domains/${tenantId}/${domainId}`),
    getVerificationRecords: (tenantId: number, domainId: string) =>
        api.get(`/domains/${tenantId}/${domainId}/verification-records`),
};

// Audit API
export const auditApi = {
    getSignIns: (tenantId: number, params?: { top?: number; days?: number }) =>
        api.get(`/audit/${tenantId}/sign-ins`, { params }),
    getDirectoryAudits: (tenantId: number, params?: { top?: number; days?: number }) =>
        api.get(`/audit/${tenantId}/directory`, { params }),
    getLocalLogs: (params?: { tenant_id?: number; limit?: number }) =>
        api.get('/audit/local', { params }),
};

// Health API
export const healthApi = {
    getStatus: (tenantId: number) => api.get(`/health/${tenantId}`),
    getIssues: (tenantId: number) => api.get(`/health/${tenantId}/issues`),
    getMessages: (tenantId: number) => api.get(`/health/${tenantId}/messages`),
};

// Reports API
export const reportsApi = {
    exportUsersCSV: (tenantId: number) =>
        api.get(`/reports/${tenantId}/users/csv`, { responseType: 'blob' }),
    exportLicensesCSV: (tenantId: number) =>
        api.get(`/reports/${tenantId}/licenses/csv`, { responseType: 'blob' }),
    exportUserLicensesCSV: (tenantId: number) =>
        api.get(`/reports/${tenantId}/user-licenses/csv`, { responseType: 'blob' }),
    exportGroupsCSV: (tenantId: number) =>
        api.get(`/reports/${tenantId}/groups/csv`, { responseType: 'blob' }),
};

// Auth API
export const authApi = {
    login: (username: string, password: string) =>
        api.post('/auth/login', { username, password }),
    register: (data: { username: string; email: string; password: string }) =>
        api.post('/auth/register', data),
    getMe: () => api.get('/auth/me'),
    changePassword: (currentPassword: string, newPassword: string) =>
        api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
    checkAuthStatus: () => api.get('/auth/check'),
};
// Health Report API
export const healthReportApi = {
    getUsage: (tenantId: number) => api.get(`/health-report/${tenantId}/usage`),
    getLicenseCompliance: (tenantId: number) => api.get(`/health-report/${tenantId}/license-compliance`),
    getSecurityAlerts: (tenantId: number) => api.get(`/health-report/${tenantId}/security-alerts`),
    getSecureScore: (tenantId: number) => api.get(`/health-report/${tenantId}/secure-score`),
    getSummary: (tenantId: number) => api.get(`/health-report/${tenantId}/summary`),
};

// Report Center API
export const reportCenterApi = {
    getUserOverview: (tenantId: number) => api.get(`/report-center/${tenantId}/users/overview`),
    getDisabledUsers: (tenantId: number) => api.get(`/report-center/${tenantId}/users/disabled`),
    getGuestUsers: (tenantId: number) => api.get(`/report-center/${tenantId}/users/guests`),
    getRecentUsers: (tenantId: number, days?: number) =>
        api.get(`/report-center/${tenantId}/users/recent`, { params: { days } }),
    getAdminUsers: (tenantId: number) => api.get(`/report-center/${tenantId}/users/admins`),
    getLicenseOverview: (tenantId: number) => api.get(`/report-center/${tenantId}/licenses/overview`),
    getUnlicensedUsers: (tenantId: number) => api.get(`/report-center/${tenantId}/licenses/unlicensed-users`),
    getLicensedUsers: (tenantId: number) => api.get(`/report-center/${tenantId}/licenses/licensed-users`),
    getSecurityOverview: (tenantId: number) => api.get(`/report-center/${tenantId}/security/overview`),
    getMfaDetails: (tenantId: number) => api.get(`/report-center/${tenantId}/security/mfa-details`),
    // Exchange / Mailbox (Phase 2)
    getExchangeOverview: (tenantId: number, period?: string) =>
        api.get(`/report-center/${tenantId}/exchange/overview`, { params: { period } }),
    getExchangeActivity: (tenantId: number, period?: string) =>
        api.get(`/report-center/${tenantId}/exchange/activity`, { params: { period } }),
    getExchangeAppUsage: (tenantId: number, period?: string) =>
        api.get(`/report-center/${tenantId}/exchange/app-usage`, { params: { period } }),
    // Teams (Phase 3)
    getTeamsOverview: (tenantId: number, period?: string) =>
        api.get(`/report-center/${tenantId}/teams/overview`, { params: { period } }),
    getTeamsDeviceUsage: (tenantId: number, period?: string) =>
        api.get(`/report-center/${tenantId}/teams/device-usage`, { params: { period } }),
    // SharePoint (Phase 3)
    getSharePointOverview: (tenantId: number, period?: string) =>
        api.get(`/report-center/${tenantId}/sharepoint/overview`, { params: { period } }),
    // OneDrive (Phase 3)
    getOneDriveOverview: (tenantId: number, period?: string) =>
        api.get(`/report-center/${tenantId}/onedrive/overview`, { params: { period } }),
    // Trends (Phase 4)
    getTrendsStorage: (tenantId: number, period?: string) =>
        api.get(`/report-center/${tenantId}/trends/storage`, { params: { period } }),
    getTrendsActivity: (tenantId: number, period?: string) =>
        api.get(`/report-center/${tenantId}/trends/activity`, { params: { period } }),
    getTrendsSecureScore: (tenantId: number) =>
        api.get(`/report-center/${tenantId}/trends/secure-score`),
};

export default api;

