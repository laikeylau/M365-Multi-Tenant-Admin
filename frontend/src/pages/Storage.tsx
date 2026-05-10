import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { tenantApi, Tenant } from '../services/api';
import api from '../services/api';

interface StorageItem {
    displayName?: string;
    userPrincipalName?: string;
    ownerDisplayName?: string;
    ownerPrincipalName?: string;
    siteName?: string;
    siteUrl?: string;
    storageUsed: number;
    storageUsedFormatted: string;
    storageAllocated?: number;
    storageAllocatedFormatted?: string;
    quotaFormatted?: string;
    usagePercent: number;
    itemCount?: number;
    fileCount?: number;
    lastActivityDate?: string;
}

interface StorageResponse {
    items: StorageItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

type StorageType = 'mailbox' | 'onedrive' | 'sharepoint';

const StoragePage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [storageType, setStorageType] = useState<StorageType>('mailbox');
    const [data, setData] = useState<StorageResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 50;

    useEffect(() => {
        fetchTenants();
    }, []);

    useEffect(() => {
        if (selectedTenant) {
            setPage(1);
            fetchData();
        }
    }, [selectedTenant, storageType]);

    useEffect(() => {
        if (selectedTenant) {
            fetchData();
        }
    }, [page, search]);

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

    const fetchData = async () => {
        if (!selectedTenant) return;
        setLoading(true);
        try {
            const res = await api.get(`/storage/${selectedTenant}/${storageType}`, {
                params: { page, page_size: pageSize, search: search || undefined }
            });
            setData(res.data);
        } catch (error) {
            console.error('Failed to fetch storage data:', error);
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchData();
    };

    const getProgressBarClass = (percent: number) => {
        if (percent >= 90) return 'danger';
        if (percent >= 70) return 'warning';
        return 'success';
    };

    const renderTable = () => {
        if (!data || data.items.length === 0) {
            return (
                <div className="empty-state">
                    <div className="empty-state-icon">💾</div>
                    <div className="empty-state-title">暂无数据</div>
                    <div className="empty-state-desc">
                        请确保已添加 Reports.Read.All 权限并授权
                    </div>
                </div>
            );
        }

        if (storageType === 'mailbox') {
            return (
                <table className="table">
                    <thead>
                        <tr>
                            <th>用户</th>
                            <th>邮箱地址</th>
                            <th style={{ textAlign: 'right' }}>已使用</th>
                            <th style={{ textAlign: 'right' }}>配额</th>
                            <th style={{ width: '200px' }}>使用率</th>
                            <th style={{ textAlign: 'right' }}>邮件数</th>
                            <th>最后活动</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item, idx) => (
                            <tr key={idx}>
                                <td>{item.displayName || '-'}</td>
                                <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {item.userPrincipalName || '-'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                    {item.storageUsedFormatted}
                                </td>
                                <td style={{ textAlign: 'right' }}>{item.quotaFormatted || '-'}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="progress" style={{ flex: 1 }}>
                                            <div
                                                className={`progress-bar ${getProgressBarClass(item.usagePercent)}`}
                                                style={{ width: `${Math.min(item.usagePercent, 100)}%` }}
                                            />
                                        </div>
                                        <span style={{ minWidth: '50px', textAlign: 'right', fontSize: '13px' }}>
                                            {item.usagePercent}%
                                        </span>
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>{item.itemCount?.toLocaleString() || '-'}</td>
                                <td style={{ fontSize: '13px' }}>{item.lastActivityDate || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        if (storageType === 'onedrive') {
            return (
                <table className="table">
                    <thead>
                        <tr>
                            <th>用户</th>
                            <th style={{ textAlign: 'right' }}>已使用</th>
                            <th style={{ textAlign: 'right' }}>配额</th>
                            <th style={{ width: '200px' }}>使用率</th>
                            <th style={{ textAlign: 'right' }}>文件数</th>
                            <th>最后活动</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item, idx) => (
                            <tr key={idx}>
                                <td>
                                    <div>{item.ownerDisplayName || '-'}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {item.ownerPrincipalName}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                    {item.storageUsedFormatted}
                                </td>
                                <td style={{ textAlign: 'right' }}>{item.storageAllocatedFormatted || '-'}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="progress" style={{ flex: 1 }}>
                                            <div
                                                className={`progress-bar ${getProgressBarClass(item.usagePercent)}`}
                                                style={{ width: `${Math.min(item.usagePercent, 100)}%` }}
                                            />
                                        </div>
                                        <span style={{ minWidth: '50px', textAlign: 'right', fontSize: '13px' }}>
                                            {item.usagePercent}%
                                        </span>
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>{item.fileCount?.toLocaleString() || '-'}</td>
                                <td style={{ fontSize: '13px' }}>{item.lastActivityDate || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        // SharePoint
        return (
            <table className="table">
                <thead>
                    <tr>
                        <th>站点名称</th>
                        <th>所有者</th>
                        <th style={{ textAlign: 'right' }}>已使用</th>
                        <th style={{ textAlign: 'right' }}>配额</th>
                        <th style={{ width: '200px' }}>使用率</th>
                        <th style={{ textAlign: 'right' }}>文件数</th>
                        <th>最后活动</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map((item, idx) => (
                        <tr key={idx}>
                            <td>
                                <div>{item.siteName || '-'}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    <a href={item.siteUrl} target="_blank" rel="noopener noreferrer">
                                        {item.siteUrl ? '查看站点 →' : ''}
                                    </a>
                                </div>
                            </td>
                            <td>{item.ownerDisplayName || '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                {item.storageUsedFormatted}
                            </td>
                            <td style={{ textAlign: 'right' }}>{item.storageAllocatedFormatted || '-'}</td>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="progress" style={{ flex: 1 }}>
                                        <div
                                            className={`progress-bar ${getProgressBarClass(item.usagePercent)}`}
                                            style={{ width: `${Math.min(item.usagePercent, 100)}%` }}
                                        />
                                    </div>
                                    <span style={{ minWidth: '50px', textAlign: 'right', fontSize: '13px' }}>
                                        {item.usagePercent}%
                                    </span>
                                </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>{item.fileCount?.toLocaleString() || '-'}</td>
                            <td style={{ fontSize: '13px' }}>{item.lastActivityDate || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        
            <div className="page-container">
                <div className="page-header">
                    <h2 className="page-title">存储容量管理</h2>
                </div>

                {/* Filters */}
                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <div className="card-body" style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
                            <label className="form-label">选择租户</label>
                            <select
                                className="form-select"
                                value={selectedTenant || ''}
                                onChange={(e) => setSelectedTenant(Number(e.target.value))}
                            >
                                <option value="">选择租户</option>
                                {tenants.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">存储类型</label>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[
                                    { value: 'mailbox', label: '📧 邮箱' },
                                    { value: 'onedrive', label: '☁️ OneDrive' },
                                    { value: 'sharepoint', label: '🌐 SharePoint' }
                                ].map((type) => (
                                    <button
                                        key={type.value}
                                        className={`btn ${storageType === type.value ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setStorageType(type.value as StorageType)}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleSearch} className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
                            <label className="form-label">搜索</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="搜索用户或站点..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <button type="submit" className="btn btn-primary">搜索</button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Data Table */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="card-title">
                            {storageType === 'mailbox' && '📧 邮箱使用情况'}
                            {storageType === 'onedrive' && '☁️ OneDrive 使用情况'}
                            {storageType === 'sharepoint' && '🌐 SharePoint 站点使用情况'}
                        </span>
                        {data && (
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                                共 {data.total} 条记录
                            </span>
                        )}
                    </div>
                    <div className="table-container">
                        {loading ? (
                            <div className="loading"><div className="spinner"></div></div>
                        ) : (
                            renderTable()
                        )}
                    </div>

                    {/* Pagination */}
                    {data && data.totalPages > 1 && (
                        <div style={{
                            padding: 'var(--space-4)',
                            borderTop: '1px solid var(--gray-200)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                                第 {page} / {data.totalPages} 页
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className="btn btn-secondary"
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    上一页
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    disabled={page >= data.totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        
    );
};

export default StoragePage;
