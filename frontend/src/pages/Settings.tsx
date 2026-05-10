import React, { useState } from 'react';
import { authApi } from '../services/api';

const SettingsPage: React.FC = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwMsg, setPwMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [pwLoading, setPwLoading] = useState(false);

    const handleChangePassword = async () => {
        setPwMsg(null);
        if (!currentPassword || !newPassword) {
            setPwMsg({ text: '请填写当前密码和新密码', type: 'error' }); return;
        }
        if (newPassword.length < 6) {
            setPwMsg({ text: '新密码长度至少 6 位', type: 'error' }); return;
        }
        if (newPassword !== confirmPassword) {
            setPwMsg({ text: '两次输入的新密码不一致', type: 'error' }); return;
        }
        setPwLoading(true);
        try {
            await authApi.changePassword(currentPassword, newPassword);
            setPwMsg({ text: '密码修改成功！', type: 'success' });
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (e: any) {
            const detail = e.response?.data?.detail || '密码修改失败';
            setPwMsg({ text: detail, type: 'error' });
        } finally {
            setPwLoading(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h2 className="page-title">账户设置</h2>
            </div>

            {/* 系统设置 */}
            <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="card-body">
                    <h3 style={{ marginBottom: 'var(--space-4)' }}>系统设置</h3>
                    <div className="form-group">
                        <label className="form-label">应用名称</label>
                        <input type="text" className="form-input" defaultValue="M365 Multi-Tenant Admin" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">自动刷新间隔（分钟）</label>
                        <input type="number" className="form-input" defaultValue="5" min="1" max="60" />
                    </div>
                    <button className="btn btn-primary">保存设置</button>
                </div>
            </div>

            {/* 修改密码 */}
            <div className="card">
                <div className="card-body">
                    <h3 style={{ marginBottom: 'var(--space-4)' }}>🔑 修改密码</h3>
                    {pwMsg && (
                        <div style={{
                            padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)', fontSize: '0.9rem',
                            background: pwMsg.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: pwMsg.type === 'success' ? 'var(--success)' : 'var(--error)',
                            border: `1px solid ${pwMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        }}>
                            {pwMsg.text}
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">当前密码</label>
                        <input type="password" className="form-input" value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)} placeholder="输入当前密码" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">新密码</label>
                        <input type="password" className="form-input" value={newPassword}
                            onChange={e => setNewPassword(e.target.value)} placeholder="至少 6 位" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">确认新密码</label>
                        <input type="password" className="form-input" value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" />
                    </div>
                    <button className="btn btn-primary" onClick={handleChangePassword} disabled={pwLoading}>
                        {pwLoading ? '修改中...' : '修改密码'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
