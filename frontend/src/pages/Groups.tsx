import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { groupsApi, tenantApi, Tenant } from '../services/api';

interface Group {
    id: string;
    displayName?: string;
    description?: string;
    mail?: string;
    mailEnabled?: boolean;
    securityEnabled?: boolean;
}

interface Member {
    id: string;
    displayName?: string;
    userPrincipalName?: string;
    mail?: string;
    jobTitle?: string;
}

const GroupsPage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        displayName: '',
        description: '',
        mailNickname: '',
        securityEnabled: true,
        mailEnabled: false,
    });

    /* ── member viewing ── */
    const [membersGroup, setMembersGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    useEffect(() => {
        fetchTenants();
    }, []);

    useEffect(() => {
        if (selectedTenant) {
            fetchGroups();
        }
    }, [selectedTenant]);

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

    const fetchGroups = async () => {
        if (!selectedTenant) return;
        setLoading(true);
        try {
            const res = await groupsApi.list(selectedTenant);
            setGroups(res.data);
        } catch (error) {
            console.error('Failed to fetch groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTenant) return;
        try {
            await groupsApi.create(selectedTenant, formData);
            setShowModal(false);
            setFormData({ displayName: '', description: '', mailNickname: '', securityEnabled: true, mailEnabled: false });
            fetchGroups();
        } catch (error) {
            alert('创建组失败');
        }
    };

    const handleViewMembers = async (group: Group) => {
        if (!selectedTenant) return;
        setMembersGroup(group);
        setMembers([]);
        setMembersLoading(true);
        try {
            const res = await groupsApi.getMembers(selectedTenant, group.id);
            setMembers(Array.isArray(res.data) ? res.data : res.data?.value || []);
        } catch (error) {
            console.error('Failed to fetch members:', error);
            setMembers([]);
        } finally {
            setMembersLoading(false);
        }
    };

    return (

        <div className="page-container">
            <div className="page-header">
                <h2 className="page-title">组和角色</h2>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ 新建组</button>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="card-body">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">选择租户</label>
                        <select
                            className="form-select"
                            value={selectedTenant || ''}
                            onChange={(e) => setSelectedTenant(Number(e.target.value))}
                        >
                            <option value="">选择租户</option>
                            {tenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <span className="card-title">组列表</span>
                    <span style={{ color: 'var(--text-muted)' }}>共 {groups.length} 个组</span>
                </div>
                <div className="table-container">
                    {loading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : groups.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>组名称</th>
                                    <th>描述</th>
                                    <th>邮箱</th>
                                    <th>类型</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map((group) => (
                                    <tr key={group.id}>
                                        <td style={{ fontWeight: 500 }}>{group.displayName || '-'}</td>
                                        <td>{group.description || '-'}</td>
                                        <td>{group.mail || '-'}</td>
                                        <td>
                                            <span className={`badge ${group.securityEnabled ? 'badge-info' : 'badge-warning'}`}>
                                                {group.securityEnabled ? '安全组' : '分发组'}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-sm btn-secondary" onClick={() => handleViewMembers(group)}>查看成员</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">👔</div>
                            <div className="empty-state-title">{selectedTenant ? '暂无组数据' : '请先选择租户'}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create Group Modal ── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">新建组</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateGroup}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">组名称 *</label>
                                    <input type="text" className="form-input" value={formData.displayName}
                                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">邮箱别名 *</label>
                                    <input type="text" className="form-input" value={formData.mailNickname}
                                        onChange={(e) => setFormData({ ...formData, mailNickname: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">描述</label>
                                    <textarea className="form-input" value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
                                <button type="submit" className="btn btn-primary">创建</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Members Modal ── */}
            {membersGroup && (
                <div className="modal-overlay" onClick={() => setMembersGroup(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {membersGroup.displayName} — 成员列表
                            </h3>
                            <button className="modal-close" onClick={() => setMembersGroup(null)}>×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: 440, overflowY: 'auto' }}>
                            {membersLoading ? (
                                <div className="loading" style={{ padding: 40 }}><div className="spinner"></div></div>
                            ) : members.length > 0 ? (
                                <table className="table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>姓名</th>
                                            <th>邮箱 / UPN</th>
                                            <th>职位</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {members.map((m) => (
                                            <tr key={m.id}>
                                                <td style={{ fontWeight: 500 }}>{m.displayName || '-'}</td>
                                                <td style={{ fontSize: 13 }}>{m.userPrincipalName || m.mail || '-'}</td>
                                                <td>{m.jobTitle || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                    该组暂无成员
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <span style={{ color: 'var(--text-muted)', fontSize: 13, marginRight: 'auto' }}>
                                共 {members.length} 个成员
                            </span>
                            <button className="btn btn-secondary" onClick={() => setMembersGroup(null)}>关闭</button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};

export default GroupsPage;
