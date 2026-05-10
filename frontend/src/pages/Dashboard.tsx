import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { dashboardApi, DashboardStats, TenantSummary } from '../services/api';

const Dashboard: React.FC = () => {
    const { setPageTitle, setRefreshCallback, setIsRefreshing, isRefreshing } = useApp();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [tenants, setTenants] = useState<TenantSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState<string>('');

    const fetchData = async () => {
        try {
            const [statsRes, tenantsRes] = await Promise.all([
                dashboardApi.getStats(),
                dashboardApi.getTenantSummaries(),
            ]);
            setStats(statsRes.data);
            setTenants(tenantsRes.data);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const statsRes = await dashboardApi.refresh();
            setStats(statsRes.data);
            const tenantsRes = await dashboardApi.getTenantSummaries();
            setTenants(tenantsRes.data);
        } catch (error) {
            console.error('Failed to refresh:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        setPageTitle('多租户仪表盘');
        setRefreshCallback(handleRefresh);
        fetchData();

        return () => {
            setRefreshCallback(undefined);
        };
    }, []);

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    // 根据选择的租户筛选数据
    const filteredTenants = selectedTenant
        ? tenants.filter(t => t.id.toString() === selectedTenant)
        : tenants;

    // 计算筛选后的统计数据
    const displayStats = selectedTenant && filteredTenants.length > 0
        ? {
            total_tenants: 1,
            connected_tenants: filteredTenants[0].is_connected ? 1 : 0,
            total_users: filteredTenants[0].user_count,
            active_users: filteredTenants[0].active_users,
            total_licenses: filteredTenants[0].total_licenses,
            consumed_licenses: filteredTenants[0].consumed_licenses,
            license_usage_percent: filteredTenants[0].license_usage_percent,
            last_updated: stats?.last_updated
        }
        : stats;

    const connectedTenants = filteredTenants.filter((t) => t.is_connected);
    const errorTenants = filteredTenants.filter((t) => !t.is_connected);

    return (
        <div className="page-container">
            {/* Tenant Selector */}
                <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                    <div className="card-body">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">选择租户：</label>
                            <select
                                className="form-select"
                                value={selectedTenant}
                                onChange={(e) => setSelectedTenant(e.target.value)}
                            >
                                <option value="">所有租户（汇总）</option>
                                {tenants.map((tenant) => (
                                    <option key={tenant.id} value={tenant.id.toString()}>
                                        {tenant.name} ({tenant.is_connected ? '已连接' : '未连接'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon primary">🔗</div>
                        <div className="stat-content">
                            <div className="stat-label">租户总数</div>
                            <div className="stat-value">{displayStats?.total_tenants || filteredTenants.length}</div>
                            <div className="stat-sub">
                                <span className="badge badge-success">已连接: {connectedTenants.length}</span>
                                {errorTenants.length > 0 && (
                                    <span className="badge badge-error" style={{ marginLeft: '8px' }}>
                                        错误: {errorTenants.length}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon success">👥</div>
                        <div className="stat-content">
                            <div className="stat-label">
                                用户总数{selectedTenant ? '' : '（所有租户）'}
                            </div>
                            <div className="stat-value">{displayStats?.total_users || 0}</div>
                            <div className="stat-sub">
                                <span className="badge badge-info">启用: {displayStats?.active_users || 0}</span>
                                <span style={{ marginLeft: '8px' }}>
                                    禁用: {(displayStats?.total_users || 0) - (displayStats?.active_users || 0)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon warning">📜</div>
                        <div className="stat-content">
                            <div className="stat-label">
                                许可证总数{selectedTenant ? '' : '（所有租户）'}
                            </div>
                            <div className="stat-value">
                                {displayStats?.total_licenses?.toLocaleString() || 0}
                            </div>
                            <div className="stat-sub">
                                使用率: {displayStats?.license_usage_percent?.toFixed(1) || 0}%
                            </div>
                            <div className="progress" style={{ marginTop: '8px' }}>
                                <div
                                    className={`progress-bar ${(displayStats?.license_usage_percent || 0) > 80
                                        ? 'danger'
                                        : (displayStats?.license_usage_percent || 0) > 60
                                            ? 'warning'
                                            : 'success'
                                        }`}
                                    style={{ width: `${displayStats?.license_usage_percent || 0}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: '#f0f0f0', color: '#666' }}>
                            🕐
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">最后更新</div>
                            <div className="stat-value" style={{ fontSize: 'var(--font-size-lg)' }}>
                                {displayStats?.last_updated
                                    ? new Date(displayStats.last_updated).toLocaleTimeString('zh-CN')
                                    : '--:--:--'}
                            </div>
                            <button
                                className="btn btn-sm btn-primary"
                                style={{ marginTop: '8px' }}
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                            >
                                🔄 自动刷新
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tenant Stats */}
                <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-lg)' }}>
                    {selectedTenant ? '选中租户详情' : '各租户统计'}
                </h3>
                <div className="tenant-grid">
                    {filteredTenants.map((tenant) => (
                        <div key={tenant.id} className="tenant-card">
                            <div className="tenant-card-header">
                                <div
                                    className={`tenant-status ${tenant.is_connected ? 'online' : 'offline'}`}
                                />
                                <span style={{ fontWeight: 500 }}>{tenant.name}</span>
                                <span className="badge badge-info" style={{ marginLeft: 'auto' }}>
                                    {tenant.is_connected ? '已连接' : '未连接'}
                                </span>
                            </div>
                            <div className="tenant-stats">
                                <div className="tenant-stat">
                                    <div className="tenant-stat-label">用户数</div>
                                    <div className="tenant-stat-value">{tenant.user_count}</div>
                                </div>
                                <div className="tenant-stat">
                                    <div className="tenant-stat-label">许可证</div>
                                    <div className="tenant-stat-value">
                                        {tenant.total_licenses.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 'var(--space-3)' }}>
                                <span className="badge badge-success">活跃用户: {tenant.active_users}</span>
                                <span className="badge badge-warning" style={{ marginLeft: '8px' }}>
                                    使用率: {tenant.license_usage_percent?.toFixed(1) || 0}%
                                </span>
                            </div>
                        </div>
                    ))}

                    {filteredTenants.length === 0 && (
                        <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                            <div className="empty-state-icon">🏢</div>
                            <div className="empty-state-title">暂无租户</div>
                            <div className="empty-state-desc">
                                请先添加 Microsoft 365 租户以开始管理
                            </div>
                            <a href="/tenants" className="btn btn-primary">
                                添加租户
                            </a>
                        </div>
                    )}
                </div>
            </div>
    );
};

export default Dashboard;
