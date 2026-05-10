import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { domainsApi, tenantApi, Tenant } from '../services/api';

interface Domain {
    id: string;
    isDefault?: boolean;
    isVerified?: boolean;
    isInitial?: boolean;
    status?: string;
    type?: string;
}

const DomainsPage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchTenants();
    }, []);

    useEffect(() => {
        if (selectedTenant) {
            fetchDomains();
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

    const fetchDomains = async () => {
        if (!selectedTenant) return;
        setLoading(true);
        try {
            const res = await domainsApi.list(selectedTenant);
            setDomains(res.data);
        } catch (error) {
            console.error('Failed to fetch domains:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        
            <div className="page-container">
                <div className="page-header">
                    <h2 className="page-title">域名管理</h2>
                </div>

                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <div className="card-body">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">选择租户</label>
                            <select className="form-select" value={selectedTenant || ''} onChange={(e) => setSelectedTenant(Number(e.target.value))}>
                                <option value="">选择租户</option>
                                {tenants.map((tenant) => (<option key={tenant.id} value={tenant.id}>{tenant.name}</option>))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">域名列表</span>
                    </div>
                    <div className="table-container">
                        {loading ? (
                            <div className="loading"><div className="spinner"></div></div>
                        ) : domains.length > 0 ? (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>域名</th>
                                        <th>类型</th>
                                        <th>验证状态</th>
                                        <th>默认</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {domains.map((domain) => (
                                        <tr key={domain.id}>
                                            <td style={{ fontWeight: 500 }}>{domain.id}</td>
                                            <td><span className="badge badge-info">{domain.isInitial ? '初始域' : '自定义域'}</span></td>
                                            <td>
                                                <span className={`badge ${domain.isVerified ? 'badge-success' : 'badge-warning'}`}>
                                                    {domain.isVerified ? '已验证' : '未验证'}
                                                </span>
                                            </td>
                                            <td>{domain.isDefault ? '✅' : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">🌐</div>
                                <div className="empty-state-title">{selectedTenant ? '暂无域名数据' : '请先选择租户'}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        
    );
};

export default DomainsPage;
