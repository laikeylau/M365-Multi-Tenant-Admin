import React, { useEffect, useState, useRef, useCallback } from 'react';
import { autoRegisterApi, tenantApi } from '../services/api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type Step = 'intro' | 'code' | 'polling' | 'creating' | 'success' | 'error';

interface AppResult {
    appId: string;
    appObjectId: string;
    servicePrincipalId: string;
    clientSecret: string;
    tenantId: string;
    tenantDisplayName: string;
    displayName: string;
    resolvedPermissions: string[];
    missingPermissions: string[];
    consentErrors: string[];
}

const AutoRegisterModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState<Step>('intro');
    const [flowId, setFlowId] = useState('');
    const [userCode, setUserCode] = useState('');
    const [verificationUri, setVerificationUri] = useState('');
    const [message, setMessage] = useState('');
    const [expiresIn, setExpiresIn] = useState(900);
    const [countdown, setCountdown] = useState(0);
    const [appResult, setAppResult] = useState<AppResult | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tenantName, setTenantName] = useState('');
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const cleanup = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    }, []);

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    const startFlow = async () => {
        setStep('code');
        setError('');
        try {
            const res = await autoRegisterApi.start();
            const { flow_id, user_code, verification_uri, expires_in, message: msg } = res.data;
            setFlowId(flow_id);
            setUserCode(user_code);
            setVerificationUri(verification_uri);
            setExpiresIn(expires_in);
            setMessage(msg);
            setCountdown(expires_in);
            setStep('code');

            // Start countdown
            countdownRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        cleanup();
                        setStep('error');
                        setError('登录超时，请重试');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (e: any) {
            setStep('error');
            setError(e.response?.data?.detail || e.message);
        }
    };

    const startPolling = () => {
        setStep('polling');
        pollRef.current = setInterval(async () => {
            try {
                const res = await autoRegisterApi.status(flowId);
                const { status, app, error: err } = res.data;

                if (status === 'creating') {
                    setStep('creating');
                } else if (status === 'success' && app) {
                    cleanup();
                    setAppResult(app);
                    setTenantName(app.tenantDisplayName || '');
                    setStep('success');
                } else if (status === 'error') {
                    cleanup();
                    setStep('error');
                    setError(err || 'Unknown error');
                }
                // status === 'pending' or 'authenticated' → keep polling
            } catch (e: any) {
                cleanup();
                setStep('error');
                setError(e.response?.data?.detail || e.message);
            }
        }, 3000);
    };

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(userCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = userCode;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const openLogin = () => {
        window.open(verificationUri, '_blank', 'noopener,noreferrer');
        startPolling();
    };

    const saveAsTenant = async () => {
        if (!appResult || !tenantName.trim()) return;
        if (!appResult.tenantId) {
            setError('Tenant ID 无法自动检测，请使用手动添加租户功能填写上方信息。');
            return;
        }
        setSaving(true);
        try {
            await tenantApi.create({
                name: tenantName.trim(),
                tenant_id: appResult.tenantId,
                client_id: appResult.appId,
                client_secret: appResult.clientSecret,
            });
            onSuccess();
            handleClose();
        } catch (e: any) {
            setError(`保存失败: ${e.response?.data?.detail || e.message}。请使用手动添加租户功能填写上方信息。`);
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        cleanup();
        if (flowId) {
            autoRegisterApi.cancel(flowId).catch(() => {});
        }
        setStep('intro');
        setFlowId('');
        setUserCode('');
        setAppResult(null);
        setError('');
        setTenantName('');
        onClose();
    };

    if (!isOpen) return null;

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div style={{
                background: 'white', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)',
                maxWidth: 600, width: '95%', maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                    <h2 style={{ margin: 0 }}>🚀 自动注册 Azure AD 应用</h2>
                    <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--gray-500)' }}>✕</button>
                </div>

                {/* Step: Intro */}
                {step === 'intro' && (
                    <div>
                        <p>此功能将引导全局管理员登录，自动完成以下操作：</p>
                        <ol style={{ paddingLeft: 'var(--space-4)', lineHeight: 2 }}>
                            <li>🔐 使用全局管理员身份登录 Microsoft 365</li>
                            <li>📝 创建 Azure AD 应用注册</li>
                            <li>🔑 生成客户端密钥</li>
                            <li>🛡️ 分配所有必需的 Graph API 权限</li>
                            <li>✅ 授予管理员同意</li>
                        </ol>
                        <div className="alert alert-warning" style={{ margin: 'var(--space-4) 0' }}>
                            ⚠️ 需要使用 <strong>全局管理员</strong> 账号登录目标租户。此操作会在目标租户中创建一个新的应用注册。
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={handleClose}>取消</button>
                            <button className="btn btn-primary" onClick={startFlow}>🚀 开始注册</button>
                        </div>
                    </div>
                )}

                {/* Step: Device Code */}
                {step === 'code' && (
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 16, marginBottom: 'var(--space-4)' }}>
                            请在新窗口中登录您的 Microsoft 365 全局管理员账号
                        </p>

                        <div style={{
                            background: 'var(--gray-50)', border: '2px dashed var(--primary)',
                            borderRadius: 'var(--radius-md)', padding: 'var(--space-5)',
                            marginBottom: 'var(--space-4)',
                        }}>
                            <p style={{ margin: '0 0 var(--space-2)', fontSize: 14, color: 'var(--gray-600)' }}>
                                访问以下地址并输入代码：
                            </p>
                            <a href={verificationUri} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 18, fontWeight: 600, display: 'block', marginBottom: 'var(--space-3)' }}>
                                {verificationUri}
                            </a>
                            <div style={{
                                fontSize: 32, fontWeight: 700, fontFamily: 'monospace',
                                letterSpacing: 4, color: 'var(--primary)',
                                background: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                                border: '2px solid var(--primary)',
                            }}>
                                {userCode}
                            </div>
                            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                                <button className="btn btn-secondary" onClick={copyCode}>
                                    {copied ? '✅ 已复制' : '📋 复制代码'}
                                </button>
                                <button className="btn btn-primary" onClick={openLogin}>
                                    🌐 打开登录页面
                                </button>
                            </div>
                        </div>

                        <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>
                            ⏱️ 剩余时间: <strong>{formatTime(countdown)}</strong> &nbsp;|&nbsp;
                            输入代码后点击"打开登录页面"完成登录
                        </p>
                    </div>
                )}

                {/* Step: Polling */}
                {step === 'polling' && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                        <div className="loading" style={{ margin: '0 auto var(--space-4)' }} />
                        <h3>⏳ 等待登录...</h3>
                        <p style={{ color: 'var(--gray-500)' }}>
                            请在浏览器中完成登录操作。<br />
                            剩余时间: <strong>{formatTime(countdown)}</strong>
                        </p>
                        {message && <p style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 'var(--space-2)' }}>{message}</p>}
                    </div>
                )}

                {/* Step: Creating */}
                {step === 'creating' && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                        <div className="loading" style={{ margin: '0 auto var(--space-4)' }} />
                        <h3>🔧 正在创建应用注册...</h3>
                        <p style={{ color: 'var(--gray-500)' }}>
                            正在执行以下操作：<br />
                            ✅ 身份验证完成<br />
                            🔄 创建应用注册 + 服务主体<br />
                            🔄 生成客户端密钥<br />
                            🔄 分配权限 + 授权同意
                        </p>
                    </div>
                )}

                {/* Step: Success */}
                {step === 'success' && appResult && (
                    <div>
                        <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
                            ✅ 应用注册创建成功！
                        </div>

                        <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                            <div className="card" style={{ background: 'var(--gray-50)' }}>
                                <h4 style={{ margin: '0 0 var(--space-2)' }}>📝 应用信息</h4>
                                <table style={{ width: '100%', fontSize: 14 }}>
                                    <tbody>
                                        <tr><td style={{ fontWeight: 600, width: 120 }}>应用名称:</td><td>{appResult.displayName}</td></tr>
                                        <tr><td style={{ fontWeight: 600 }}>租户名称:</td><td>{appResult.tenantDisplayName || '-'}</td></tr>
                                        <tr><td style={{ fontWeight: 600 }}>Tenant ID:</td><td style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{appResult.tenantId || '(自动检测失败，请手动填写)'}</td></tr>
                                        <tr><td style={{ fontWeight: 600 }}>Application ID:</td><td style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{appResult.appId}</td></tr>
                                        <tr><td style={{ fontWeight: 600 }}>客户端密钥:</td><td style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{appResult.clientSecret}</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="card" style={{ background: 'var(--gray-50)' }}>
                                <h4 style={{ margin: '0 0 var(--space-2)' }}>🛡️ 已分配权限 ({appResult.resolvedPermissions.length})</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {appResult.resolvedPermissions.map(p => (
                                        <span key={p} className="badge badge-success" style={{ fontSize: 11 }}>{p}</span>
                                    ))}
                                </div>
                            </div>

                            {appResult.missingPermissions.length > 0 && (
                                <div className="alert alert-warning">
                                    ⚠️ 以下权限未找到: {appResult.missingPermissions.join(', ')}
                                </div>
                            )}

                            {appResult.consentErrors.length > 0 && (
                                <div className="alert alert-warning">
                                    ⚠️ 部分权限授权失败，可能需要手动授权：<br />
                                    {appResult.consentErrors.map((e, i) => <span key={i} style={{ fontSize: 12 }}>{e}<br /></span>)}
                                </div>
                            )}
                        </div>

                        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                            <h4 style={{ margin: '0 0 var(--space-3)' }}>💾 保存为租户</h4>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13 }}>租户名称</label>
                                    <input className="form-input" placeholder="例如: Contoso 生产环境" value={tenantName} onChange={e => setTenantName(e.target.value)} />
                                </div>
                                <button className="btn btn-primary" onClick={saveAsTenant} disabled={!tenantName.trim() || saving}>
                                    {saving ? '保存中...' : '💾 保存'}
                                </button>
                            </div>
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-3)' }}>{error}</div>}

                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={handleClose}>关闭</button>
                        </div>
                    </div>
                )}

                {/* Step: Error */}
                {step === 'error' && (
                    <div>
                        <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>
                            ❌ {error || '操作失败'}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={handleClose}>关闭</button>
                            <button className="btn btn-primary" onClick={() => { setStep('intro'); setError(''); }}>🔄 重试</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutoRegisterModal;
