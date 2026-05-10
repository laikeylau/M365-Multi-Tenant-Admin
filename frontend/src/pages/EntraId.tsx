import React, { useEffect, useState, useCallback } from 'react';
import { entraApi } from '../services/api';
import TenantSelector from '../components/TenantSelector';

type Tab = 'ca' | 'apps' | 'sps' | 'risky' | 'mfa';

const EntraIdPage: React.FC = () => {
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [tab, setTab] = useState<Tab>('ca');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState<any[]>([]);
    const [search, setSearch] = useState('');

    const fetchData = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            let res;
            switch (tab) {
                case 'ca': res = await entraApi.getConditionalAccessPolicies(tenantId); break;
                case 'apps': res = await entraApi.getApplications(tenantId); break;
                case 'sps': res = await entraApi.getServicePrincipals(tenantId); break;
                case 'risky': res = await entraApi.getRiskyUsers(tenantId); break;
                case 'mfa': res = await entraApi.getMfaRegistration(tenantId); break;
            }
            setData(res?.data?.value || (Array.isArray(res?.data) ? res.data : []));
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [tenantId, tab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = data.filter((item: any) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return JSON.stringify(item).toLowerCase().includes(s);
    });

    return (
        <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>🔐 Entra ID (Azure AD) 管理</h2>
            <TenantSelector selectedTenant={tenantId} onSelect={setTenantId} />

            <div className="card">
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--gray-200)', paddingBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {([['ca', '条件访问'], ['apps', '应用注册'], ['sps', '服务主体'], ['risky', '风险用户'], ['mfa', 'MFA 注册']] as [Tab, string][]).map(([key, label]) => (
                        <button key={key} className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab(key); setSearch(''); setData([]); }}>{label}</button>
                    ))}
                </div>

                <div style={{ marginBottom: 'var(--space-3)' }}>
                    <input className="form-input" placeholder="🔍 搜索..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 400 }} />
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}
                {loading ? <div className="loading" /> : (
                    <div style={{ overflowX: 'auto' }}>
                        {tab === 'ca' && (
                            <table className="table">
                                <thead><tr><th>名称</th><th>状态</th><th>创建时间</th></tr></thead>
                                <tbody>
                                    {filtered.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>暂无数据</td></tr> : filtered.map((p: any) => (
                                        <tr key={p.id}><td>{p.displayName}</td><td><span className={`badge ${p.state === 'enabled' ? 'badge-success' : 'badge-secondary'}`}>{p.state}</span></td><td>{p.createdDateTime ? new Date(p.createdDateTime).toLocaleDateString() : '-'}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {tab === 'apps' && (
                            <table className="table">
                                <thead><tr><th>显示名称</th><th>应用 ID</th><th>创建时间</th></tr></thead>
                                <tbody>
                                    {filtered.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>暂无数据</td></tr> : filtered.map((a: any) => (
                                        <tr key={a.id}><td>{a.displayName}</td><td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.appId}</td><td>{a.createdDateTime ? new Date(a.createdDateTime).toLocaleDateString() : '-'}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {tab === 'sps' && (
                            <table className="table">
                                <thead><tr><th>显示名称</th><th>应用 ID</th><th>类型</th><th>状态</th></tr></thead>
                                <tbody>
                                    {filtered.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>暂无数据</td></tr> : filtered.map((s: any) => (
                                        <tr key={s.id}><td>{s.displayName}</td><td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.appId}</td><td>{s.servicePrincipalType}</td><td><span className={`badge ${s.accountEnabled ? 'badge-success' : 'badge-secondary'}`}>{s.accountEnabled ? '启用' : '禁用'}</span></td></tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {tab === 'risky' && (
                            <table className="table">
                                <thead><tr><th>用户</th><th>风险级别</th><th>上次更新</th></tr></thead>
                                <tbody>
                                    {filtered.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>暂无数据</td></tr> : filtered.map((u: any) => (
                                        <tr key={u.id}><td>{u.userDisplayName || u.userPrincipalName}</td><td><span className={`badge ${u.riskLevel === 'high' ? 'badge-error' : u.riskLevel === 'medium' ? 'badge-warning' : 'badge-secondary'}`}>{u.riskLevel}</span></td><td>{u.riskLastUpdatedDateTime ? new Date(u.riskLastUpdatedDateTime).toLocaleString() : '-'}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {tab === 'mfa' && (
                            <table className="table">
                                <thead><tr><th>用户</th><th>注册状态</th><th>MFA 状态</th><th>方法数</th></tr></thead>
                                <tbody>
                                    {filtered.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>暂无数据</td></tr> : filtered.map((u: any) => (
                                        <tr key={u.id}><td>{u.userDisplayName || u.userPrincipalName}</td><td><span className={`badge ${u.isRegistered ? 'badge-success' : 'badge-warning'}`}>{u.isRegistered ? '已注册' : '未注册'}</span></td><td><span className={`badge ${u.isMfaRegistered ? 'badge-success' : 'badge-warning'}`}>{u.isMfaRegistered ? '已启用' : '未启用'}</span></td><td>{u.methodsRegistered?.length || 0}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
                <div style={{ marginTop: 'var(--space-2)', color: 'var(--gray-500)', fontSize: 13 }}>共 {filtered.length} 条记录</div>
            </div>
        </div>
    );
};

export default EntraIdPage;
