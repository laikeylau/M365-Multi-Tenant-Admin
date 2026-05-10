import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                const res = await authApi.login(formData.username, formData.password);
                login(res.data.access_token);
                navigate('/');
            } else {
                if (formData.password !== formData.confirmPassword) {
                    setError('两次输入的密码不一致');
                    setLoading(false);
                    return;
                }
                await authApi.register({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password,
                });
                const res = await authApi.login(formData.username, formData.password);
                login(res.data.access_token);
                navigate('/');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || '操作失败，请检查输入');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1f36 0%, #0d1117 100%)',
            padding: 'var(--space-4)',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                background: 'var(--white)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)',
                    padding: 'var(--space-8) var(--space-6)',
                    textAlign: 'center',
                    color: 'white',
                }}>
                    <div style={{ fontSize: '48px', marginBottom: 'var(--space-2)' }}>🏢</div>
                    <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                        M365 多租户管理
                    </h1>
                    <p style={{ opacity: 0.9, fontSize: 'var(--font-size-sm)' }}>
                        Microsoft 365 统一管理平台
                    </p>
                </div>

                {/* Form */}
                <div style={{ padding: 'var(--space-6)' }}>
                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        marginBottom: 'var(--space-5)',
                        background: 'var(--gray-100)',
                        borderRadius: 'var(--radius-md)',
                        padding: '4px',
                    }}>
                        <button
                            type="button"
                            onClick={() => setIsLogin(true)}
                            style={{
                                flex: 1,
                                padding: 'var(--space-2) var(--space-4)',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                background: isLogin ? 'white' : 'transparent',
                                color: isLogin ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                boxShadow: isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}
                        >
                            登录
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsLogin(false)}
                            style={{
                                flex: 1,
                                padding: 'var(--space-2) var(--space-4)',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                background: !isLogin ? 'white' : 'transparent',
                                color: !isLogin ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                boxShadow: !isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}
                        >
                            注册
                        </button>
                    </div>

                    {error && (
                        <div style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            fontSize: 'var(--font-size-sm)',
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">用户名</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="请输入用户名"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                required
                                minLength={3}
                            />
                        </div>

                        {!isLogin && (
                            <div className="form-group">
                                <label className="form-label">邮箱</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="请输入邮箱"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">密码</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="请输入密码"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                minLength={8}
                            />
                        </div>

                        {!isLogin && (
                            <div className="form-group">
                                <label className="form-label">确认密码</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    placeholder="请再次输入密码"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    required
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: 'var(--space-4)' }}
                            disabled={loading}
                        >
                            {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
                        </button>
                    </form>

                    {!isLogin && (
                        <p style={{
                            marginTop: 'var(--space-4)',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                        }}>
                            首个注册用户将成为超级管理员
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
