import React, { useEffect, useState, useCallback } from 'react';
import { intuneApi } from '../services/api';
import TenantSelector from '../components/TenantSelector';

type Tab = 'devices' | 'compliance' | 'config';

const IntunePage: React.FC = () => {
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [tab, setTab] = useState<Tab>('devices');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [devices, setDevices] = useState<any[]>([]);
    const [policies, setPolicies] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchDevices = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true); setError('');
        try {
            const res = await intuneApi.getDevices(tenantId);
            setDevices(res.data?.value || []);
        } catch (e: any) { setError(e.response?.data?.detail || e.message); setDevices([]); }
        finally { setLoading(false); }
    }, [tenantId]);

    const fetchPolicies = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true); setError('');
        try {
            const [compRes, configRes] = await Promise.all([
                intuneApi.getCompliancePolicies(tenantId),
                intuneApi.getConfigProfiles(tenantId),
            ]);
            setPolicies(compRes.data?.value || []);
            setProfiles(configRes.data?.value || []);
        } catch (e: any) { setError(e.response?.data?.detail || e.message); }
        finally { setLoading(false); }
    }, [tenantId]);

    useEffect(() => {
        if (tab === 'devices') fetchDevices();
        else if (tab === 'compliance' || tab === 'config') fetchPolicies();
    }, [tenantId, tab, fetchDevices, fetchPolicies]);

    const doDeviceAction = async (deviceId: string, action: 'wipe' | 'retire' | 'lock' | 'sync') => {
        if (!tenantId) return;
        const actionLabel = { wipe: '擦除', retire: '退役', lock: '锁定', sync: '同步' }[action];
        if (!confirm(`确定要${actionLabel}此设备吗？`)) return;
        setActionLoading(deviceId + action);
        try {
            switch (action) {
                case 'wipe': await intuneApi.wipeDevice(tenantId, deviceId); break;
                case 'retire': await intuneApi.retireDevice(tenantId, deviceId); break;
                case 'lock': await intuneApi.lockDevice(tenantId, deviceId); break;
                case 'sync': await intuneApi.syncDevice(tenantId, deviceId); break;
            }
            alert(`操作已提交: ${actionLabel}`);
        } catch (e: any) { alert(`操作失败: ${e.response?.data?.detail || e.message}`); }
        finally { setActionLoading(null); }
    };

    const filteredDevices = devices.filter((d: any) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (d.deviceName || '').toLowerCase().includes(s) || (d.userPrincipalName || '').toLowerCase().includes(s) || (d.model || '').toLowerCase().includes(s);
    });

    return (
        <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>📱 Intune 设备管理</h2>
            <TenantSelector selectedTenant={tenantId} onSelect={setTenantId} />

            <div className="card">
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--gray-200)', paddingBottom: 'var(--space-2)' }}>
                    <button className={`btn ${tab === 'devices' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('devices'); setSearch(''); }}>📱 设备列表</button>
                    <button className={`btn ${tab === 'compliance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('compliance'); setSearch(''); }}>✅ 合规策略</button>
                    <button className={`btn ${tab === 'config' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('config'); setSearch(''); }}>⚙️ 配置文件</button>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}

                {tab === 'devices' && (
                    <div>
                        <input className="form-input" placeholder="🔍 搜索设备名、用户、型号..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 400, marginBottom: 'var(--space-3)' }} />
                        {loading ? <div className="loading" /> : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table">
                                    <thead><tr><th>设备名</th><th>用户</th><th>型号</th><th>OS</th><th>合规</th><th>上次同步</th><th>操作</th></tr></thead>
                                    <tbody>
                                        {filteredDevices.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center' }}>暂无数据</td></tr> : filteredDevices.map((d: any) => (
                                            <tr key={d.id}>
                                                <td>{d.deviceName}</td>
                                                <td>{d.userPrincipalName || '-'}</td>
                                                <td>{d.model || '-'}</td>
                                                <td>{d.operatingSystem} {d.osVersion}</td>
                                                <td><span className={`badge ${d.complianceState === 'compliant' ? 'badge-success' : 'badge-error'}`}>{d.complianceState || 'N/A'}</span></td>
                                                <td>{d.lastSyncDateTime ? new Date(d.lastSyncDateTime).toLocaleString() : '-'}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12, marginRight: 4 }} disabled={actionLoading === d.id + 'sync'} onClick={() => doDeviceAction(d.id, 'sync')}>同步</button>
                                                    <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12, marginRight: 4 }} disabled={actionLoading === d.id + 'lock'} onClick={() => doDeviceAction(d.id, 'lock')}>锁定</button>
                                                    <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12, marginRight: 4 }} disabled={actionLoading === d.id + 'retire'} onClick={() => doDeviceAction(d.id, 'retire')}>退役</button>
                                                    <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12, color: 'var(--error)' }} disabled={actionLoading === d.id + 'wipe'} onClick={() => doDeviceAction(d.id, 'wipe')}>擦除</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div style={{ marginTop: 'var(--space-2)', color: 'var(--gray-500)', fontSize: 13 }}>共 {filteredDevices.length} 台设备</div>
                    </div>
                )}

                {tab === 'compliance' && (
                    loading ? <div className="loading" /> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead><tr><th>名称</th><th>平台</th><th>创建时间</th></tr></thead>
                                <tbody>
                                    {policies.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>暂无数据</td></tr> : policies.map((p: any) => (
                                        <tr key={p.id}><td>{p.displayName}</td><td>{p.platforms || '-'}</td><td>{p.createdDateTime ? new Date(p.createdDateTime).toLocaleDateString() : '-'}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}

                {tab === 'config' && (
                    loading ? <div className="loading" /> : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table">
                                <thead><tr><th>名称</th><th>类型</th><th>平台</th><th>创建时间</th></tr></thead>
                                <tbody>
                                    {profiles.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>暂无数据</td></tr> : profiles.map((p: any) => (
                                        <tr key={p.id}><td>{p.displayName}</td><td>{p['@odata.type'] || '-'}</td><td>{p.platforms || '-'}</td><td>{p.createdDateTime ? new Date(p.createdDateTime).toLocaleDateString() : '-'}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default IntunePage;
