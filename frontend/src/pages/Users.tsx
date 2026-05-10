import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usersApi, tenantApi, licensesApi, M365User, Tenant, License } from '../services/api';

interface EditForm {
    displayName: string;
    jobTitle: string;
    department: string;
    accountEnabled: boolean;
}

interface UserLicense {
    skuId: string;
    skuPartNumber?: string;
}

const UsersPage: React.FC = () => {
    const location = useLocation();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [users, setUsers] = useState<M365User[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // 邀请用户表单
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);

    // 批量导入
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState('');
    const [importing, setImporting] = useState(false);

    // 编辑用户
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState<M365User | null>(null);
    const [editForm, setEditForm] = useState<EditForm>({
        displayName: '', jobTitle: '', department: '', accountEnabled: true,
    });
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'license'>('info');

    // 许可证
    const [userLicenses, setUserLicenses] = useState<UserLicense[]>([]);
    const [tenantLicenses, setTenantLicenses] = useState<License[]>([]);
    const [loadingLicenses, setLoadingLicenses] = useState(false);
    const [licenseOperating, setLicenseOperating] = useState<string | null>(null);

    // 删除用户
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingUser, setDeletingUser] = useState<M365User | null>(null);
    const [deleting, setDeleting] = useState(false);

    // 判断当前是哪个子页面
    const isInvitePage = location.pathname === '/users/invite';
    const isImportPage = location.pathname === '/users/import';

    useEffect(() => {
        fetchTenants();
    }, []);

    useEffect(() => {
        if (selectedTenant && !isInvitePage && !isImportPage) {
            fetchUsers();
        }
    }, [selectedTenant]);

    useEffect(() => {
        if (isInvitePage) setShowInviteModal(true);
        if (isImportPage) setShowImportModal(true);
    }, [isInvitePage, isImportPage]);

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

    const fetchUsers = async () => {
        if (!selectedTenant) return;
        setLoading(true);
        try {
            const res = await usersApi.list(selectedTenant, { top: 100, search: searchQuery || undefined });
            setUsers(res.data);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchUsers();
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTenant) { alert('请先选择租户'); return; }
        setInviting(true);
        try {
            await usersApi.invite(selectedTenant, { email: inviteEmail });
            alert('邀请已发送！');
            setShowInviteModal(false);
            setInviteEmail('');
        } catch (error) {
            alert('邀请失败');
        } finally {
            setInviting(false);
        }
    };

    const handleBulkImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTenant) { alert('请先选择租户'); return; }
        setImporting(true);
        try {
            const lines = importData.trim().split('\n').filter(l => l.trim());
            const users = lines.map(line => {
                const [displayName, userPrincipalName, password] = line.split(',').map(s => s.trim());
                return {
                    displayName,
                    userPrincipalName,
                    mailNickname: userPrincipalName.split('@')[0],
                    password: password || 'TempP@ss123!',
                    forceChangePasswordNextSignIn: true
                };
            });
            const result = await usersApi.bulkImport(selectedTenant, users);
            alert(`导入完成！成功: ${result.data.success?.length || 0}, 失败: ${result.data.failed?.length || 0}`);
            setShowImportModal(false);
            setImportData('');
            fetchUsers();
        } catch (error) {
            alert('导入失败');
        } finally {
            setImporting(false);
        }
    };

    // ==================== 编辑用户 ====================
    const handleEdit = async (user: M365User) => {
        setEditingUser(user);
        setEditForm({
            displayName: user.displayName || '',
            jobTitle: user.jobTitle || '',
            department: user.department || '',
            accountEnabled: user.accountEnabled !== false,
        });
        setActiveTab('info');
        setUserLicenses([]);
        setTenantLicenses([]);
        setShowEditModal(true);

        // 加载许可证数据
        if (selectedTenant && user.id) {
            setLoadingLicenses(true);
            try {
                const [userLicRes, tenantLicRes] = await Promise.all([
                    usersApi.getLicenses(selectedTenant, user.id),
                    licensesApi.list(selectedTenant),
                ]);
                setUserLicenses(userLicRes.data || []);
                setTenantLicenses(tenantLicRes.data || []);
            } catch (error) {
                console.error('Failed to load licenses:', error);
            } finally {
                setLoadingLicenses(false);
            }
        }
    };

    const handleSaveEdit = async () => {
        if (!selectedTenant || !editingUser) return;
        setSaving(true);
        try {
            const payload: Record<string, any> = {};
            if (editForm.displayName !== (editingUser.displayName || ''))
                payload.displayName = editForm.displayName;
            if (editForm.jobTitle !== (editingUser.jobTitle || ''))
                payload.jobTitle = editForm.jobTitle;
            if (editForm.department !== (editingUser.department || ''))
                payload.department = editForm.department;
            if (editForm.accountEnabled !== editingUser.accountEnabled)
                payload.accountEnabled = editForm.accountEnabled;

            if (Object.keys(payload).length === 0) {
                setShowEditModal(false);
                return;
            }

            await usersApi.update(selectedTenant, editingUser.id, payload);
            alert('用户信息已更新');
            setShowEditModal(false);
            fetchUsers();
        } catch (error: any) {
            alert('保存失败：' + (error.response?.data?.detail || error.message));
        } finally {
            setSaving(false);
        }
    };

    const handleAssignLicense = async (skuId: string) => {
        if (!selectedTenant || !editingUser) return;
        setLicenseOperating(skuId);
        try {
            await licensesApi.assign(selectedTenant, editingUser.id, skuId);
            // 刷新用户许可
            const res = await usersApi.getLicenses(selectedTenant, editingUser.id);
            setUserLicenses(res.data || []);
            // 刷新租户许可（更新已用数量）
            const tenantRes = await licensesApi.list(selectedTenant);
            setTenantLicenses(tenantRes.data || []);
        } catch (error: any) {
            alert('分配许可失败：' + (error.response?.data?.detail || error.message));
        } finally {
            setLicenseOperating(null);
        }
    };

    const handleRemoveLicense = async (skuId: string) => {
        if (!selectedTenant || !editingUser) return;
        if (!confirm('确定要移除此许可证？')) return;
        setLicenseOperating(skuId);
        try {
            await licensesApi.remove(selectedTenant, editingUser.id, skuId);
            const res = await usersApi.getLicenses(selectedTenant, editingUser.id);
            setUserLicenses(res.data || []);
            const tenantRes = await licensesApi.list(selectedTenant);
            setTenantLicenses(tenantRes.data || []);
        } catch (error: any) {
            alert('移除许可失败：' + (error.response?.data?.detail || error.message));
        } finally {
            setLicenseOperating(null);
        }
    };

    // ==================== 删除用户 ====================
    const handleDelete = (user: M365User) => {
        setDeletingUser(user);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedTenant || !deletingUser) return;
        setDeleting(true);
        try {
            await usersApi.delete(selectedTenant, deletingUser.id);
            alert('用户已删除');
            setShowDeleteConfirm(false);
            setDeletingUser(null);
            fetchUsers();
        } catch (error: any) {
            alert('删除失败：' + (error.response?.data?.detail || error.message));
        } finally {
            setDeleting(false);
        }
    };

    // 许可证辅助函数
    const userHasLicense = (skuId: string) =>
        userLicenses.some(l => l.skuId === skuId);

    return (

        <div className="page-container">
            <div className="page-header">
                <h2 className="page-title">
                    {isInvitePage ? '用户邀请' : isImportPage ? '批量导入' : '用户管理'}
                </h2>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-secondary" onClick={() => setShowInviteModal(true)}>📧 邀请用户</button>
                    <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>📥 批量导入</button>
                    <button className="btn btn-primary">+ 新建用户</button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                <div className="card-body" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                        <label className="form-label">选择租户</label>
                        <select className="form-select" value={selectedTenant || ''} onChange={(e) => setSelectedTenant(Number(e.target.value))}>
                            <option value="">选择租户</option>
                            {tenants.map((tenant) => (<option key={tenant.id} value={tenant.id}>{tenant.name}</option>))}
                        </select>
                    </div>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-2)', flex: 2 }}>
                        <input type="text" className="form-input" placeholder="搜索用户名或邮箱..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        <button type="submit" className="btn btn-primary">🔍 搜索</button>
                    </form>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <span className="card-title">用户列表</span>
                    <span style={{ color: 'var(--text-muted)' }}>共 {users.length} 个用户</span>
                </div>
                <div className="table-container">
                    {loading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : users.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr><th>显示名称</th><th>用户主体名</th><th>邮箱</th><th>状态</th><th>职位</th><th>部门</th><th>操作</th></tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.displayName || '-'}</td>
                                        <td>{user.userPrincipalName || '-'}</td>
                                        <td>{user.mail || '-'}</td>
                                        <td><span className={`badge ${user.accountEnabled ? 'badge-success' : 'badge-error'}`}>{user.accountEnabled ? '启用' : '禁用'}</span></td>
                                        <td>{user.jobTitle || '-'}</td>
                                        <td>{user.department || '-'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(user)}>编辑</button>
                                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(user)}>删除</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon">👥</div>
                            <div className="empty-state-title">{selectedTenant ? '暂无用户数据' : '请先选择租户'}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* 邀请用户模态框 */}
            {showInviteModal && (
                <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">邀请外部用户</h3>
                            <button className="modal-close" onClick={() => setShowInviteModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleInvite}>
                            <div className="modal-body">
                                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>输入外部用户的邮箱地址，系统将发送邀请邮件。</p>
                                <div className="form-group">
                                    <label className="form-label">邮箱地址 *</label>
                                    <input type="email" className="form-input" placeholder="user@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>取消</button>
                                <button type="submit" className="btn btn-primary" disabled={inviting}>{inviting ? '发送中...' : '发送邀请'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 批量导入模态框 */}
            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">批量导入用户</h3>
                            <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleBulkImport}>
                            <div className="modal-body">
                                <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>每行一个用户，格式：显示名称,用户主体名,密码（可选）</p>
                                <div className="form-group">
                                    <label className="form-label">用户数据</label>
                                    <textarea className="form-input" rows={8} placeholder={'张三,zhangsan@yourdomain.com,Password123!\n李四,lisi@yourdomain.com'} value={importData} onChange={(e) => setImportData(e.target.value)} required />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>取消</button>
                                <button type="submit" className="btn btn-primary" disabled={importing}>{importing ? '导入中...' : '开始导入'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 编辑用户模态框 */}
            {showEditModal && editingUser && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">编辑用户 - {editingUser.displayName}</h3>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
                        </div>

                        {/* Tab 切换 */}
                        <div style={{
                            display: 'flex', borderBottom: '1px solid var(--border-color)',
                            padding: '0 var(--space-4)',
                        }}>
                            <button
                                onClick={() => setActiveTab('info')}
                                style={{
                                    padding: 'var(--space-3) var(--space-4)',
                                    border: 'none', background: 'none', cursor: 'pointer',
                                    borderBottom: activeTab === 'info' ? '2px solid var(--primary)' : '2px solid transparent',
                                    color: activeTab === 'info' ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: activeTab === 'info' ? 600 : 400,
                                }}
                            >
                                基本信息
                            </button>
                            <button
                                onClick={() => setActiveTab('license')}
                                style={{
                                    padding: 'var(--space-3) var(--space-4)',
                                    border: 'none', background: 'none', cursor: 'pointer',
                                    borderBottom: activeTab === 'license' ? '2px solid var(--primary)' : '2px solid transparent',
                                    color: activeTab === 'license' ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: activeTab === 'license' ? 600 : 400,
                                }}
                            >
                                许可证
                            </button>
                        </div>

                        {activeTab === 'info' ? (
                            <>
                                <div className="modal-body">
                                    {/* 只读字段 */}
                                    <div className="form-group">
                                        <label className="form-label">用户主体名 (UPN)</label>
                                        <input type="text" className="form-input" value={editingUser.userPrincipalName || ''} disabled
                                            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">显示名称</label>
                                        <input type="text" className="form-input"
                                            value={editForm.displayName}
                                            onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">职位</label>
                                        <input type="text" className="form-input"
                                            value={editForm.jobTitle}
                                            onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">部门</label>
                                        <input type="text" className="form-input"
                                            value={editForm.department}
                                            onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <input type="checkbox"
                                                checked={editForm.accountEnabled}
                                                onChange={(e) => setEditForm({ ...editForm, accountEnabled: e.target.checked })} />
                                            账户启用
                                        </label>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>取消</button>
                                    <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSaveEdit}>
                                        {saving ? '保存中...' : '保存'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="modal-body">
                                {loadingLicenses ? (
                                    <div className="loading"><div className="spinner"></div></div>
                                ) : (
                                    <>
                                        {/* 当前许可 */}
                                        <h4 style={{ marginBottom: 'var(--space-3)', fontSize: '0.95rem' }}>当前许可证</h4>
                                        {userLicenses.length > 0 ? (
                                            <div style={{ marginBottom: 'var(--space-5)' }}>
                                                {userLicenses.map((lic) => {
                                                    const info = tenantLicenses.find(t => t.skuId === lic.skuId);
                                                    return (
                                                        <div key={lic.skuId} style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            padding: 'var(--space-2) var(--space-3)',
                                                            borderRadius: '6px', marginBottom: 'var(--space-2)',
                                                            backgroundColor: 'var(--bg-secondary)',
                                                        }}>
                                                            <span style={{ fontSize: '0.9rem' }}>
                                                                {info?.skuPartNumber || lic.skuPartNumber || lic.skuId}
                                                            </span>
                                                            <button
                                                                className="btn btn-sm btn-danger"
                                                                disabled={licenseOperating === lic.skuId}
                                                                onClick={() => handleRemoveLicense(lic.skuId)}
                                                            >
                                                                {licenseOperating === lic.skuId ? '移除中...' : '移除'}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>该用户暂无许可证</p>
                                        )}

                                        {/* 可分配许可 */}
                                        <h4 style={{ marginBottom: 'var(--space-3)', fontSize: '0.95rem' }}>可分配许可证</h4>
                                        {tenantLicenses.filter(lic => !userHasLicense(lic.skuId) && lic.availableUnits > 0).length > 0 ? (
                                            tenantLicenses
                                                .filter(lic => !userHasLicense(lic.skuId) && lic.availableUnits > 0)
                                                .map((lic) => (
                                                    <div key={lic.skuId} style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: 'var(--space-2) var(--space-3)',
                                                        borderRadius: '6px', marginBottom: 'var(--space-2)',
                                                        backgroundColor: 'var(--bg-secondary)',
                                                    }}>
                                                        <span style={{ fontSize: '0.9rem' }}>
                                                            {lic.skuPartNumber}
                                                            <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--space-2)', fontSize: '0.8rem' }}>
                                                                (可用 {lic.availableUnits}/{lic.enabledUnits})
                                                            </span>
                                                        </span>
                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            disabled={licenseOperating === lic.skuId}
                                                            onClick={() => handleAssignLicense(lic.skuId)}
                                                        >
                                                            {licenseOperating === lic.skuId ? '分配中...' : '分配'}
                                                        </button>
                                                    </div>
                                                ))
                                        ) : (
                                            <p style={{ color: 'var(--text-muted)' }}>暂无可分配的许可证</p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 删除确认弹窗 */}
            {showDeleteConfirm && deletingUser && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">确认删除</h3>
                            <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>确定要删除以下用户吗？此操作不可撤销。</p>
                            <div style={{
                                backgroundColor: 'var(--bg-secondary)', padding: 'var(--space-3)',
                                borderRadius: '6px', marginTop: 'var(--space-3)',
                            }}>
                                <strong>{deletingUser.displayName}</strong>
                                <br />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    {deletingUser.userPrincipalName}
                                </span>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>取消</button>
                            <button type="button" className="btn btn-danger" disabled={deleting} onClick={handleConfirmDelete}>
                                {deleting ? '删除中...' : '确认删除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};

export default UsersPage;
