import React, { useEffect, useState, useCallback } from 'react';
import { complianceApi } from '../services/api';
import TenantSelector from '../components/TenantSelector';

type Tab = 'retention' | 'sensitivity' | 'dlp';

const CompliancePage: React.FC = () => {
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [tab, setTab] = useState<Tab>('retention');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true); setError('');
        try {
            let res;
            switch (tab) {
                case 'retention': res = await complianceApi.getRetentionLabels(tenantId); break;
                case 'sensitivity': res = await complianceApi.getSensitivityLabels(tenantId); break;
                case 'dlp': res = await complianceApi.getDlpPolicies(tenantId); break;
            }
            setData(res?.data?.value || (Array.isArray(res?.data) ? res.data : []));
        } catch (e: any) { setError(e.response?.data?.detail || e.message); setData([]); }
        finally { setLoading(false); }
    }, [tenantId, tab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>📋 Purview / 合规管理</h2>
            <TenantSelector selectedTenant={tenantId} onSelect={setTenantId} />

            <div className="card">
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--gray-200)', paddingBottom: 'var(--space-2)' }}>
                    <button className={`btn ${tab === 'retention' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('retention'); setData([]); }}>📅 保留标签</button>
                    <button className={`btn ${tab === 'sensitivity' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('sensitivity'); setData([]); }}>🔒 敏感度标签</button>
                    <button className={`btn ${tab === 'dlp' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('dlp'); setData([]); }}>🛡️ DLP 策略</button>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}
                {loading ? <div className="loading" /> : (
                    <div style={{ overflowX: 'auto' }}>
                        {tab === 'retention' && (
                            <table className="table">
                                <thead><tr><th>名称</th><th>描述</th><th>行为类型</th><th>保留期</th></tr></thead>
                                <tbody>
                                    {data.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>暂无数据</td></tr> : data.map((l: any) => (
                                        <tr key={l.id}>
                                            <td>{l.displayName}</td>
                                            <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descriptionForAdmins || l.descriptionForUsers || '-'}</td>
                                            <td>{l.behaviorDuringRetentionPeriod || '-'}</td>
                                            <td>{l.retentionDuration?.displayName || '无限制'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {tab === 'sensitivity' && (
                            <table className="table">
                                <thead><tr><th>名称</th><th>描述</th><th>优先级</th><th>已启用</th></tr></thead>
                                <tbody>
                                    {data.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>暂无数据</td></tr> : data.map((l: any) => (
                                        <tr key={l.id}>
                                            <td>{l.name}</td>
                                            <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description || '-'}</td>
                                            <td>{l.priority ?? '-'}</td>
                                            <td><span className={`badge ${l.isEnabled ? 'badge-success' : 'badge-secondary'}`}>{l.isEnabled ? '是' : '否'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {tab === 'dlp' && (
                            <table className="table">
                                <thead><tr><th>名称</th><th>描述</th><th>模式</th></tr></thead>
                                <tbody>
                                    {data.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>暂无数据</td></tr> : data.map((p: any) => (
                                        <tr key={p.id}>
                                            <td>{p.name || p.displayName}</td>
                                            <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || '-'}</td>
                                            <td>{p.mode || '-'}</td>
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

export default CompliancePage;
