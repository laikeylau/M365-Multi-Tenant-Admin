import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { auditApi, tenantApi, Tenant } from '../services/api';

// 登录日志接口（signIns API 返回的格式）
interface SignInLog {
    id: string;
    createdDateTime?: string;
    userDisplayName?: string;
    userPrincipalName?: string;
    appDisplayName?: string;
    ipAddress?: string;
    status?: { errorCode?: number; failureReason?: string };
    location?: { city?: string; countryOrRegion?: string };
}

// 目录审计日志接口（directoryAudits API 返回的格式）
interface DirectoryAuditLog {
    id: string;
    activityDisplayName?: string;
    activityDateTime?: string;
    initiatedBy?: { user?: { displayName?: string } };
    result?: string;
    targetResources?: Array<{ displayName?: string }>;
}

const AuditPage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [signInLogs, setSignInLogs] = useState<SignInLog[]>([]);
    const [directoryLogs, setDirectoryLogs] = useState<DirectoryAuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [logType, setLogType] = useState<'signins' | 'directory'>('directory');

    useEffect(() => {
        fetchTenants();
    }, []);

    useEffect(() => {
        if (selectedTenant) {
            fetchLogs();
        }
    }, [selectedTenant, logType]);

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

    const fetchLogs = async () => {
        if (!selectedTenant) return;
        setLoading(true);
        try {
            if (logType === 'signins') {
                const res = await auditApi.getSignIns(selectedTenant, { top: 50 });
                setSignInLogs(res.data);
            } else {
                const res = await auditApi.getDirectoryAudits(selectedTenant, { top: 50 });
                setDirectoryLogs(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
            setSignInLogs([]);
            setDirectoryLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const getSignInStatus = (log: SignInLog) => {
        if (log.status?.errorCode === 0) return { text: '成功', class: 'badge-success' };
        return { text: '失败', class: 'badge-error' };
    };

    return (
        
            <div className="page-container">
                <div className="page-header">
                    <h2 className="page-title">审计日志</h2>
                </div>

                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <div className="card-body" style={{ display: 'flex', gap: 'var(--space-4)' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                            <label className="form-label">选择租户</label>
                            <select className="form-select" value={selectedTenant || ''} onChange={(e) => setSelectedTenant(Number(e.target.value))}>
                                <option value="">选择租户</option>
                                {tenants.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">日志类型</label>
                            <select className="form-select" value={logType} onChange={(e) => setLogType(e.target.value as 'signins' | 'directory')}>
                                <option value="directory">目录审计</option>
                                <option value="signins">登录日志</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">{logType === 'signins' ? '登录日志' : '目录审计日志'}</span>
                    </div>
                    <div className="table-container">
                        {loading ? (
                            <div className="loading"><div className="spinner"></div></div>
                        ) : logType === 'signins' ? (
                            // 登录日志表格
                            signInLogs.length > 0 ? (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>时间</th>
                                            <th>用户</th>
                                            <th>应用</th>
                                            <th>IP 地址</th>
                                            <th>位置</th>
                                            <th>状态</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {signInLogs.map((log) => (
                                            <tr key={log.id}>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    {log.createdDateTime ? new Date(log.createdDateTime).toLocaleString('zh-CN') : '-'}
                                                </td>
                                                <td>
                                                    <div>{log.userDisplayName || '-'}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{log.userPrincipalName}</div>
                                                </td>
                                                <td>{log.appDisplayName || '-'}</td>
                                                <td>{log.ipAddress || '-'}</td>
                                                <td>{log.location?.city || log.location?.countryOrRegion || '-'}</td>
                                                <td>
                                                    <span className={`badge ${getSignInStatus(log).class}`}>
                                                        {getSignInStatus(log).text}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📋</div>
                                    <div className="empty-state-title">{selectedTenant ? '暂无登录日志' : '请先选择租户'}</div>
                                    <div className="empty-state-desc">需要 Azure AD Premium 许可证和 AuditLog.Read.All 权限</div>
                                </div>
                            )
                        ) : (
                            // 目录审计日志表格
                            directoryLogs.length > 0 ? (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>时间</th>
                                            <th>活动</th>
                                            <th>发起者</th>
                                            <th>目标</th>
                                            <th>结果</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {directoryLogs.map((log) => (
                                            <tr key={log.id}>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    {log.activityDateTime ? new Date(log.activityDateTime).toLocaleString('zh-CN') : '-'}
                                                </td>
                                                <td>{log.activityDisplayName || '-'}</td>
                                                <td>{log.initiatedBy?.user?.displayName || '-'}</td>
                                                <td>{log.targetResources?.[0]?.displayName || '-'}</td>
                                                <td>
                                                    <span className={`badge ${log.result === 'success' ? 'badge-success' : 'badge-warning'}`}>
                                                        {log.result || '-'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📋</div>
                                    <div className="empty-state-title">{selectedTenant ? '暂无审计日志' : '请先选择租户'}</div>
                                    <div className="empty-state-desc">需要 Azure AD Premium 许可证和 AuditLog.Read.All 权限</div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        
    );
};

export default AuditPage;
