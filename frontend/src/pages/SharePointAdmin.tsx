import React, { useEffect, useState, useCallback } from 'react';
import { sharepointAdminApi } from '../services/api';
import TenantSelector from '../components/TenantSelector';

type Tab = 'sites' | 'detail';

const SharePointAdminPage: React.FC = () => {
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [tab, setTab] = useState<Tab>('sites');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sites, setSites] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [selectedSite, setSelectedSite] = useState<any>(null);
    const [drives, setDrives] = useState<any[]>([]);
    const [lists, setLists] = useState<any[]>([]);

    const fetchSites = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true); setError('');
        try {
            const res = await sharepointAdminApi.getSites(tenantId);
            setSites(res.data?.value || []);
        } catch (e: any) { setError(e.response?.data?.detail || e.message); setSites([]); }
        finally { setLoading(false); }
    }, [tenantId]);

    const fetchSiteDetail = useCallback(async (siteId: string) => {
        if (!tenantId) return;
        setLoading(true); setError('');
        try {
            const [siteRes, drivesRes, listsRes] = await Promise.all([
                sharepointAdminApi.getSite(tenantId, siteId),
                sharepointAdminApi.getSiteDrives(tenantId, siteId),
                sharepointAdminApi.getSiteLists(tenantId, siteId),
            ]);
            setSelectedSite(siteRes.data);
            setDrives(drivesRes.data?.value || []);
            setLists(listsRes.data?.value || []);
            setTab('detail');
        } catch (e: any) { setError(e.response?.data?.detail || e.message); }
        finally { setLoading(false); }
    }, [tenantId]);

    useEffect(() => { if (tab === 'sites') fetchSites(); }, [tenantId, tab, fetchSites]);

    const filtered = sites.filter((s: any) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (s.displayName || '').toLowerCase().includes(q) || (s.webUrl || '').toLowerCase().includes(q);
    });

    return (
        <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>📁 SharePoint 管理</h2>
            <TenantSelector selectedTenant={tenantId} onSelect={(id) => { setTenantId(id); setTab('sites'); setSelectedSite(null); }} />

            <div className="card">
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--gray-200)', paddingBottom: 'var(--space-2)' }}>
                    <button className={`btn ${tab === 'sites' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('sites'); setSelectedSite(null); }}>📋 站点列表</button>
                    {selectedSite && <button className={`btn ${tab === 'detail' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('detail')}>📄 站点详情</button>}
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}

                {tab === 'sites' && (
                    <div>
                        <input className="form-input" placeholder="🔍 搜索站点名或 URL..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 400, marginBottom: 'var(--space-3)' }} />
                        {loading ? <div className="loading" /> : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table">
                                    <thead><tr><th>站点名称</th><th>URL</th><th>模板</th><th>操作</th></tr></thead>
                                    <tbody>
                                        {filtered.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>暂无数据</td></tr> : filtered.map((s: any) => (
                                            <tr key={s.id}>
                                                <td>{s.displayName}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.webUrl}</td>
                                                <td>{s.template || '-'}</td>
                                                <td><button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => fetchSiteDetail(s.id)}>详情</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div style={{ marginTop: 'var(--space-2)', color: 'var(--gray-500)', fontSize: 13 }}>共 {filtered.length} 个站点</div>
                    </div>
                )}

                {tab === 'detail' && selectedSite && (
                    <div>
                        <div className="card" style={{ background: 'var(--gray-50)', marginBottom: 'var(--space-4)' }}>
                            <h3>{selectedSite.displayName}</h3>
                            <p><strong>URL:</strong> <a href={selectedSite.webUrl} target="_blank" rel="noreferrer">{selectedSite.webUrl}</a></p>
                            <p><strong>ID:</strong> {selectedSite.id}</p>
                            <p><strong>创建时间:</strong> {selectedSite.createdDateTime ? new Date(selectedSite.createdDateTime).toLocaleString() : '-'}</p>
                        </div>

                        <h4 style={{ marginBottom: 'var(--space-2)' }}>📂 文档库 (Drives)</h4>
                        <table className="table" style={{ marginBottom: 'var(--space-4)' }}>
                            <thead><tr><th>名称</th><th>类型</th><th>描述</th></tr></thead>
                            <tbody>
                                {drives.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>暂无数据</td></tr> : drives.map((d: any) => (
                                    <tr key={d.id}><td>{d.name}</td><td>{d.driveType || '-'}</td><td>{d.description || '-'}</td></tr>
                                ))}
                            </tbody>
                        </table>

                        <h4 style={{ marginBottom: 'var(--space-2)' }}>📋 列表 (Lists)</h4>
                        <table className="table">
                            <thead><tr><th>名称</th><th>显示名称</th><th>列表类型</th></tr></thead>
                            <tbody>
                                {lists.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>暂无数据</td></tr> : lists.map((l: any) => (
                                    <tr key={l.id}><td>{l.name}</td><td>{l.displayName}</td><td>{l.list?.template || '-'}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SharePointAdminPage;
