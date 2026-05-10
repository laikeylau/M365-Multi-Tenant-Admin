import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { licensesApi, tenantApi, License, Tenant } from '../services/api';

const LicensesPage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [licenses, setLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        fetchTenants();
    }, []);

    useEffect(() => {
        if (selectedTenant) {
            fetchLicenses();
        }
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

    const fetchLicenses = async () => {
        if (!selectedTenant) return;
        setLoading(true);
        try {
            const [licensesRes, summaryRes] = await Promise.all([
                licensesApi.list(selectedTenant),
                licensesApi.getSummary(selectedTenant),
            ]);
            setLicenses(licensesRes.data);
            setSummary(summaryRes.data);
        } catch (error) {
            console.error('Failed to fetch licenses:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        
            <div className="page-container">
                <div className="page-header">
                    <h2 className="page-title">许可证管理</h2>
                </div>

                {/* Tenant Selector */}
                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <div className="card-body">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">选择租户</label>
                            <select
                                className="form-select"
                                value={selectedTenant || ''}
                                onChange={(e) => setSelectedTenant(Number(e.target.value))}
                            >
                                <option value="">选择租户</option>
                                {tenants.map((tenant) => (
                                    <option key={tenant.id} value={tenant.id}>
                                        {tenant.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                {summary && (
                    <div className="stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
                        <div className="stat-card">
                            <div className="stat-icon primary">📜</div>
                            <div className="stat-content">
                                <div className="stat-label">总许可证</div>
                                <div className="stat-value">{summary.totalLicenses?.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon success">✅</div>
                            <div className="stat-content">
                                <div className="stat-label">已分配</div>
                                <div className="stat-value">{summary.consumedLicenses?.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon warning">📦</div>
                            <div className="stat-content">
                                <div className="stat-label">可用</div>
                                <div className="stat-value">{summary.availableLicenses?.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-content" style={{ width: '100%' }}>
                                <div className="stat-label">使用率</div>
                                <div className="stat-value">{summary.usagePercent}%</div>
                                <div className="progress" style={{ marginTop: '8px' }}>
                                    <div
                                        className={`progress-bar ${summary.usagePercent > 80 ? 'danger' : summary.usagePercent > 60 ? 'warning' : 'success'
                                            }`}
                                        style={{ width: `${summary.usagePercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Licenses Table */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">许可证详情</span>
                    </div>
                    <div className="table-container">
                        {loading ? (
                            <div className="loading">
                                <div className="spinner"></div>
                            </div>
                        ) : licenses.length > 0 ? (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>许可证名称</th>
                                        <th>总数</th>
                                        <th>已使用</th>
                                        <th>可用</th>
                                        <th>使用率</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {licenses.map((license) => {
                                        const usage = license.enabledUnits > 0
                                            ? Math.round((license.consumedUnits / license.enabledUnits) * 100)
                                            : 0;
                                        return (
                                            <tr key={license.skuId}>
                                                <td style={{ fontWeight: 500 }}>{license.skuPartNumber}</td>
                                                <td>{license.enabledUnits.toLocaleString()}</td>
                                                <td>{license.consumedUnits.toLocaleString()}</td>
                                                <td>{license.availableUnits.toLocaleString()}</td>
                                                <td style={{ minWidth: '150px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div className="progress" style={{ flex: 1 }}>
                                                            <div
                                                                className={`progress-bar ${usage > 80 ? 'danger' : usage > 60 ? 'warning' : 'success'
                                                                    }`}
                                                                style={{ width: `${usage}%` }}
                                                            />
                                                        </div>
                                                        <span style={{ minWidth: '40px' }}>{usage}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">📜</div>
                                <div className="empty-state-title">
                                    {selectedTenant ? '暂无许可证数据' : '请先选择租户'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        
    );
};

export default LicensesPage;
