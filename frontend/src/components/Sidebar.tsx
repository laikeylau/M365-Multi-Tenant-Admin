import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavChild {
    path: string;
    label: string;
    icon: string;
}

interface NavGroup {
    label: string;
    icon: string;
    children: NavChild[];
}

const navGroups: NavGroup[] = [
    {
        label: '概览',
        icon: '🏠',
        children: [
            { path: '/', label: '仪表盘', icon: '📊' },
        ],
    },
    {
        label: '身份与访问',
        icon: '🔐',
        children: [
            { path: '/users', label: '用户管理', icon: '👥' },
            { path: '/groups', label: '组和角色', icon: '👔' },
            { path: '/entra', label: 'Entra ID', icon: '🆔' },
            { path: '/domains', label: '域名管理', icon: '🌐' },
            { path: '/licenses', label: '许可证管理', icon: '📜' },
        ],
    },
    {
        label: '服务管理',
        icon: '⚙️',
        children: [
            { path: '/exchange', label: 'Exchange Online', icon: '📧' },
            { path: '/teams', label: 'Teams 管理', icon: '💬' },
            { path: '/sharepoint', label: 'SharePoint 管理', icon: '📁' },
            { path: '/storage', label: '存储管理', icon: '💾' },
            { path: '/intune', label: 'Intune 设备', icon: '📱' },
        ],
    },
    {
        label: '安全与合规',
        icon: '🛡️',
        children: [
            { path: '/security', label: 'Security/Defender', icon: '🚨' },
            { path: '/compliance', label: 'Purview 合规', icon: '📋' },
        ],
    },
    {
        label: '监控与报告',
        icon: '📈',
        children: [
            { path: '/health', label: '服务健康', icon: '💚' },
            { path: '/health-report', label: '健检报告', icon: '🏥' },
            { path: '/audit', label: '审计日志', icon: '📋' },
            { path: '/report-center', label: '报表中心', icon: '📊' },
            { path: '/reports', label: '报告导出', icon: '📈' },
        ],
    },
    {
        label: '系统管理',
        icon: '🏢',
        children: [
            { path: '/tenants', label: '多租户管理', icon: '🏢' },
            { path: '/settings', label: '账户设置', icon: '⚙️' },
        ],
    },
];

const Sidebar: React.FC = () => {
    const { logout } = useAuth();
    const location = useLocation();
    const [expandedGroups, setExpandedGroups] = React.useState<string[]>(() => {
        // Auto-expand group that contains the active route
        const active = navGroups.find(g =>
            g.children.some(c => c.path === '/' ? location.pathname === '/' : location.pathname.startsWith(c.path))
        );
        return active ? [active.label] : navGroups.map(g => g.label);
    });

    const toggleGroup = (label: string) => {
        setExpandedGroups(prev =>
            prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
        );
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <span className="sidebar-logo">M365 管理平台</span>
            </div>
            <nav className="sidebar-nav">
                {navGroups.map((group) => {
                    const isExpanded = expandedGroups.includes(group.label);
                    const hasActive = group.children.some(c =>
                        c.path === '/' ? location.pathname === '/' : location.pathname.startsWith(c.path)
                    );

                    return (
                        <div key={group.label}>
                            <div
                                className={`nav-item ${hasActive ? 'active' : ''}`}
                                onClick={() => toggleGroup(group.label)}
                                style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: 0.85 }}
                            >
                                <span className="nav-item-icon">{group.icon}</span>
                                <span className="nav-item-text">{group.label}</span>
                                <span style={{ marginLeft: 'auto', fontSize: '11px' }}>
                                    {isExpanded ? '▼' : '▶'}
                                </span>
                            </div>
                            {isExpanded && (
                                <div className="nav-submenu">
                                    {group.children.map((child) => (
                                        <NavLink
                                            key={child.path}
                                            to={child.path}
                                            end={child.path === '/'}
                                            className={({ isActive }) =>
                                                `nav-item ${isActive ? 'active' : ''}`
                                            }
                                        >
                                            <span className="nav-item-icon">{child.icon}</span>
                                            <span className="nav-item-text">{child.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
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
