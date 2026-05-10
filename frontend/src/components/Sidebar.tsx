import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
    path: string;
    label: string;
    icon: string;
    children?: { path: string; label: string }[];
}

const navItems: NavItem[] = [
    { path: '/', label: '仪表盘', icon: '📊' },
    {
        path: '/users',
        label: '用户管理',
        icon: '👥',
        children: [
            { path: '/users', label: '用户列表' },
            { path: '/users/invite', label: '用户邀请' },
            { path: '/users/import', label: '批量导入' },
        ],
    },
    { path: '/licenses', label: '许可证管理', icon: '📜' },
    { path: '/storage', label: '存储管理', icon: '💾' },
    { path: '/groups', label: '组和角色', icon: '👔' },
    { path: '/domains', label: '域名管理', icon: '🌐' },
    { path: '/audit', label: '审计日志', icon: '📋' },
    { path: '/health', label: '服务健康', icon: '💚' },
    { path: '/reports', label: '报告导出', icon: '📈' },
    { path: '/report-center', label: '报表中心', icon: '📊' },
    { path: '/health-report', label: '健检报告', icon: '🏥' },
    { path: '/tenants', label: '多租户管理', icon: '🏢' },
    { path: '/settings', label: '账户设置', icon: '⚙️' },
];

const Sidebar: React.FC = () => {
    const { logout } = useAuth();
    const location = useLocation();
    const [expandedItems, setExpandedItems] = React.useState<string[]>(['/users']);

    const toggleExpand = (path: string) => {
        setExpandedItems((prev) =>
            prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
        );
    };

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <span className="sidebar-logo">Office 365 管理</span>
            </div>
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <div key={item.path}>
                        {item.children ? (
                            <>
                                <div
                                    className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                    onClick={() => toggleExpand(item.path)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <span className="nav-item-icon">{item.icon}</span>
                                    <span className="nav-item-text">{item.label}</span>
                                    <span style={{ marginLeft: 'auto', fontSize: '12px' }}>
                                        {expandedItems.includes(item.path) ? '▼' : '▶'}
                                    </span>
                                </div>
                                {expandedItems.includes(item.path) && (
                                    <div className="nav-submenu">
                                        {item.children.map((child) => (
                                            <NavLink
                                                key={child.path}
                                                to={child.path}
                                                className={({ isActive }) =>
                                                    `nav-item ${isActive ? 'active' : ''}`
                                                }
                                            >
                                                <span className="nav-item-text">{child.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                    `nav-item ${isActive ? 'active' : ''}`
                                }
                            >
                                <span className="nav-item-icon">{item.icon}</span>
                                <span className="nav-item-text">{item.label}</span>
                            </NavLink>
                        )}
                    </div>
                ))}
            </nav>

            {/* Logout Button */}
            <div style={{
                marginTop: 'auto',
                padding: 'var(--space-4)',
                borderTop: '1px solid rgba(255,255,255,0.1)'
            }}>
                <button
                    onClick={logout}
                    style={{
                        width: '100%',
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        color: 'rgba(255,255,255,0.8)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                    <span>🚪</span>
                    <span>退出登录</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
