import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { reportsApi, tenantApi, Tenant } from '../services/api';

const ReportsPage: React.FC = () => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState<number | null>(null);
    const [exporting, setExporting] = useState<string | null>(null);

    useEffect(() => {
        fetchTenants();
    }, []);

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

    const downloadFile = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleExport = async (type: 'users' | 'licenses' | 'userLicenses' | 'groups') => {
        if (!selectedTenant) {
            alert('请先选择租户');
            return;
        }
        setExporting(type);
        try {
            let res;
            let filename = '';
            const tenant = tenants.find(t => t.id === selectedTenant);
            const date = new Date().toISOString().slice(0, 10);

            switch (type) {
                case 'users':
                    res = await reportsApi.exportUsersCSV(selectedTenant);
                    filename = `${tenant?.name || 'tenant'}_users_${date}.csv`;
                    break;
                case 'licenses':
                    res = await reportsApi.exportLicensesCSV(selectedTenant);
                    filename = `${tenant?.name || 'tenant'}_licenses_${date}.csv`;
                    break;
                case 'userLicenses':
                    res = await reportsApi.exportUserLicensesCSV(selectedTenant);
                    filename = `${tenant?.name || 'tenant'}_user_licenses_${date}.csv`;
                    break;
                case 'groups':
                    res = await reportsApi.exportGroupsCSV(selectedTenant);
                    filename = `${tenant?.name || 'tenant'}_groups_${date}.csv`;
                    break;
            }
            downloadFile(res.data, filename);
        } catch (error) {
            alert('导出失败');
        } finally {
            setExporting(null);
        }
    };

    const reports = [
        { id: 'users', name: '用户列表', desc: '导出所有用户信息（显示名称、邮箱、状态、部门等）', icon: '👥' },
        { id: 'licenses', name: '许可证报告', desc: '导出许可证使用情况（SKU、已用、可用、使用率）', icon: '📜' },
        { id: 'userLicenses', name: '用户许可证分配报告', desc: '导出每个用户分配的许可证详情', icon: '🎫' },
        { id: 'groups', name: '组列表', desc: '导出所有组信息（名称、描述、类型）', icon: '👔' },
    ];

    return (
        
            <div className="page-container">
                <div className="page-header">
                    <h2 className="page-title">报告导出</h2>
                </div>

                <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
                    <div className="card-body">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">选择租户</label>
                            <select className="form-select" value={selectedTenant || ''} onChange={(e) => setSelectedTenant(Number(e.target.value))}>
                                <option value="">选择租户</option>
                                {tenants.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <span className="card-title">可用报告</span>
                    </div>
                    <div className="card-body">
                        {reports.map((report) => (
                            <div key={report.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: 'var(--space-4)',
                                background: 'var(--gray-50)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--space-3)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                    <span style={{ fontSize: '24px' }}>{report.icon}</span>
                                    <div>
                                        <strong>{report.name}</strong>
                                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{report.desc}</p>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleExport(report.id as 'users' | 'licenses' | 'userLicenses' | 'groups')}
                                    disabled={exporting === report.id || !selectedTenant}
                                >
                                    {exporting === report.id ? '导出中...' : '📥 导出 CSV'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        
    );
};

export default ReportsPage;
