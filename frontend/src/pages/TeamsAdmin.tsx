import React, { useEffect, useState, useCallback } from 'react';
import { teamsApi } from '../services/api';
import TenantSelector from '../components/TenantSelector';

type Tab = 'teams' | 'channels' | 'members';

const TeamsAdminPage: React.FC = () => {
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [tab, setTab] = useState<Tab>('teams');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [teams, setTeams] = useState<any[]>([]);
    const [channels, setChannels] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<any>(null);

    const fetchTeams = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true); setError('');
        try {
            const res = await teamsApi.list(tenantId);
            setTeams(res.data?.value || []);
        } catch (e: any) { setError(e.response?.data?.detail || e.message); setTeams([]); }
        finally { setLoading(false); }
    }, [tenantId]);

    const fetchTeamDetail = useCallback(async (teamId: string, teamName: string) => {
        if (!tenantId) return;
        setLoading(true); setError('');
        try {
            const [chRes, memRes] = await Promise.all([
                teamsApi.getChannels(tenantId, teamId),
                teamsApi.getMembers(tenantId, teamId),
            ]);
            setSelectedTeam({ id: teamId, displayName: teamName });
            setChannels(chRes.data?.value || []);
            setMembers(memRes.data?.value || []);
            setTab('channels');
        } catch (e: any) { setError(e.response?.data?.detail || e.message); }
        finally { setLoading(false); }
    }, [tenantId]);

    useEffect(() => { if (tab === 'teams') fetchTeams(); }, [tenantId, tab, fetchTeams]);

    const filtered = teams.filter((t: any) => {
        if (!search) return true;
        return (t.displayName || '').toLowerCase().includes(search.toLowerCase());
    });

    return (
        <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>💬 Teams 管理</h2>
            <TenantSelector selectedTenant={tenantId} onSelect={(id) => { setTenantId(id); setTab('teams'); setSelectedTeam(null); }} />

            <div className="card">
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--gray-200)', paddingBottom: 'var(--space-2)' }}>
                    <button className={`btn ${tab === 'teams' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setTab('teams'); setSelectedTeam(null); }}>👥 团队列表</button>
                    {selectedTeam && (
                        <>
                            <button className={`btn ${tab === 'channels' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('channels')}>📢 频道</button>
                            <button className={`btn ${tab === 'members' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('members')}>👤 成员</button>
                        </>
                    )}
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}

                {tab === 'teams' && (
                    <div>
                        <input className="form-input" placeholder="🔍 搜索团队名称..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 400, marginBottom: 'var(--space-3)' }} />
                        {loading ? <div className="loading" /> : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table">
                                    <thead><tr><th>团队名称</th><th>描述</th><th>可见性</th><th>操作</th></tr></thead>
                                    <tbody>
                                        {filtered.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>暂无数据</td></tr> : filtered.map((t: any) => (
                                            <tr key={t.id}>
                                                <td><strong>{t.displayName}</strong></td>
                                                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '-'}</td>
                                                <td><span className={`badge ${t.visibility === 'public' ? 'badge-success' : 'badge-secondary'}`}>{t.visibility || 'N/A'}</span></td>
                                                <td><button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => fetchTeamDetail(t.id, t.displayName)}>详情</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div style={{ marginTop: 'var(--space-2)', color: 'var(--gray-500)', fontSize: 13 }}>共 {filtered.length} 个团队</div>
                    </div>
                )}

                {tab === 'channels' && selectedTeam && (
                    <div>
                        <h4 style={{ marginBottom: 'var(--space-2)' }}>📢 {selectedTeam.displayName} — 频道</h4>
                        {loading ? <div className="loading" /> : (
                            <table className="table">
                                <thead><tr><th>频道名称</th><th>描述</th><th>成员数</th><th>创建时间</th></tr></thead>
                                <tbody>
                                    {channels.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center' }}>暂无数据</td></tr> : channels.map((ch: any) => (
                                        <tr key={ch.id}>
                                            <td><strong>{ch.displayName}</strong></td>
                                            <td>{ch.description || '-'}</td>
                                            <td>{ch.memberCount ?? '-'}</td>
                                            <td>{ch.createdDateTime ? new Date(ch.createdDateTime).toLocaleDateString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {tab === 'members' && selectedTeam && (
                    <div>
                        <h4 style={{ marginBottom: 'var(--space-2)' }}>👤 {selectedTeam.displayName} — 成员</h4>
                        {loading ? <div className="loading" /> : (
                            <table className="table">
                                <thead><tr><th>名称</th><th>角色</th><th>邮箱</th></tr></thead>
                                <tbody>
                                    {members.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center' }}>暂无数据</td></tr> : members.map((m: any) => (
                                        <tr key={m.id}>
                                            <td>{m.displayName}</td>
                                            <td><span className={`badge ${m.roles?.includes('owner') ? 'badge-success' : 'badge-secondary'}`}>{m.roles?.[0] || 'member'}</span></td>
                                            <td>{m.email || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamsAdminPage;
