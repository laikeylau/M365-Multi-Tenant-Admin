"""
Tenant management router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database import get_db
from app.models import Tenant
from app.schemas import TenantCreate, TenantUpdate, TenantResponse, TenantSummary
from app.services.graph_client import graph_manager, GraphClient
from app.services.cache import get_cached, set_cached, invalidate as invalidate_cache
from app.security.tenant_secrets import encrypt_tenant_secret, decrypt_tenant_secret

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.get("", response_model=List[TenantResponse])
async def list_tenants(db: AsyncSession = Depends(get_db)):
    """List all registered tenants"""
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = result.scalars().all()
    return tenants


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(tenant_data: TenantCreate, db: AsyncSession = Depends(get_db)):
    """Register a new M365 tenant"""
    # Check if tenant already exists
    existing = await db.execute(
        select(Tenant).where(Tenant.tenant_id == tenant_data.tenant_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant with this ID already exists"
        )
    
    # Test connection before saving
    try:
        client = GraphClient(
            tenant_id=tenant_data.tenant_id,
            client_id=tenant_data.client_id,
            client_secret=tenant_data.client_secret
        )
        await client.get_organization()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to tenant: {str(e)}"
        )
    
    # Create tenant record
    tenant = Tenant(
        name=tenant_data.name,
        tenant_id=tenant_data.tenant_id,
        client_id=tenant_data.client_id,
        client_secret=encrypt_tenant_secret(tenant_data.client_secret),
        domain=tenant_data.domain
    )
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific tenant by ID"""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: int, 
    tenant_data: TenantUpdate, 
    db: AsyncSession = Depends(get_db)
):
    """Update a tenant"""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_data = tenant_data.model_dump(exclude_unset=True)
    if "client_secret" in update_data and update_data["client_secret"] is not None:
        update_data["client_secret"] = encrypt_tenant_secret(update_data["client_secret"])
    for field, value in update_data.items():
        setattr(tenant, field, value)
    
    # Clear cached client if credentials changed
    if "client_secret" in update_data:
        graph_manager.remove_client(tenant.tenant_id)
        await invalidate_cache(tenant.id)
    
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a tenant"""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    graph_manager.remove_client(tenant.tenant_id)
    await invalidate_cache(tenant.id)
    await db.delete(tenant)
    await db.commit()


@router.get("/{tenant_id}/summary", response_model=TenantSummary)
async def get_tenant_summary(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Get summary information for a tenant (cached for 10 minutes)"""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    summary = TenantSummary(
        id=tenant.id,
        name=tenant.name,
        tenant_id=tenant.tenant_id,
        is_connected=False
    )
    
    # Try cache first
    CACHE_KEY = "tenant_summary"
    cached = await get_cached(tenant.id, CACHE_KEY)
    if cached is not None:
        summary.display_name = cached.get("displayName")
        summary.user_count = cached.get("userCount", 0)
        summary.active_users = cached.get("activeUsers", 0)
        summary.total_licenses = cached.get("totalLicenses", 0)
        summary.consumed_licenses = cached.get("consumedLicenses", 0)
        summary.license_usage_percent = cached.get("licenseUsagePercent", 0)
        summary.is_connected = True
        return summary
    
    try:
        client = graph_manager.get_client(
            tenant.tenant_id,
            tenant.client_id,
            decrypt_tenant_secret(tenant.client_secret)
        )
        data = await client.get_tenant_summary()
        summary.display_name = data.get("displayName")
        summary.user_count = data.get("userCount", 0)
        summary.active_users = data.get("activeUsers", 0)
        summary.total_licenses = data.get("totalLicenses", 0)
        summary.consumed_licenses = data.get("consumedLicenses", 0)
        summary.license_usage_percent = data.get("licenseUsagePercent", 0)
        summary.is_connected = True
        await set_cached(tenant.id, CACHE_KEY, data, ttl_minutes=10)
    except Exception as e:
        summary.error = str(e)
    
    return summary


@router.post("/{tenant_id}/test-connection")
async def test_connection(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Test connection to a tenant"""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    try:
        client = graph_manager.get_client(
            tenant.tenant_id,
            tenant.client_id,
            decrypt_tenant_secret(tenant.client_secret)
        )
        org = await client.get_organization()
        return {
            "success": True,
            "message": "Connection successful",
            "organization": org.get("value", [{}])[0].get("displayName", "Unknown")
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }
