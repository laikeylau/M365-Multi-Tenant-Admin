"""
Shared dependency for getting a GraphClient for a given tenant DB id.
"""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Tenant
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret


async def get_tenant_client(tenant_id: int, db: AsyncSession):
    """Helper: resolve a tenant DB id to a GraphClient instance."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return graph_manager.get_client(
        tenant.tenant_id,
        tenant.client_id,
        decrypt_tenant_secret(tenant.client_secret),
    )
