import React, { useState, useEffect, useMemo } from 'react';
import { tenantApi, reportCenterApi, Tenant } from '../services/api';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

/* ──────── colour palette ──────── */
const COLORS = [
    '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
    '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
];

/* ──────────────────── helpers ──────────────────── */
const StatCard: React.FC<{
    label: string; value: string | number; icon: string;
    color?: string; sub?: string;
}> = ({ label, value, icon, color, sub }) => (
    <div className="card" style={{
        flex: '1 1 160px', textAlign: 'center',
        borderTop: `3px solid ${color || 'var(--primary)'}`,
    }}>
        <div style={{ fontSize: 28 }}>{icon}</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--gray-900)' }}>
            {value}
        </div>
        <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>{sub}</div>}
    </div>
);

const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
    <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || '搜索...'}
        style={{
            padding: '8px 14px', border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-md)', width: 260, fontSize: 14,
        }}
    />
);

/* ──────────────────── main page ──────────────────── */
type Tab = 'users' | 'licenses' | 'security' | 'exchange' | 'teams' | 'sharepoint' | 'onedrive' | 'trends';

const ReportCenter: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('users');
    const [loading, setLoading] = useState(false);

    /* data states */
    const [userOverview, setUserOverview] = useState<any>(null);
    const [licenseOverview, setLicenseOverview] = useState<any>(null);
    const [securityOverview, setSecurityOverview] = useState<any>(null);
    const [exchangeData, setExchangeData] = useState<any>(null);
    const [exchangeActivity, setExchangeActivity] = useState<any>(null);
    const [exchangeAppUsage, setExchangeAppUsage] = useState<any>(null);
    const [exchangePeriod, setExchangePeriod] = useState('D7');
    const [teamsData, setTeamsData] = useState<any>(null);
    const [teamsDeviceUsage, setTeamsDeviceUsage] = useState<any>(null);
    const [sharepointData, setSharepointData] = useState<any>(null);
    const [onedriveData, setOnedriveData] = useState<any>(null);
    const [servicePeriod, setServicePeriod] = useState('D7');
    const [trendsStorage, setTrendsStorage] = useState<any>(null);
    const [trendsActivity, setTrendsActivity] = useState<any>(null);
    const [trendsSecureScore, setTrendsSecureScore] = useState<any>(null);
    const [trendsPeriod, setTrendsPeriod] = useState('D30');
    const [exchangeSubReport, setExchangeSubReport] = useState<{ type: string; title: string; rows: any[] } | null>(null);
    const [subReport, setSubReport] = useState<{ type: string; data: any } | null>(null);
    const [search, setSearch] = useState('');

    /* load tenants */
    useEffect(() => {
        tenantApi.list().then(r => {
            setTenants(r.data);
            if (r.data.length > 0) setSelectedTenant(r.data[0].id);
        });
    }, []);

    /* fetch data on tenant / tab change */
    useEffect(() => {
        if (!selectedTenant) return;
        setLoading(true);
        setSubReport(null);
        setExchangeSubReport(null);
        setSearch('');

        const load = async () => {
            try {
                if (activeTab === 'users') {
                    const r = await reportCenterApi.getUserOverview(selectedTenant);
                    setUserOverview(r.data);
                } else if (activeTab === 'licenses') {
                    const r = await reportCenterApi.getLicenseOverview(selectedTenant);
                    setLicenseOverview(r.data);
                } else if (activeTab === 'security') {
                    const r = await reportCenterApi.getSecurityOverview(selectedTenant);
                    setSecurityOverview(r.data);
                } else if (activeTab === 'exchange') {
                    const [ov, act, app] = await Promise.all([
                        reportCenterApi.getExchangeOverview(selectedTenant, exchangePeriod),
                        reportCenterApi.getExchangeActivity(selectedTenant, exchangePeriod),
                        reportCenterApi.getExchangeAppUsage(selectedTenant, exchangePeriod),
                    ]);
                    setExchangeData(ov.data);
                    setExchangeActivity(act.data);
                    setExchangeAppUsage(app.data);
                } else if (activeTab === 'teams') {
                    const [ov, dev] = await Promise.all([
                        reportCenterApi.getTeamsOverview(selectedTenant, servicePeriod),
                        reportCenterApi.getTeamsDeviceUsage(selectedTenant, servicePeriod),
                    ]);
                    setTeamsData(ov.data);
                    setTeamsDeviceUsage(dev.data);
                } else if (activeTab === 'sharepoint') {
                    const r = await reportCenterApi.getSharePointOverview(selectedTenant, servicePeriod);
                    setSharepointData(r.data);
                } else if (activeTab === 'onedrive') {
                    const r = await reportCenterApi.getOneDriveOverview(selectedTenant, servicePeriod);
                    setOnedriveData(r.data);
                } else if (activeTab === 'trends') {
                    const [st, act, ss] = await Promise.all([
                        reportCenterApi.getTrendsStorage(selectedTenant, trendsPeriod),
                        reportCenterApi.getTrendsActivity(selectedTenant, trendsPeriod),
                        reportCenterApi.getTrendsSecureScore(selectedTenant),
                    ]);
                    setTrendsStorage(st.data);
                    setTrendsActivity(act.data);
                    setTrendsSecureScore(ss.data);
                }
            } catch (e: any) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [selectedTenant, activeTab, exchangePeriod, servicePeriod, trendsPeriod]);

    /* sub-report loaders */
    const loadSubReport = async (type: string) => {
        if (!selectedTenant) return;
        setLoading(true);
        try {
            let r: any;
            switch (type) {
                case 'disabled': r = await reportCenterApi.getDisabledUsers(selectedTenant); break;
                case 'guests': r = await reportCenterApi.getGuestUsers(selectedTenant); break;
                case 'recent': r = await reportCenterApi.getRecentUsers(selectedTenant, 30); break;
                case 'admins': r = await reportCenterApi.getAdminUsers(selectedTenant); break;
                case 'unlicensed': r = await reportCenterApi.getUnlicensedUsers(selectedTenant); break;
                case 'licensed': r = await reportCenterApi.getLicensedUsers(selectedTenant); break;
                case 'mfa': r = await reportCenterApi.getMfaDetails(selectedTenant); break;
                default: return;
            }
            setSubReport({ type, data: r.data });
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    /* tab config */
    const tabs: { key: Tab; label: string; icon: string }[] = [
        { key: 'users', label: '用户报表', icon: '👥' },
        { key: 'licenses', label: '许可证报表', icon: '📜' },
        { key: 'security', label: '安全报表', icon: '🔒' },
        { key: 'exchange', label: 'Exchange', icon: '📧' },
        { key: 'teams', label: 'Teams', icon: '💬' },
        { key: 'sharepoint', label: 'SharePoint', icon: '🌐' },
        { key: 'onedrive', label: 'OneDrive', icon: '☁️' },
        { key: 'trends', label: '趋势分析', icon: '📈' },
    ];

    /* filtered users for the current sub-report table */
    const filteredRows = useMemo(() => {
        const rows = subReport?.data?.value || [];
        if (!search) return rows;
        const q = search.toLowerCase();
        return rows.filter((r: any) =>
            (r.displayName || r.userDisplayName || '').toLowerCase().includes(q) ||
            (r.userPrincipalName || '').toLowerCase().includes(q) ||
            (r.mail || '').toLowerCase().includes(q)
        );
    }, [subReport, search]);

    /* ──────── render helpers ──────── */

    const renderUserTab = () => {
        if (!userOverview) return null;
        const s = userOverview.summary;
        const deptData = userOverview.departmentDistribution || [];

        return (
            <>
                {/* stat cards */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <StatCard icon="👤" label="总用户" value={s.total} color="#6366f1" />
                    <StatCard icon="✅" label="启用" value={s.enabled} color="#22c55e" />
                    <StatCard icon="🚫" label="禁用" value={s.disabled} color="#ef4444" />
                    <StatCard icon="🌍" label="来宾" value={s.guests} color="#f59e0b" />
                    <StatCard icon="🔄" label="同步" value={s.synced} color="#06b6d4" />
                    <StatCard icon="☁️" label="仅云端" value={s.cloudOnly} color="#8b5cf6" />
                    <StatCard icon="🆕" label="近30天新增" value={s.recentlyCreated} color="#ec4899" />
                </div>

                {/* department chart + quick links */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    {/* Dept chart */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>部门分布（Top 10）</h3>
                        {deptData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={deptData} layout="vertical" margin={{ left: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无部门数据</div>}
                    </div>

                    {/* quick reports */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>快速报表</h3>
                        {[
                            { type: 'disabled', label: '禁用用户', icon: '🚫', desc: '所有被禁用的用户账号' },
                            { type: 'guests', label: '来宾 / 外部用户', icon: '🌍', desc: '所有外部来宾用户' },
                            { type: 'recent', label: '最近 30 天新建', icon: '🆕', desc: '近期创建的用户' },
                            { type: 'admins', label: '管理员列表', icon: '🛡️', desc: '所有具有管理角色的用户' },
                        ].map(q => (
                            <div
                                key={q.type}
                                onClick={() => loadSubReport(q.type)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '12px 14px', marginBottom: 8,
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--gray-200)',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                onMouseOver={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                                onMouseOut={e => (e.currentTarget.style.background = '')}
                            >
                                <span style={{ fontSize: 22 }}>{q.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{q.label}</div>
                                    <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{q.desc}</div>
                                </div>
                                <span style={{ marginLeft: 'auto', color: 'var(--gray-400)' }}>→</span>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    };

    const renderLicenseTab = () => {
        if (!licenseOverview) return null;
        const s = licenseOverview.summary;
        const subs = licenseOverview.subscriptions || [];

        const pieData = subs.filter((s: any) => s.enabled > 0).map((s: any) => ({
            name: s.skuPartNumber,
            value: s.consumed,
        }));

        return (
            <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <StatCard icon="📦" label="订阅总数" value={s.totalSubscriptions} color="#6366f1" />
                    <StatCard icon="🔑" label="许可证总量" value={s.totalEnabled} color="#22c55e" />
                    <StatCard icon="📌" label="已分配" value={s.totalConsumed} color="#f59e0b" />
                    <StatCard icon="📭" label="可用" value={s.totalAvailable} color="#06b6d4" />
                    <StatCard icon="📊" label="总使用率" value={`${s.overallUsagePercent}%`} color={
                        s.overallUsagePercent > 90 ? '#ef4444' : s.overallUsagePercent > 70 ? '#f59e0b' : '#22c55e'
                    } />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    {/* pie chart */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>许可证分配比例</h3>
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                        outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {pieData.map((_: any, i: number) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无数据</div>}
                    </div>

                    {/* quick reports */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>快速报表</h3>
                        {[
                            { type: 'unlicensed', label: '未授权用户', icon: '🔓', desc: '没有任何许可证的用户' },
                            { type: 'licensed', label: '已授权用户', icon: '🔑', desc: '拥有许可证的用户' },
                        ].map(q => (
                            <div key={q.type} onClick={() => loadSubReport(q.type)} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 14px', marginBottom: 8,
                                borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)',
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                                onMouseOver={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                                onMouseOut={e => (e.currentTarget.style.background = '')}>
                                <span style={{ fontSize: 22 }}>{q.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{q.label}</div>
                                    <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{q.desc}</div>
                                </div>
                                <span style={{ marginLeft: 'auto', color: 'var(--gray-400)' }}>→</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* subscription table */}
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>订阅详情</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>订阅名称</th><th>状态</th><th>总量</th><th>已分配</th><th>可用</th><th>使用率</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subs.map((sub: any) => (
                                    <tr key={sub.skuId}>
                                        <td style={{ fontWeight: 500 }}>{sub.skuPartNumber}</td>
                                        <td>
                                            <span style={{
                                                display: 'inline-block', padding: '2px 8px',
                                                borderRadius: 12, fontSize: 12,
                                                background: sub.capabilityStatus === 'Enabled' ? '#dcfce7' : '#fef3c7',
                                                color: sub.capabilityStatus === 'Enabled' ? '#16a34a' : '#d97706',
                                            }}>
                                                {sub.capabilityStatus}
                                            </span>
                                        </td>
                                        <td>{sub.enabled}</td>
                                        <td>{sub.consumed}</td>
                                        <td>{sub.available}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{
                                                    flex: 1, height: 6, background: 'var(--gray-100)',
                                                    borderRadius: 3, overflow: 'hidden', maxWidth: 100,
                                                }}>
                                                    <div style={{
                                                        width: `${Math.min(sub.usagePercent, 100)}%`,
                                                        height: '100%', borderRadius: 3,
                                                        background: sub.usagePercent > 90 ? '#ef4444' : sub.usagePercent > 70 ? '#f59e0b' : '#22c55e',
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: 13 }}>{sub.usagePercent}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );
    };

    const renderSecurityTab = () => {
        if (!securityOverview) return null;
        const { mfa, password, admins, errors } = securityOverview;

        const mfaPie = [
            { name: '已注册 MFA', value: mfa.registered },
            { name: '未注册 MFA', value: mfa.total - mfa.registered },
        ];

        return (
            <>
                {errors?.length > 0 && (
                    <div style={{
                        background: '#fef2f2', border: '1px solid #fecaca',
                        borderRadius: 'var(--radius-md)', padding: '12px 16px',
                        marginBottom: 16, fontSize: 13, color: '#991b1b',
                    }}>
                        ⚠️ 部分数据获取失败：
                        {errors.map((e: string, i: number) => <div key={i}>• {e}</div>)}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <StatCard icon="🔐" label="MFA 覆盖率" value={`${mfa.coveragePercent}%`}
                        color={mfa.coveragePercent >= 80 ? '#22c55e' : mfa.coveragePercent >= 50 ? '#f59e0b' : '#ef4444'} />
                    <StatCard icon="✅" label="MFA 已注册" value={mfa.registered} color="#22c55e"
                        sub={`共 ${mfa.total} 用户`} />
                    <StatCard icon="🛡️" label="管理员总数" value={admins.totalAdmins} color="#6366f1" />
                    <StatCard icon="👑" label="全局管理员" value={admins.globalAdmins} color="#f59e0b" />
                    <StatCard icon="🔑" label="密码从不过期" value={password.neverExpires} color="#ef4444" />
                    <StatCard icon="🔄" label="近 30 天改密" value={password.recentChanged} color="#06b6d4" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    {/* MFA pie */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>MFA 注册状态</h3>
                        {mfa.total > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie data={mfaPie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                        innerRadius={60} outerRadius={90}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        <Cell fill="#22c55e" />
                                        <Cell fill="#ef4444" />
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无 MFA 数据</div>}
                    </div>

                    {/* quick reports */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>快速报表</h3>
                        {[
                            { type: 'mfa', label: 'MFA 详细报表', icon: '🔐', desc: '每位用户的 MFA 注册状态' },
                            { type: 'admins', label: '管理员列表', icon: '🛡️', desc: '所有管理员及其角色' },
                        ].map(q => (
                            <div key={q.type} onClick={() => loadSubReport(q.type)} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 14px', marginBottom: 8,
                                borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)',
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                                onMouseOver={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                                onMouseOut={e => (e.currentTarget.style.background = '')}>
                                <span style={{ fontSize: 22 }}>{q.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{q.label}</div>
                                    <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{q.desc}</div>
                                </div>
                                <span style={{ marginLeft: 'auto', color: 'var(--gray-400)' }}>→</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* password table */}
                {password.details?.length > 0 && (
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>密码状态报表</h3>
                        <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                            <table className="data-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>用户名</th><th>UPN</th><th>密码不过期</th><th>最后改密时间</th><th>账号启用</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {password.details.slice(0, 100).map((u: any) => (
                                        <tr key={u.id}>
                                            <td>{u.displayName}</td>
                                            <td style={{ fontSize: 13 }}>{u.userPrincipalName}</td>
                                            <td>
                                                <span style={{
                                                    color: u.passwordNeverExpires ? '#ef4444' : '#22c55e',
                                                    fontWeight: 600,
                                                }}>
                                                    {u.passwordNeverExpires ? '是' : '否'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 13 }}>
                                                {u.lastPasswordChangeDateTime
                                                    ? new Date(u.lastPasswordChangeDateTime).toLocaleDateString()
                                                    : '-'
                                                }
                                            </td>
                                            <td>{u.accountEnabled ? '✅' : '❌'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </>
        );
    };

    /* ──────── Exchange tab ──────── */

    const renderExchangeTab = () => {
        if (!exchangeData) return null;
        const s = exchangeData.summary;
        const mailboxes = exchangeData.mailboxes || [];
        const act = exchangeActivity;
        const appUsg = exchangeAppUsage;

        // top 10 mailboxes by storage for chart
        const storageChart = mailboxes.slice(0, 10).map((m: any) => ({
            name: (m.displayName || m.userPrincipalName || '').substring(0, 12),
            storage: m.storageUsedGB,
        }));

        // email activity bar chart
        const activityChart = (act?.users || []).slice(0, 10).map((u: any) => ({
            name: (u.displayName || u.userPrincipalName || '').substring(0, 12),
            send: u.sendCount,
            receive: u.receiveCount,
        }));

        // app distribution pie
        const appPie = (appUsg?.summary?.appDistribution || []).map((a: any) => ({
            name: a.name, value: a.count,
        }));

        return (
            <>
                {/* period selector */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {[{ v: 'D7', l: '7 天' }, { v: 'D30', l: '30 天' }, { v: 'D90', l: '90 天' }, { v: 'D180', l: '180 天' }].map(p => (
                        <button key={p.v} onClick={() => setExchangePeriod(p.v)} style={{
                            padding: '6px 14px', border: '1px solid var(--gray-200)',
                            borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13,
                            background: exchangePeriod === p.v ? 'var(--primary)' : '#fff',
                            color: exchangePeriod === p.v ? '#fff' : 'var(--gray-600)',
                        }}>{p.l}</button>
                    ))}
                </div>

                {/* stat cards — clickable */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <div onClick={() => loadExchangeSub('all', '所有邮箱', mailboxes)} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="📬" label="总邮箱" value={s.total} color="#6366f1" />
                    </div>
                    <div onClick={() => loadExchangeSub('active', '活跃邮箱', mailboxes.filter((m: any) => !m.isDeleted && m.lastActivityDate))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="✅" label="活跃" value={s.active} color="#22c55e" />
                    </div>
                    <div onClick={() => loadExchangeSub('inactive', '不活跃邮箱', mailboxes.filter((m: any) => !m.isDeleted && !m.lastActivityDate))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="😴" label="不活跃" value={s.inactive} color="#f59e0b" />
                    </div>
                    <div onClick={() => loadExchangeSub('deleted', '已删除邮箱', mailboxes.filter((m: any) => m.isDeleted))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="🗑️" label="已删除" value={s.deleted} color="#ef4444" />
                    </div>
                    <StatCard icon="📦" label="总存储" value={`${s.totalStorageGB} GB`} color="#06b6d4" />
                    <StatCard icon="📁" label="总邮件数" value={s.totalItems.toLocaleString()} color="#8b5cf6" />
                    <div onClick={() => loadExchangeSub('overquota', '超配额邮箱', mailboxes.filter((m: any) => m.overWarning))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="⚠️" label="超配额警告" value={s.overWarningQuota} color={s.overWarningQuota > 0 ? '#ef4444' : '#22c55e'} />
                    </div>
                    <div onClick={() => loadExchangeSub('archive', '存档邮箱', mailboxes.filter((m: any) => m.hasArchive))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="🗃️" label="存档邮箱" value={s.hasArchive} color="#14b8a6" />
                    </div>
                </div>

                {/* charts row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    {/* storage top 10 */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>邮箱存储 Top 10</h3>
                        {storageChart.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={storageChart} layout="vertical" margin={{ left: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" unit=" GB" />
                                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(v: any) => `${v} GB`} />
                                    <Bar dataKey="storage" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无数据</div>}
                    </div>

                    {/* app usage pie */}
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>邮件客户端分布</h3>
                        {appPie.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={appPie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                        outerRadius={90}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {appPie.map((_: any, i: number) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无数据</div>}
                    </div>
                </div>

                {/* email activity chart */}
                {activityChart.length > 0 && (
                    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>邮件活动 Top 10</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={activityChart} margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="send" name="发送" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="receive" name="接收" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* activity summary cards */}
                {act && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                        <StatCard icon="📤" label="总发送" value={act.summary.totalSend.toLocaleString()} color="#6366f1" />
                        <StatCard icon="📥" label="总接收" value={act.summary.totalReceive.toLocaleString()} color="#22c55e" />
                        <StatCard icon="👁️" label="总已读" value={act.summary.totalRead.toLocaleString()} color="#06b6d4" />
                        <StatCard icon="👥" label="活跃用户" value={act.summary.totalUsers} color="#f59e0b" />
                    </div>
                )}

                {/* quick reports */}
                <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>快速报表</h3>
                    {[
                        { key: 'inactive', label: '不活跃邮箱', icon: '😴', desc: '在选定周期内无活动的邮箱', filter: (m: any) => !m.isDeleted && !m.lastActivityDate },
                        { key: 'overquota', label: '超配额邮箱', icon: '⚠️', desc: '存储已超过警告配额的邮箱', filter: (m: any) => m.overWarning },
                        { key: 'archive', label: '存档邮箱', icon: '🗃️', desc: '已启用存档的邮箱', filter: (m: any) => m.hasArchive },
                        { key: 'activity', label: '邮件活动详情', icon: '📊', desc: '每位用户的发送/接收/已读统计', filter: null },
                    ].map(q => (
                        <div key={q.key}
                            onClick={() => q.filter
                                ? loadExchangeSub(q.key, q.label, mailboxes.filter(q.filter))
                                : loadExchangeSub('activity', q.label, act?.users || [])
                            }
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 14px', marginBottom: 8,
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--gray-200)',
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                            onMouseOut={e => (e.currentTarget.style.background = '')}
                        >
                            <span style={{ fontSize: 22 }}>{q.icon}</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{q.label}</div>
                                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{q.desc}</div>
                            </div>
                            <span style={{ marginLeft: 'auto', color: 'var(--gray-400)' }}>→</span>
                        </div>
                    ))}
                </div>

                {/* mailbox table */}
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>邮箱详情（按存储降序）</h3>
                    <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>用户</th><th>存储 (GB)</th><th>邮件数</th><th>警告配额</th><th>存档</th><th>最后活动</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mailboxes.slice(0, 100).map((m: any, i: number) => (
                                    <tr key={i}>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{m.displayName || '-'}</div>
                                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{m.userPrincipalName}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span>{m.storageUsedGB}</span>
                                                {m.overWarning && <span style={{ color: '#ef4444', fontSize: 12 }}>⚠️</span>}
                                            </div>
                                        </td>
                                        <td>{m.itemCount.toLocaleString()}</td>
                                        <td style={{ fontSize: 13 }}>{m.warningQuotaBytes ? `${(m.warningQuotaBytes / 1024 ** 3).toFixed(1)} GB` : '-'}</td>
                                        <td>{m.hasArchive ? '✅' : '-'}</td>
                                        <td style={{ fontSize: 13 }}>{m.lastActivityDate || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );
    };

    /* ──────── Teams tab ──────── */

    const PeriodSelector: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[{ v: 'D7', l: '7 天' }, { v: 'D30', l: '30 天' }, { v: 'D90', l: '90 天' }, { v: 'D180', l: '180 天' }].map(p => (
                <button key={p.v} onClick={() => onChange(p.v)} style={{
                    padding: '6px 14px', border: '1px solid var(--gray-200)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13,
                    background: value === p.v ? 'var(--primary)' : '#fff',
                    color: value === p.v ? '#fff' : 'var(--gray-600)',
                }}>{p.l}</button>
            ))}
        </div>
    );

    const renderTeamsTab = () => {
        if (!teamsData) return null;
        const s = teamsData.summary;
        const users = teamsData.users || [];
        const devUsg = teamsDeviceUsage;

        const activityChart = users.slice(0, 10).map((u: any) => ({
            name: (u.displayName || u.userPrincipalName || '').substring(0, 12),
            chat: u.teamChatMessageCount + u.privateChatMessageCount,
            call: u.callCount,
            meeting: u.meetingCount,
        }));

        const devPie = (devUsg?.summary?.deviceDistribution || []).map((d: any) => ({
            name: d.name, value: d.count,
        }));

        return (
            <>
                <PeriodSelector value={servicePeriod} onChange={setServicePeriod} />

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <div onClick={() => loadExchangeSub('all', '所有 Teams 用户', users)} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="👥" label="总用户" value={s.total} color="#6366f1" />
                    </div>
                    <div onClick={() => loadExchangeSub('teams-active', '活跃 Teams 用户', users.filter((u: any) => u.lastActivityDate && !u.isDeleted))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="✅" label="活跃" value={s.active} color="#22c55e" />
                    </div>
                    <div onClick={() => loadExchangeSub('teams-inactive', '不活跃 Teams 用户', users.filter((u: any) => !u.lastActivityDate || u.isDeleted))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="😴" label="不活跃" value={s.inactive} color="#f59e0b" />
                    </div>
                    <StatCard icon="💬" label="总聊天" value={s.totalChats.toLocaleString()} color="#06b6d4" />
                    <StatCard icon="📞" label="总通话" value={s.totalCalls.toLocaleString()} color="#8b5cf6" />
                    <StatCard icon="🎓" label="总会议" value={s.totalMeetings.toLocaleString()} color="#ec4899" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Teams 活动 Top 10</h3>
                        {activityChart.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={activityChart} margin={{ left: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="chat" name="聊天" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="call" name="通话" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="meeting" name="会议" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无数据</div>}
                    </div>

                    <div className="card" style={{ padding: 20 }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>设备分布</h3>
                        {devPie.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={devPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {devPie.map((_: any, i: number) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无数据</div>}
                    </div>
                </div>

                {/* teams detail table */}
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Teams 用户活动详情</h3>
                    <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead><tr>
                                <th>用户</th><th>团队聊天</th><th>私人聊天</th><th>通话</th><th>会议</th><th>最后活动</th>
                            </tr></thead>
                            <tbody>
                                {users.slice(0, 100).map((u: any, i: number) => (
                                    <tr key={i}>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{u.displayName || '-'}</div>
                                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{u.userPrincipalName}</div>
                                        </td>
                                        <td>{u.teamChatMessageCount}</td>
                                        <td>{u.privateChatMessageCount}</td>
                                        <td>{u.callCount}</td>
                                        <td>{u.meetingCount}</td>
                                        <td style={{ fontSize: 13 }}>{u.lastActivityDate || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );
    };

    /* ──────── SharePoint tab ──────── */

    const renderSharePointTab = () => {
        if (!sharepointData) return null;
        const s = sharepointData.summary;
        const sites = sharepointData.sites || [];

        const storageChart = sites.slice(0, 10).map((st: any) => ({
            name: (st.siteName || '').substring(0, 14),
            storage: st.storageUsedGB,
        }));

        return (
            <>
                <PeriodSelector value={servicePeriod} onChange={setServicePeriod} />

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <div onClick={() => loadExchangeSub('sp-all', '所有 SharePoint 站点', sites)} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="🌐" label="总站点" value={s.total} color="#6366f1" />
                    </div>
                    <div onClick={() => loadExchangeSub('sp-active', '活跃站点', sites.filter((st: any) => st.lastActivityDate && !st.isDeleted))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="✅" label="活跃" value={s.active} color="#22c55e" />
                    </div>
                    <div onClick={() => loadExchangeSub('sp-inactive', '不活跃站点', sites.filter((st: any) => !st.lastActivityDate || st.isDeleted))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="😴" label="不活跃" value={s.inactive} color="#f59e0b" />
                    </div>
                    <StatCard icon="📦" label="总存储" value={`${s.totalStorageGB} GB`} color="#06b6d4" />
                    <StatCard icon="📄" label="总文件" value={s.totalFiles.toLocaleString()} color="#8b5cf6" />
                    <StatCard icon="👁️" label="页面访问" value={s.totalPagesVisited.toLocaleString()} color="#ec4899" />
                </div>

                <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>站点存储 Top 10</h3>
                    {storageChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={storageChart} layout="vertical" margin={{ left: 100 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" unit=" GB" />
                                <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(v: any) => `${v} GB`} />
                                <Bar dataKey="storage" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无数据</div>}
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>SharePoint 站点详情</h3>
                    <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead><tr>
                                <th>站点</th><th>所有者</th><th>存储 (GB)</th><th>文件数</th><th>活跃文件</th><th>页面访问</th><th>最后活动</th>
                            </tr></thead>
                            <tbody>
                                {sites.slice(0, 100).map((st: any, i: number) => (
                                    <tr key={i}>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{st.siteName || '-'}</div>
                                            <div style={{ fontSize: 12, color: 'var(--gray-400)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.siteUrl}</div>
                                        </td>
                                        <td style={{ fontSize: 13 }}>{st.ownerDisplayName || '-'}</td>
                                        <td>{st.storageUsedGB}</td>
                                        <td>{st.fileCount.toLocaleString()}</td>
                                        <td>{st.activeFileCount}</td>
                                        <td>{st.visitedPageCount}</td>
                                        <td style={{ fontSize: 13 }}>{st.lastActivityDate || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );
    };

    /* ──────── OneDrive tab ──────── */

    const renderOneDriveTab = () => {
        if (!onedriveData) return null;
        const s = onedriveData.summary;
        const accounts = onedriveData.accounts || [];

        const storageChart = accounts.slice(0, 10).map((a: any) => ({
            name: (a.ownerDisplayName || a.ownerPrincipalName || '').substring(0, 12),
            storage: a.storageUsedGB,
        }));

        return (
            <>
                <PeriodSelector value={servicePeriod} onChange={setServicePeriod} />

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    <div onClick={() => loadExchangeSub('od-all', '所有 OneDrive 账户', accounts)} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="☁️" label="总账户" value={s.total} color="#6366f1" />
                    </div>
                    <div onClick={() => loadExchangeSub('od-active', '活跃 OneDrive', accounts.filter((a: any) => a.lastActivityDate && !a.isDeleted))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="✅" label="活跃" value={s.active} color="#22c55e" />
                    </div>
                    <div onClick={() => loadExchangeSub('od-inactive', '不活跃 OneDrive', accounts.filter((a: any) => !a.lastActivityDate || a.isDeleted))} style={{ cursor: 'pointer', flex: '1 1 160px' }}>
                        <StatCard icon="😴" label="不活跃" value={s.inactive} color="#f59e0b" />
                    </div>
                    <StatCard icon="📦" label="总存储" value={`${s.totalStorageGB} GB`} color="#06b6d4" />
                    <StatCard icon="📄" label="总文件" value={s.totalFiles.toLocaleString()} color="#8b5cf6" />
                </div>

                <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>OneDrive 存储 Top 10</h3>
                    {storageChart.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={storageChart} layout="vertical" margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" unit=" GB" />
                                <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(v: any) => `${v} GB`} />
                                <Bar dataKey="storage" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无数据</div>}
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>OneDrive 账户详情</h3>
                    <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead><tr>
                                <th>用户</th><th>存储 (GB)</th><th>分配 (GB)</th><th>文件数</th><th>活跃文件</th><th>最后活动</th>
                            </tr></thead>
                            <tbody>
                                {accounts.slice(0, 100).map((a: any, i: number) => (
                                    <tr key={i}>
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{a.ownerDisplayName || '-'}</div>
                                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{a.ownerPrincipalName}</div>
                                        </td>
                                        <td>{a.storageUsedGB}</td>
                                        <td>{a.storageAllocatedGB}</td>
                                        <td>{a.fileCount.toLocaleString()}</td>
                                        <td>{a.activeFileCount}</td>
                                        <td style={{ fontSize: 13 }}>{a.lastActivityDate || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );
    };

    /* ──────── CSV export utility ──────── */

    const exportCsv = (rows: any[], filename: string) => {
        if (!rows.length) return;
        const headers = Object.keys(rows[0]);
        const csv = [
            headers.join(','),
            ...rows.map(r => headers.map(h => {
                const v = r[h] ?? '';
                return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
            }).join(',')),
        ].join('\n');
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    /* ──────── Trends tab (Phase 4) ──────── */

    const renderTrendsTab = () => {
        const hasStorage = trendsStorage && (trendsStorage.exchange?.length || trendsStorage.sharepoint?.length || trendsStorage.onedrive?.length);
        const hasActivity = trendsActivity && (trendsActivity.email?.length || trendsActivity.teams?.length || trendsActivity.sharepoint?.length);
        const hasScore = trendsSecureScore?.scores?.length;

        // merge storage series into one array by date
        const mergeStorage = () => {
            const map: Record<string, any> = {};
            for (const p of trendsStorage?.exchange || []) { map[p.date] = { ...map[p.date], date: p.date, Exchange: p.valueGB }; }
            for (const p of trendsStorage?.sharepoint || []) { map[p.date] = { ...map[p.date], date: p.date, SharePoint: p.valueGB }; }
            for (const p of trendsStorage?.onedrive || []) { map[p.date] = { ...map[p.date], date: p.date, OneDrive: p.valueGB }; }
            return Object.values(map).sort((a: any, b: any) => a.date.localeCompare(b.date));
        };

        const storageSeries = hasStorage ? mergeStorage() : [];

        return (
            <>
                <PeriodSelector value={trendsPeriod} onChange={setTrendsPeriod} />

                {/* 存储趋势 */}
                <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>📦 存储趋势（Exchange / SharePoint / OneDrive）</h3>
                        {storageSeries.length > 0 && (
                            <button onClick={() => exportCsv(storageSeries, 'storage_trend')} style={{
                                padding: '4px 12px', border: '1px solid var(--gray-300)', borderRadius: 6,
                                cursor: 'pointer', fontSize: 12, background: '#fff',
                            }}>⬇ 导出 CSV</button>
                        )}
                    </div>
                    {storageSeries.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={storageSeries}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis unit=" GB" />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="Exchange" stroke="#6366f1" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="SharePoint" stroke="#22c55e" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="OneDrive" stroke="#06b6d4" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: 40 }}>无存储趋势数据</div>}
                </div>

                {/* 活动趋势 */}
                {hasActivity && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        {/* email activity */}
                        {trendsActivity.email?.length > 0 && (
                            <div className="card" style={{ padding: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ margin: 0, fontSize: 16 }}>📧 邮件活动趋势</h3>
                                    <button onClick={() => exportCsv(trendsActivity.email, 'email_activity')} style={{
                                        padding: '4px 10px', border: '1px solid var(--gray-300)', borderRadius: 6,
                                        cursor: 'pointer', fontSize: 11, background: '#fff',
                                    }}>⬇ CSV</button>
                                </div>
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={trendsActivity.email}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="send" name="发送" stroke="#6366f1" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="receive" name="接收" stroke="#22c55e" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* teams activity */}
                        {trendsActivity.teams?.length > 0 && (
                            <div className="card" style={{ padding: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ margin: 0, fontSize: 16 }}>💬 Teams 活动趋势</h3>
                                    <button onClick={() => exportCsv(trendsActivity.teams, 'teams_activity')} style={{
                                        padding: '4px 10px', border: '1px solid var(--gray-300)', borderRadius: 6,
                                        cursor: 'pointer', fontSize: 11, background: '#fff',
                                    }}>⬇ CSV</button>
                                </div>
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={trendsActivity.teams}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="chat" name="聊天" stroke="#6366f1" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="call" name="通话" stroke="#22c55e" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="meeting" name="会议" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* sharepoint file activity */}
                        {trendsActivity.sharepoint?.length > 0 && (
                            <div className="card" style={{ padding: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ margin: 0, fontSize: 16 }}>🌐 SharePoint 文件活动</h3>
                                    <button onClick={() => exportCsv(trendsActivity.sharepoint, 'sp_file_activity')} style={{
                                        padding: '4px 10px', border: '1px solid var(--gray-300)', borderRadius: 6,
                                        cursor: 'pointer', fontSize: 11, background: '#fff',
                                    }}>⬇ CSV</button>
                                </div>
                                <ResponsiveContainer width="100%" height={260}>
                                    <LineChart data={trendsActivity.sharepoint}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="viewedOrEdited" name="查看/编辑" stroke="#6366f1" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="synced" name="同步" stroke="#22c55e" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="shared" name="共享" stroke="#f59e0b" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                )}

                {/* Secure Score 趋势 */}
                {hasScore && (
                    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>🔒 Microsoft Secure Score 趋势</h3>
                            <button onClick={() => exportCsv(trendsSecureScore.scores, 'secure_score')} style={{
                                padding: '4px 12px', border: '1px solid var(--gray-300)', borderRadius: 6,
                                cursor: 'pointer', fontSize: 12, background: '#fff',
                            }}>⬇ 导出 CSV</button>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trendsSecureScore.scores}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis domain={[0, 100]} unit="%" />
                                <Tooltip formatter={(v: any) => `${v}%`} />
                                <Line type="monotone" dataKey="percentage" name="安全评分" stroke="#22c55e" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                        {trendsSecureScore.scores.length > 0 && (
                            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                                <StatCard icon="🎯" label="当前评分"
                                    value={`${trendsSecureScore.scores[trendsSecureScore.scores.length - 1]?.percentage}%`}
                                    color="#22c55e" />
                                <StatCard icon="📊" label="最高评分"
                                    value={`${Math.max(...trendsSecureScore.scores.map((s: any) => s.percentage))}%`}
                                    color="#6366f1" />
                                <StatCard icon="📉" label="最低评分"
                                    value={`${Math.min(...trendsSecureScore.scores.map((s: any) => s.percentage))}%`}
                                    color="#f59e0b" />
                            </div>
                        )}
                    </div>
                )}

                {!hasStorage && !hasActivity && !hasScore && (
                    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
                        无趋势数据，请稍后重试或检查 Graph API 报表权限。
                    </div>
                )}
            </>
        );
    };

    /* ──────── Exchange sub-report helpers ──────── */

    const loadExchangeSub = (type: string, title: string, rows: any[]) => {
        setExchangeSubReport({ type, title, rows });
        setSearch('');
    };

    const renderExchangeSubReport = () => {
        if (!exchangeSubReport) return null;
        const { type, title, rows: allRows } = exchangeSubReport;
        const q = search.toLowerCase();
        const rows = q
            ? allRows.filter((r: any) =>
                (r.displayName || r.ownerDisplayName || r.siteName || '').toLowerCase().includes(q) ||
                (r.userPrincipalName || r.ownerPrincipalName || r.siteUrl || '').toLowerCase().includes(q)
            )
            : allRows;

        // Detect report category from type prefix
        const isActivity = type === 'activity';
        const isTeams = type.startsWith('teams-') || type === 'all' && rows[0]?.teamChatMessageCount !== undefined;
        const isSP = type.startsWith('sp-');
        const isOD = type.startsWith('od-');

        const renderRow = (r: any, i: number) => {
            // Teams user rows
            if (isTeams || r.teamChatMessageCount !== undefined) {
                return (
                    <tr key={i}>
                        <td>
                            <div style={{ fontWeight: 500 }}>{r.displayName || '-'}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{r.userPrincipalName}</div>
                        </td>
                        <td>{r.teamChatMessageCount}</td>
                        <td>{r.privateChatMessageCount}</td>
                        <td>{r.callCount}</td>
                        <td>{r.meetingCount}</td>
                        <td style={{ fontSize: 13 }}>{r.lastActivityDate || '-'}</td>
                    </tr>
                );
            }
            // SharePoint site rows
            if (isSP || r.siteUrl !== undefined && r.ownerDisplayName !== undefined) {
                return (
                    <tr key={i}>
                        <td>
                            <div style={{ fontWeight: 500 }}>{r.siteName || '-'}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.siteUrl}</div>
                        </td>
                        <td>{r.ownerDisplayName || '-'}</td>
                        <td>{r.storageUsedGB}</td>
                        <td>{r.fileCount?.toLocaleString()}</td>
                        <td>{r.activeFileCount}</td>
                        <td style={{ fontSize: 13 }}>{r.lastActivityDate || '-'}</td>
                    </tr>
                );
            }
            // OneDrive rows
            if (isOD || r.ownerPrincipalName !== undefined) {
                return (
                    <tr key={i}>
                        <td>
                            <div style={{ fontWeight: 500 }}>{r.ownerDisplayName || '-'}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{r.ownerPrincipalName}</div>
                        </td>
                        <td>{r.storageUsedGB}</td>
                        <td>{r.storageAllocatedGB}</td>
                        <td>{r.fileCount?.toLocaleString()}</td>
                        <td>{r.activeFileCount}</td>
                        <td style={{ fontSize: 13 }}>{r.lastActivityDate || '-'}</td>
                    </tr>
                );
            }
            // Exchange activity
            if (isActivity) {
                return (
                    <tr key={i}>
                        <td>
                            <div style={{ fontWeight: 500 }}>{r.displayName || '-'}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{r.userPrincipalName}</div>
                        </td>
                        <td>{r.sendCount}</td>
                        <td>{r.receiveCount}</td>
                        <td>{r.readCount}</td>
                        <td style={{ fontSize: 13 }}>{r.lastActivityDate || '-'}</td>
                    </tr>
                );
            }
            // Exchange mailbox (default)
            return (
                <tr key={i}>
                    <td>
                        <div style={{ fontWeight: 500 }}>{r.displayName || '-'}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{r.userPrincipalName}</div>
                    </td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{r.storageUsedGB}</span>
                            {r.overWarning && <span style={{ color: '#ef4444', fontSize: 12 }}>⚠️</span>}
                        </div>
                    </td>
                    <td>{(r.itemCount || 0).toLocaleString()}</td>
                    <td style={{ fontSize: 13 }}>{r.warningQuotaBytes ? `${(r.warningQuotaBytes / 1024 ** 3).toFixed(1)} GB` : '-'}</td>
                    <td>{r.hasArchive ? '✅' : '-'}</td>
                    <td style={{ fontSize: 13 }}>{r.lastActivityDate || '-'}</td>
                </tr>
            );
        };

        const renderHeader = () => {
            if (isTeams || (rows[0]?.teamChatMessageCount !== undefined)) {
                return <tr><th>用户</th><th>团队聊天</th><th>私人聊天</th><th>通话</th><th>会议</th><th>最后活动</th></tr>;
            }
            if (isSP || (rows[0]?.siteUrl !== undefined && rows[0]?.ownerDisplayName !== undefined)) {
                return <tr><th>站点</th><th>所有者</th><th>存储 (GB)</th><th>文件数</th><th>活跃文件</th><th>最后活动</th></tr>;
            }
            if (isOD || rows[0]?.ownerPrincipalName !== undefined) {
                return <tr><th>用户</th><th>存储 (GB)</th><th>分配 (GB)</th><th>文件数</th><th>活跃文件</th><th>最后活动</th></tr>;
            }
            if (isActivity) {
                return <tr><th>用户</th><th>发送</th><th>接收</th><th>已读</th><th>最后活动</th></tr>;
            }
            return <tr><th>用户</th><th>存储 (GB)</th><th>邮件数</th><th>配额</th><th>存档</th><th>最后活动</th></tr>;
        };

        return (
            <div className="card" style={{ padding: 20, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={() => setExchangeSubReport(null)} style={{
                            background: 'var(--gray-100)', border: 'none', borderRadius: 'var(--radius-md)',
                            padding: '6px 12px', cursor: 'pointer', fontSize: 13,
                        }}>← 返回</button>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{title}（共 {allRows.length} 项）</h3>
                    </div>
                    <SearchInput value={search} onChange={setSearch} />
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead>{renderHeader()}</thead>
                        <tbody>{rows.slice(0, 200).map(renderRow)}</tbody>
                    </table>
                </div>
            </div>
        );
    };

    /* ──────── sub-report table renderers ──────── */

    const subReportTitles: Record<string, string> = {
        disabled: '禁用用户',
        guests: '来宾 / 外部用户',
        recent: '最近 30 天新建用户',
        admins: '管理员列表',
        unlicensed: '未授权用户',
        licensed: '已授权用户',
        mfa: 'MFA 注册详情',
    };

    const renderSubReportTable = () => {
        if (!subReport) return null;
        const { type, data } = subReport;
        const rows = filteredRows;
        const title = subReportTitles[type] || type;
        const count = data?.count ?? data?.totalAdmins ?? rows.length;

        return (
            <div className="card" style={{ padding: 20, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={() => setSubReport(null)} style={{
                            background: 'var(--gray-100)', border: 'none', borderRadius: 'var(--radius-md)',
                            padding: '6px 12px', cursor: 'pointer', fontSize: 13,
                        }}>← 返回</button>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{title}（共 {count} 项）</h3>
                    </div>
                    <SearchInput value={search} onChange={setSearch} />
                </div>

                <div style={{ overflowX: 'auto', maxHeight: 500, overflowY: 'auto' }}>
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>用户名</th>
                                <th>UPN / 邮箱</th>
                                {type === 'admins' && <th>管理角色</th>}
                                {type === 'mfa' && <th>MFA 已注册</th>}
                                {type === 'mfa' && <th>注册方式</th>}
                                {(type === 'guests') && <th>状态</th>}
                                {(type !== 'mfa') && <th>创建时间</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice(0, 200).map((r: any, i: number) => (
                                <tr key={r.id || i}>
                                    <td>{r.displayName || r.userDisplayName || '-'}</td>
                                    <td style={{ fontSize: 13 }}>{r.userPrincipalName || r.mail || '-'}</td>
                                    {type === 'admins' && <td>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {(r.roles || []).map((role: string, j: number) => (
                                                <span key={j} style={{
                                                    display: 'inline-block', padding: '2px 6px',
                                                    borderRadius: 10, fontSize: 11,
                                                    background: role.includes('Global') ? '#fef3c7' : '#e0e7ff',
                                                    color: role.includes('Global') ? '#92400e' : '#3730a3',
                                                }}>
                                                    {role}
                                                </span>
                                            ))}
                                        </div>
                                    </td>}
                                    {type === 'mfa' && <td>
                                        <span style={{ color: r.isMfaRegistered ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                                            {r.isMfaRegistered ? '✅ 是' : '❌ 否'}
                                        </span>
                                    </td>}
                                    {type === 'mfa' && <td style={{ fontSize: 12 }}>
                                        {(r.methodsRegistered || []).join(', ') || '-'}
                                    </td>}
                                    {type === 'guests' && <td>{r.externalUserState || '-'}</td>}
                                    {type !== 'mfa' && <td style={{ fontSize: 13 }}>
                                        {r.createdDateTime
                                            ? new Date(r.createdDateTime).toLocaleDateString()
                                            : '-'}
                                    </td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    /* ──────── main render ──────── */
    return (
        <div className="page-container">
            {/* header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>📊 报表中心</h1>
                    <p style={{ margin: '4px 0 0', color: 'var(--gray-500)', fontSize: 14 }}>
                        全方位 Microsoft 365 用户、许可证、安全分析报表
                    </p>
                </div>
                <select
                    value={selectedTenant || ''}
                    onChange={e => setSelectedTenant(Number(e.target.value))}
                    style={{
                        padding: '8px 14px', border: '1px solid var(--gray-200)',
                        borderRadius: 'var(--radius-md)', fontSize: 14, minWidth: 200,
                    }}
                >
                    {tenants.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            {/* tabs */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 20,
                borderBottom: '2px solid var(--gray-100)', paddingBottom: 0,
            }}>
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => { setActiveTab(t.key); setSubReport(null); setExchangeSubReport(null); }}
                        style={{
                            padding: '10px 20px', border: 'none',
                            background: activeTab === t.key ? 'var(--primary)' : 'transparent',
                            color: activeTab === t.key ? '#fff' : 'var(--gray-600)',
                            borderRadius: '8px 8px 0 0', cursor: 'pointer',
                            fontWeight: activeTab === t.key ? 600 : 400,
                            fontSize: 14, transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        <span>{t.icon}</span> {t.label}
                    </button>
                ))}
            </div>

            {/* loading */}
            {loading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                    <div style={{ color: 'var(--gray-500)' }}>加载中...</div>
                </div>
            )}

            {/* content */}
            {!loading && !subReport && (
                <>
                    {activeTab === 'users' && renderUserTab()}
                    {activeTab === 'licenses' && renderLicenseTab()}
                    {activeTab === 'security' && renderSecurityTab()}
                    {activeTab === 'exchange' && !exchangeSubReport && renderExchangeTab()}
                    {activeTab === 'teams' && !exchangeSubReport && renderTeamsTab()}
                    {activeTab === 'sharepoint' && !exchangeSubReport && renderSharePointTab()}
                    {activeTab === 'onedrive' && !exchangeSubReport && renderOneDriveTab()}
                    {activeTab === 'trends' && renderTrendsTab()}
                </>
            )}

            {/* sub report table */}
            {!loading && subReport && renderSubReportTable()}
            {!loading && exchangeSubReport && renderExchangeSubReport()}
        </div>
    );
};

export default ReportCenter;
