import React, { useEffect, useState } from 'react';
import { tenantApi, Tenant } from '../services/api';

interface Props {
    selectedTenant: number | null;
    onSelect: (tenantId: number) => void;
}

const TenantSelector: React.FC<Props> = ({ selectedTenant, onSelect }) => {
    const [tenants, setTenants] = useState<Tenant[]>([]);

    useEffect(() => {
        tenantApi.list().then((res) => {
            setTenants(res.data);
            if (!selectedTenant && res.data.length > 0) {
                onSelect(res.data[0].id);
            }
        });
    }, []);

    return (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <label style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>🏢 选择租户:</label>
                <select
                    className="form-select"
                    value={selectedTenant || ''}
                    onChange={(e) => onSelect(Number(e.target.value))}
                    style={{ maxWidth: 400 }}
                >
                    <option value="">-- 请选择租户 --</option>
                    {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name} ({t.tenant_id.slice(0, 8)}...)
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default TenantSelector;
