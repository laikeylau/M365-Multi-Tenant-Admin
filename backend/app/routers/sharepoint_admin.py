"""
SharePoint management router — sites, drives, lists.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_tenant_client

router = APIRouter(prefix="/sharepoint", tags=["SharePoint"])


@router.get("/{tenant_id}/sites")
async def list_sites(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List SharePoint sites."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_sharepoint_sites()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/sites/{site_id:path}")
async def get_site(tenant_id: int, site_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific SharePoint site."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_sharepoint_site(site_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/sites/{site_id:path}/drives")
async def list_site_drives(tenant_id: int, site_id: str, db: AsyncSession = Depends(get_db)):
    """Get drives (document libraries) for a SharePoint site."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_site_drives(site_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/sites/{site_id:path}/lists")
async def list_site_lists(tenant_id: int, site_id: str, db: AsyncSession = Depends(get_db)):
    """Get lists for a SharePoint site."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_site_lists(site_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
