import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { tenantApi, Tenant, TenantCreate } from '../services/api';

const TenantsPage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState<TenantCreate>({
        name: '',
        tenant_id: '',
        client_id: '',
        client_secret: '',
        domain: '',
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        try {
            const res = await tenantApi.list();
            setTenants(res.data);
        } catch (error) {
            console.error('Failed to fetch tenants:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await tenantApi.create(formData);
            setShowModal(false);
            setFormData({
                name: '',
                tenant_id: '',
                client_id: '',
                client_secret: '',
                domain: '',
            });
            fetchTenants();
        } catch (error) {
            console.error('Failed to create tenant:', error);
            alert('创建租户失败，请检查凭据是否正确');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('确定要删除此租户吗？')) return;
        try {
            await tenantApi.delete(id);
            fetchTenants();
        } catch (error) {
            console.error('Failed to delete tenant:', error);
        }
    };

    const handleTestConnection = async (id: number) => {
        try {
            const res = await tenantApi.testConnection(id);
            alert(res.data.success ? '连接成功！' : `连接失败: ${res.data.message}`);
        } catch (error) {
            alert('连接测试失败');
        }
    };

    return (
        
            <div className="page-container">
                <div className="page-header">
                    <h2 className="page-title">多租户管理</h2>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        + 添加租户
                    </button>
                </div>

                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                ) : tenants.length > 0 ? (
                    <div className="card">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>租户 ID</th>
                                        <th>域名</th>
                                        <th>状态</th>
                                        <th>创建时间</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tenants.map((tenant) => (
                                        <tr key={tenant.id}>
                                            <td style={{ fontWeight: 500 }}>{tenant.name}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                                {tenant.tenant_id}
                                            </td>
                                            <td>{tenant.domain || '-'}</td>
                                            <td>
                                                <span className={`badge ${tenant.is_active ? 'badge-success' : 'badge-error'}`}>
                                                    {tenant.is_active ? '活跃' : '禁用'}
                                                </span>
                                            </td>
                                            <td>{new Date(tenant.created_at).toLocaleDateString('zh-CN')}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => handleTestConnection(tenant.id)}
                                                    >
                                                        测试连接
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => handleDelete(tenant.id)}
                                                    >
                                                        删除
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="empty-state">
                            <div className="empty-state-icon">🏢</div>
                            <div className="empty-state-title">暂无租户</div>
                            <div className="empty-state-desc">
                                点击上方按钮添加您的第一个 Microsoft 365 租户
                            </div>
                            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                                + 添加租户
                            </button>
                        </div>
                    </div>
                )}

                {/* Add Tenant Modal */}
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">添加 M365 租户</h3>
                                <button className="modal-close" onClick={() => setShowModal(false)}>
                                    ×
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label className="form-label">租户名称 *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="例如：总部租户"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tenant ID *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                            value={formData.tenant_id}
                                            onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Client ID *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Azure AD 应用的 Client ID"
                                            value={formData.client_id}
                                            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Client Secret *</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            placeholder="Azure AD 应用的 Client Secret"
                                            value={formData.client_secret}
                                            onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">主域名</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="例如：contoso.onmicrosoft.com"
                                            value={formData.domain}
                                            onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowModal(false)}
                                    >
                                        取消
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? '添加中...' : '添加租户'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        
    );
};

export default TenantsPage;
