import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { healthApi, tenantApi, Tenant } from '../services/api';

interface ServiceHealth {
    id: string;
    service: string;
    status: string;
}

const HealthPage: React.FC = () => {
    const { setPageTitle, setRefreshCallback } = useApp();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [healthData, setHealthData] = useState<{ summary: any; services: ServiceHealth[] }>({ summary: null, services: [] });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setPageTitle('服务健康');
        fetchTenants();
    }, []);

    useEffect(() => {
        if (selectedTenant) {
            fetchHealth();
        }
    }, [selectedTenant]);

    useEffect(() => {
        setRefreshCallback(selectedTenant ? fetchHealth : undefined);
        return () => {
            setRefreshCallback(undefined);
        };
    }, [selectedTenant]);

    const fetchTenants = async () => {
        try {
            const res = await tenantApi.list();
            setTenants(res.data);
            if (res.data.length > 0) {
                setSelectedTenant(res.data[0].id);
            }
        } catch (error) {
            console.error('Failed to fetch tenants:', error);
        }
    };

    const fetchHealth = async () => {
        if (!selectedTenant) return;
        setLoading(true);
        try {
            const res = await healthApi.getStatus(selectedTenant);
            setHealthData(res.data);
        } catch (error) {
            console.error('Failed to fetch health:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s.includes('operational') || s === 'serviceonline') return 'badge-success';
        if (s.includes('degradation')) return 'badge-warning';
        if (s.includes('interruption')) return 'badge-error';
        return 'badge-info';
    };

    const getStatusText = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s.includes('operational') || s === 'serviceonline') return '正常运行';
        if (s.includes('degradation')) return '服务降级';
        if (s.includes('interruption')) return '服务中断';
        return status || '未知';
    };

    return (
        <div className="page-container">
            <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <div className="card-body">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">选择租户</label>
                            <select className="form-select" value={selectedTenant || ''} onChange={(e) => setSelectedTenant(Number(e.target.value))}>
                                <option value="">选择租户</option>
                                {tenants.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                            </select>
                        </div>
                    </div>
                </div>

                {healthData.summary && (
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
                        <div className="stat-card">
                            <div className="stat-icon success">✅</div>
                            <div className="stat-content">
                                <div className="stat-label">正常服务</div>
                                <div className="stat-value">{healthData.summary.healthy || 0}</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon warning">⚠️</div>
                            <div className="stat-content">
                                <div className="stat-label">降级服务</div>
                                <div className="stat-value">{healthData.summary.degraded || 0}</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon error">❌</div>
                            <div className="stat-content">
                                <div className="stat-label">中断服务</div>
                                <div className="stat-value">{healthData.summary.unhealthy || 0}</div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Microsoft 365 服务状态</span>
                    </div>
                    <div className="table-container">
                        {loading ? (
                            <div className="loading"><div className="spinner"></div></div>
                        ) : healthData.services.length > 0 ? (
                            <table className="table">
                                <thead><tr><th>服务</th><th>状态</th></tr></thead>
                                <tbody>
                                    {healthData.services.map((svc) => (
                                        <tr key={svc.id}>
                                            <td style={{ fontWeight: 500 }}>{svc.service}</td>
                                            <td><span className={`badge ${getStatusBadge(svc.status)}`}>{getStatusText(svc.status)}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">💚</div>
                                <div className="empty-state-title">{selectedTenant ? '暂无服务健康数据' : '请先选择租户'}</div>
                                <div className="empty-state-desc">需要 ServiceHealth.Read.All 权限</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
    );
};

export default HealthPage;
