import React, { useEffect, useState } from 'react';
import { tenantApi, healthReportApi, Tenant } from '../services/api';

const HealthReportPage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeSection, setActiveSection] = useState<'usage' | 'compliance' | 'security' | 'score'>('usage');

    // Section data
    const [usage, setUsage] = useState<any>(null);
    const [compliance, setCompliance] = useState<any>(null);
    const [security, setSecurity] = useState<any>(null);
    const [score, setScore] = useState<any>(null);

    useEffect(() => {
        tenantApi.list().then(r => {
            setTenants(r.data);
            if (r.data.length > 0) setSelectedTenant(r.data[0].id);
        });
    }, []);

    useEffect(() => {
        if (selectedTenant) loadSection(activeSection);
    }, [selectedTenant]);

    const loadSection = async (section: string) => {
        if (!selectedTenant) return;
        setLoading(true);
        try {
            switch (section) {
                case 'usage': {
                    const r = await healthReportApi.getUsage(selectedTenant);
                    setUsage(r.data); break;
                }
                case 'compliance': {
                    const r = await healthReportApi.getLicenseCompliance(selectedTenant);
                    setCompliance(r.data); break;
                }
                case 'security': {
                    const r = await healthReportApi.getSecurityAlerts(selectedTenant);
                    setSecurity(r.data); break;
                }
                case 'score': {
                    const r = await healthReportApi.getSecureScore(selectedTenant);
                    setScore(r.data); break;
                }
            }
        } catch (e) {
            console.error('Failed to load section:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (section: 'usage' | 'compliance' | 'security' | 'score') => {
        setActiveSection(section);
        loadSection(section);
    };

    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: 'var(--space-3) var(--space-4)',
        border: 'none', background: active ? 'var(--primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        borderRadius: 'var(--radius-md)', cursor: 'pointer',
        fontWeight: active ? 600 : 400, transition: 'all 0.2s',
    });

    const statCardStyle: React.CSSProperties = {
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)', textAlign: 'center', flex: 1, minWidth: '160px',
    };

    const statValue: React.CSSProperties = {
        fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)',
    };

    const statLabel: React.CSSProperties = {
        fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)',
    };

    const renderErrors = (errors: string[]) =>
        errors.length > 0 ? (
            <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)',
                fontSize: '0.85rem', color: 'var(--error)',
            }}>
                ⚠️ 部分数据获取失败（可能需要额外的 Azure AD 权限）：
                {errors.map((e, i) => <div key={i} style={{ marginTop: '4px' }}>• {e}</div>)}
            </div>
        ) : null;

    // ==================== Usage Section ====================
    const renderUsage = () => {
        if (!usage) return null;
        return (
            <div>
                {renderErrors(usage.errors || [])}
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
                    <div style={statCardStyle}>
                        <div style={statValue}>{usage.totalUsers}</div>
                        <div style={statLabel}>总用户数</div>
                    </div>
                    <div style={statCardStyle}>
                        <div style={statValue}>{usage.activeUsers}</div>
                        <div style={statLabel}>活跃用户（30天）</div>
                    </div>
                    <div style={statCardStyle}>
                        <div style={{ ...statValue, color: usage.activeRate >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                            {usage.activeRate}%
                        </div>
                        <div style={statLabel}>活跃率</div>
                    </div>
                    <div style={statCardStyle}>
                        <div style={statValue}>{usage.mailboxCount}</div>
                        <div style={statLabel}>邮箱数</div>
                    </div>
                </div>

                {usage.activeUserDetail?.length > 0 && (
                    <div className="card">
                        <div className="card-header"><span className="card-title">活跃用户详情（前20条）</span></div>
                        <div className="table-container">
                            <table className="table">
                                <thead><tr><th>用户</th><th>Exchange</th><th>OneDrive</th><th>SharePoint</th><th>Teams</th></tr></thead>
                                <tbody>
                                    {usage.activeUserDetail.map((u: any, i: number) => (
                                        <tr key={i}>
                                            <td>{u.userPrincipalName || u['User Principal Name'] || '-'}</td>
                                            <td>{u.hasExchangeLicense || u['Has Exchange License'] ? '✅' : '❌'}</td>
                                            <td>{u.hasOneDriveLicense || u['Has OneDrive License'] ? '✅' : '❌'}</td>
                                            <td>{u.hasSharePointLicense || u['Has SharePoint License'] ? '✅' : '❌'}</td>
                                            <td>{u.hasTeamsLicense || u['Has Teams License'] ? '✅' : '❌'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ==================== License Compliance ====================
    const renderCompliance = () => {
        if (!compliance) return null;
        return (
            <div>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
                    <div style={statCardStyle}>
                        <div style={statValue}>{compliance.totalEnabled}</div>
                        <div style={statLabel}>许可总数</div>
                    </div>
                    <div style={statCardStyle}>
                        <div style={statValue}>{compliance.totalConsumed}</div>
                        <div style={statLabel}>已分配</div>
                    </div>
                    <div style={statCardStyle}>
                        <div style={{ ...statValue, color: compliance.overallUsagePercent > 90 ? 'var(--error)' : 'var(--success)' }}>
                            {compliance.overallUsagePercent}%
                        </div>
                        <div style={statLabel}>使用率</div>
                    </div>
                    <div style={statCardStyle}>
                        <div style={{ ...statValue, color: compliance.inactiveLicensedCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                            {compliance.inactiveLicensedCount}
                        </div>
                        <div style={statLabel}>禁用但有许可的用户</div>
                    </div>
                </div>

                {/* License breakdown */}
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                    <div className="card-header"><span className="card-title">各许可证使用情况</span></div>
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>许可证</th><th>总数</th><th>已用</th><th>可用</th><th>使用率</th></tr></thead>
                            <tbody>
                                {compliance.licenses?.map((lic: any) => (
                                    <tr key={lic.skuId}>
                                        <td>{lic.skuPartNumber}</td>
                                        <td>{lic.enabled}</td>
                                        <td>{lic.consumed}</td>
                                        <td>{lic.available}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                <div style={{
                                                    width: '80px', height: '8px', borderRadius: '4px',
                                                    background: 'var(--bg-tertiary)', overflow: 'hidden',
                                                }}>
                                                    <div style={{
                                                        width: `${Math.min(lic.usagePercent, 100)}%`, height: '100%',
                                                        background: lic.usagePercent > 90 ? 'var(--error)' : lic.usagePercent > 70 ? 'var(--warning)' : 'var(--success)',
                                                        borderRadius: '4px',
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '0.85rem' }}>{lic.usagePercent}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Inactive licensed users */}
                {compliance.inactiveLicensedUsers?.length > 0 && (
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">⚠️ 禁用账户但仍有许可证（建议回收）</span>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead><tr><th>显示名称</th><th>UPN</th><th>许可数量</th></tr></thead>
                                <tbody>
                                    {compliance.inactiveLicensedUsers.map((u: any) => (
                                        <tr key={u.id}>
                                            <td>{u.displayName}</td>
                                            <td>{u.userPrincipalName}</td>
                                            <td>{u.licensesCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ==================== Security Alerts ====================
    const renderSecurity = () => {
        if (!security) return null;
        const riskLevelColor = (level: string) => {
            switch (level.toLowerCase()) {
                case 'high': return 'var(--error)';
                case 'medium': return 'var(--warning)';
                case 'low': return '#3b82f6';
                default: return 'var(--text-muted)';
            }
        };
        return (
            <div>
                {renderErrors(security.errors || [])}
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
                    <div style={statCardStyle}>
                        <div style={{ ...statValue, color: security.riskyUserCount > 0 ? 'var(--error)' : 'var(--success)' }}>
                            {security.riskyUserCount}
                        </div>
                        <div style={statLabel}>风险用户</div>
                    </div>
                    <div style={statCardStyle}>
                        <div style={statValue}>{security.riskDetectionCount}</div>
                        <div style={statLabel}>风险检测事件</div>
                    </div>
                    <div style={statCardStyle}>
                        <div style={{ ...statValue, color: security.mfa?.coveragePercent >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                            {security.mfa?.coveragePercent || 0}%
                        </div>
                        <div style={statLabel}>MFA 覆盖率</div>
                    </div>
                    <div style={statCardStyle}>
                        <div style={statValue}>{security.mfa?.registered || 0}/{security.mfa?.total || 0}</div>
                        <div style={statLabel}>MFA 已注册/总数</div>
                    </div>
                </div>

                {/* Risk summary */}
                {(security.riskSummary?.high > 0 || security.riskSummary?.medium > 0) && (
                    <div style={{
                        display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap',
                    }}>
                        {['high', 'medium', 'low'].map(level => (
                            <div key={level} style={{
                                padding: 'var(--space-2) var(--space-4)',
                                borderRadius: 'var(--radius-md)', fontSize: '0.9rem',
                                background: `${riskLevelColor(level)}20`,
                                color: riskLevelColor(level), fontWeight: 600,
                            }}>
                                {level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险'}：{security.riskSummary?.[level] || 0}
                            </div>
                        ))}
                    </div>
                )}

                {/* Risky users table */}
                {security.riskyUsers?.length > 0 && (
                    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="card-header"><span className="card-title">风险用户</span></div>
                        <div className="table-container">
                            <table className="table">
                                <thead><tr><th>用户</th><th>风险等级</th><th>风险状态</th><th>最后更新</th></tr></thead>
                                <tbody>
                                    {security.riskyUsers.map((u: any) => (
                                        <tr key={u.id}>
                                            <td>{u.userDisplayName || u.userPrincipalName || u.id}</td>
                                            <td>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem',
                                                    background: `${riskLevelColor(u.riskLevel || 'none')}20`,
                                                    color: riskLevelColor(u.riskLevel || 'none'),
                                                }}>
                                                    {u.riskLevel || '-'}
                                                </span>
                                            </td>
                                            <td>{u.riskState || '-'}</td>
                                            <td>{u.riskLastUpdatedDateTime ? new Date(u.riskLastUpdatedDateTime).toLocaleString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Recent risk detections */}
                {security.riskDetections?.length > 0 && (
                    <div className="card">
                        <div className="card-header"><span className="card-title">近期风险检测事件</span></div>
                        <div className="table-container">
                            <table className="table">
                                <thead><tr><th>类型</th><th>风险等级</th><th>用户</th><th>IP</th><th>检测时间</th></tr></thead>
                                <tbody>
                                    {security.riskDetections.map((d: any, i: number) => (
                                        <tr key={i}>
                                            <td style={{ fontSize: '0.85rem' }}>{d.riskEventType || '-'}</td>
                                            <td>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem',
                                                    background: `${riskLevelColor(d.riskLevel || 'none')}20`,
                                                    color: riskLevelColor(d.riskLevel || 'none'),
                                                }}>{d.riskLevel || '-'}</span>
                                            </td>
                                            <td>{d.userDisplayName || d.userPrincipalName || '-'}</td>
                                            <td>{d.ipAddress || '-'}</td>
                                            <td>{d.detectedDateTime ? new Date(d.detectedDateTime).toLocaleString() : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ==================== Secure Score ====================
    const renderScore = () => {
        if (!score) return null;
        return (
            <div>
                {renderErrors(score.errors || [])}
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
                    <div style={{ ...statCardStyle, flex: 'unset', minWidth: '220px' }}>
                        <div style={{ ...statValue, fontSize: '2.2rem' }}>
                            {score.currentScore !== undefined ? Math.round(score.currentScore) : '--'}
                            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/{score.maxScore !== undefined ? Math.round(score.maxScore) : '--'}</span>
                        </div>
                        <div style={statLabel}>Secure Score</div>
                    </div>
                    <div style={{ ...statCardStyle, flex: 'unset', minWidth: '160px' }}>
                        <div style={{
                            ...statValue,
                            color: (score.scorePercent || 0) >= 70 ? 'var(--success)' : (score.scorePercent || 0) >= 40 ? 'var(--warning)' : 'var(--error)',
                        }}>
                            {score.scorePercent !== undefined ? score.scorePercent : '--'}%
                        </div>
                        <div style={statLabel}>得分率</div>
                    </div>
                </div>

                {/* Score bar */}
                {score.scorePercent !== undefined && (
                    <div style={{ marginBottom: 'var(--space-5)' }}>
                        <div style={{
                            height: '16px', borderRadius: '8px', background: 'var(--bg-tertiary)', overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${score.scorePercent}%`, height: '100%', borderRadius: '8px',
                                background: score.scorePercent >= 70 ? 'var(--success)' : score.scorePercent >= 40 ? 'var(--warning)' : 'var(--error)',
                                transition: 'width 0.6s ease',
                            }} />
                        </div>
                    </div>
                )}

                {/* Control scores */}
                {score.controlScores?.length > 0 && (
                    <div className="card">
                        <div className="card-header"><span className="card-title">安全控制项评分（前30项）</span></div>
                        <div className="table-container">
                            <table className="table">
                                <thead><tr><th>控制项</th><th>当前分</th><th>满分</th><th>说明</th></tr></thead>
                                <tbody>
                                    {score.controlScores.map((c: any, i: number) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 500 }}>{c.controlName || '-'}</td>
                                            <td>{c.score !== undefined ? Math.round(c.score * 100) / 100 : '-'}</td>
                                            <td>{c.maxScore !== undefined ? c.maxScore : '-'}</td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.description || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h2 className="page-title">🏥 健检报告</h2>
            </div>

            {/* Tenant selector */}
            <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="card-body">
                    <div className="form-group" style={{ marginBottom: 0, maxWidth: '400px' }}>
                        <label className="form-label">选择租户</label>
                        <select className="form-select" value={selectedTenant || ''}
                            onChange={(e) => setSelectedTenant(Number(e.target.value))}>
                            <option value="">选择租户</option>
                            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)',
                background: 'var(--bg-secondary)', padding: 'var(--space-1)',
                borderRadius: 'var(--radius-md)', width: 'fit-content',
            }}>
                <button style={tabStyle(activeSection === 'usage')} onClick={() => handleTabChange('usage')}>📊 使用率</button>
                <button style={tabStyle(activeSection === 'compliance')} onClick={() => handleTabChange('compliance')}>📜 授权合规</button>
                <button style={tabStyle(activeSection === 'security')} onClick={() => handleTabChange('security')}>🛡️ 资安告警</button>
                <button style={tabStyle(activeSection === 'score')} onClick={() => handleTabChange('score')}>🎯 Secure Score</button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="loading"><div className="spinner"></div></div>
            ) : !selectedTenant ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🏥</div>
                    <div className="empty-state-title">请先选择租户</div>
                </div>
            ) : (
                <>
                    {activeSection === 'usage' && renderUsage()}
                    {activeSection === 'compliance' && renderCompliance()}
                    {activeSection === 'security' && renderSecurity()}
                    {activeSection === 'score' && renderScore()}
                </>
            )}
        </div>
    );
};

export default HealthReportPage;
