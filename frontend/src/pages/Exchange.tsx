import React, { useEffect, useState, useCallback } from 'react';
import { exchangeApi } from '../services/api';
import TenantSelector from '../components/TenantSelector';

type Tab = 'rules' | 'mailbox';

const ExchangePage: React.FC = () => {
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [tab, setTab] = useState<Tab>('rules');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Transport rules
    const [rules, setRules] = useState<any[]>([]);

    // Mailbox
    const [mailboxUser, setMailboxUser] = useState('');
    const [mailboxSettings, setMailboxSettings] = useState<any>(null);

    const fetchRules = useCallback(async () => {
        if (!tenantId) return;
        setLoading(true);
        setError('');
        try {
            const res = await exchangeApi.getTransportRules(tenantId);
            setRules(res.data?.value || []);
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message);
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    const fetchMailboxSettings = useCallback(async () => {
        if (!tenantId || !mailboxUser) return;
        setLoading(true);
        setError('');
        try {
            const res = await exchangeApi.getMailboxSettings(tenantId, mailboxUser);
            setMailboxSettings(res.data);
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message);
            setMailboxSettings(null);
        } finally {
            setLoading(false);
        }
    }, [tenantId, mailboxUser]);

    useEffect(() => {
        if (tenantId && tab === 'rules') fetchRules();
    }, [tenantId, tab, fetchRules]);

    return (
        <div>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>📧 Exchange Online 管理</h2>
            <TenantSelector selectedTenant={tenantId} onSelect={setTenantId} />

            <div className="card">
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--gray-200)', paddingBottom: 'var(--space-2)' }}>
                    <button className={`btn ${tab === 'rules' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('rules')}>📋 邮件流规则</button>
                    <button className={`btn ${tab === 'mailbox' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('mailbox')}>📬 邮箱设置</button>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}

                {tab === 'rules' && (
                    <div>
                        <h3>邮件流规则 (Transport Rules)</h3>
                        {loading ? <div className="loading" /> : (
                            <table className="table" style={{ marginTop: 'var(--space-3)' }}>
                                <thead>
                                    <tr><th>名称</th><th>优先级</th><th>状态</th><th>描述</th></tr>
                                </thead>
                                <tbody>
                                    {rules.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>暂无数据</td></tr>
                                    ) : rules.map((r: any, i: number) => (
                                        <tr key={r.id || i}>
                                            <td>{r.name || r.displayName}</td>
                                            <td>{r.priority}</td>
                                            <td><span className={`badge ${r.state === 'enabled' ? 'badge-success' : 'badge-secondary'}`}>{r.state || 'N/A'}</span></td>
                                            <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {tab === 'mailbox' && (
                    <div>
                        <h3>邮箱设置查询</h3>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
                            <input className="form-input" placeholder="输入用户 ID 或 UPN" value={mailboxUser} onChange={(e) => setMailboxUser(e.target.value)} style={{ maxWidth: 400 }} />
                            <button className="btn btn-primary" onClick={fetchMailboxSettings} disabled={!mailboxUser}>查询</button>
                        </div>
                        {loading && <div className="loading" />}
                        {mailboxSettings && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                                <div className="card" style={{ background: 'var(--gray-50)' }}>
                                    <h4>自动回复</h4>
                                    <p><strong>状态:</strong> {mailboxSettings.automaticReplies?.status || 'disabled'}</p>
                                    <p><strong>内部消息:</strong> {mailboxSettings.automaticReplies?.internalReplyMessage || '-'}</p>
                                    <p><strong>外部消息:</strong> {mailboxSettings.automaticReplies?.externalReplyMessage || '-'}</p>
                                </div>
                                <div className="card" style={{ background: 'var(--gray-50)' }}>
                                    <h4>转发</h4>
                                    <p><strong>转发到:</strong> {mailboxSettings.forwarding?.smtpAddress || '未设置'}</p>
                                    <p><strong>启用:</strong> {mailboxSettings.forwarding?.enabled ? '是' : '否'}</p>
                                </div>
                                <div className="card" style={{ background: 'var(--gray-50)' }}>
                                    <h4>语言与时区</h4>
                                    <p><strong>语言:</strong> {mailboxSettings.language?.locale || '-'}</p>
                                    <p><strong>时区:</strong> {mailboxSettings.timeZone || '-'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExchangePage;
