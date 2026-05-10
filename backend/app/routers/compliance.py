"""
Purview / Compliance management router — retention labels, sensitivity labels, DLP policies.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_tenant_client

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.get("/{tenant_id}/retention-labels")
async def list_retention_labels(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List retention labels."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_retention_labels()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/sensitivity-labels")
async def list_sensitivity_labels(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List sensitivity labels."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_sensitivity_labels()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/dlp-policies")
async def list_dlp_policies(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List data loss prevention policies."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_dlp_policies()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
