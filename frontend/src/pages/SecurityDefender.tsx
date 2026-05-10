import React, { useEffect, useState, useCallback } from 'react';
import { securityApi } from '../services/api';
import TenantSelector from '../components/TenantSelector';

type Tab = 'alerts' | 'incidents' | 'scores';

const SecurityPage: React.FC = () => {
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [tab, setTab] = useState<Tab>('alerts');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            let res;
            switch (tab) {
                case 'alerts': res = await securityApi.getAlerts(tenantId); break;
                case 'incidents': res = await securityApi.getIncidents(tenantId); break;
                case 'scores': res = await securityApi.getSecureScores(tenantId); break;
            }
            setData(res?.data?.value || []);
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [tenantId, tab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const getSeverityBadge = (sev: string) => {
        const map: Record<string, string> = { high: 'badge-error', medium: 'badge-warning', low: 'badge-success', informational: 'badge-secondary' };
        return <span className={`badge ${map[sev?.toLowerCase()] || 'badge-secondary'}`}>{sev || 'N/A'}</span>;
    };

    return (
        <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>🛡️ Security / Defender 管理</h2>
            <TenantSelector selectedTenant={tenantId} onSelect={setTenantId} />

            <div className="card">
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--gray-200)', paddingBottom: 'var(--space-2)' }}>
                    <button className={`btn ${tab === 'alerts' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('alerts'); setData([]); }}>🚨 安全警报</button>
                    <button className={`btn ${tab === 'incidents' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('incidents'); setData([]); }}>📁 安全事件</button>
                    <button className={`btn ${tab === 'scores' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('scores'); setData([]); }}>📊 安全评分</button>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}
                {loading ? <div className="loading" /> : (
                    <div style={{ overflowX: 'auto' }}>
                        {tab === 'alerts' && (
                            <table className="table">
                                <thead><tr><th>标题</th><th>严重性</th><th>状态</th><th>分类</th><th>检测时间</th></tr></thead>
                                <tbody>
                                    {data.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center' }}>暂无数据</td></tr> : data.map((a: any) => (
                                        <tr key={a.id}>
                                            <td>{a.title}</td>
                                            <td>{getSeverityBadge(a.severity)}</td>
                                            <td><span className={`badge ${a.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>{a.status}</span></td>
                                            <td>{a.classification || '-'}</td>
                                            <td>{a.createdDateTime ? new Date(a.createdDateTime).toLocaleString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {tab === 'incidents' && (
                            <table className="table">
                                <thead><tr><th>名称</th><th>严重性</th><th>状态</th><th>警报数</th><th>创建时间</th></tr></thead>
                                <tbody>
                                    {data.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center' }}>暂无数据</td></tr> : data.map((inc: any) => (
                                        <tr key={inc.id}>
                                            <td>{inc.displayName}</td>
                                            <td>{getSeverityBadge(inc.severity)}</td>
                                            <td><span className={`badge ${inc.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>{inc.status}</span></td>
                                            <td>{inc.alertIds?.length || 0}</td>
                                            <td>{inc.createdDateTime ? new Date(inc.createdDateTime).toLocaleString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {tab === 'scores' && (
                            <table className="table">
                                <thead><tr><th>名称</th><th>分数</th><th>总分</th><th>百分比</th><th>更新时间</th></tr></thead>
                                <tbody>
                                    {data.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center' }}>暂无数据</td></tr> : data.map((s: any) => (
                                        <tr key={s.id}>
                                            <td>{s.displayName}</td>
                                            <td><strong>{s.currentScore}</strong></td>
                                            <td>{s.maxScore}</td>
                                            <td>{s.maxScore > 0 ? Math.round(s.currentScore / s.maxScore * 100) : 0}%</td>
                                            <td>{s.createdDateTime ? new Date(s.createdDateTime).toLocaleDateString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
                <div style={{ marginTop: 'var(--space-2)', color: 'var(--gray-500)', fontSize: 13 }}>共 {data.length} 条记录</div>
            </div>
        </div>
    );
};

export default SecurityPage;
