"""
License management router
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Tenant
from app.schemas import LicenseAssignment
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/licenses", tags=["Licenses"])


async def get_tenant_client(tenant_id: int, db: AsyncSession):
    """Helper to get Graph client for a tenant"""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not tenant.is_active:
        raise HTTPException(status_code=400, detail="Tenant is not active")
    
    return graph_manager.get_client(
        tenant.tenant_id,
        tenant.client_id,
        decrypt_tenant_secret(tenant.client_secret)
    )


@router.get("/{tenant_id}")
async def list_licenses(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List all available licenses (SKUs) in a tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_subscribed_skus()
        skus = result.get("value", [])
        
        # Format response with usage info
        licenses = []
        for sku in skus:
            prepaid = sku.get("prepaidUnits", {})
            licenses.append({
                "skuId": sku.get("skuId"),
                "skuPartNumber": sku.get("skuPartNumber"),
                "servicePlans": sku.get("servicePlans", []),
                "consumedUnits": sku.get("consumedUnits", 0),
                "enabledUnits": prepaid.get("enabled", 0),
                "suspendedUnits": prepaid.get("suspended", 0),
                "warningUnits": prepaid.get("warning", 0),
                "availableUnits": prepaid.get("enabled", 0) - sku.get("consumedUnits", 0)
            })
        
        return licenses
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/summary")
async def get_license_summary(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Get license usage summary for a tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_subscribed_skus()
        skus = result.get("value", [])
        
        total_enabled = 0
        total_consumed = 0
        
        for sku in skus:
            prepaid = sku.get("prepaidUnits", {})
            total_enabled += prepaid.get("enabled", 0)
            total_consumed += sku.get("consumedUnits", 0)
        
        return {
            "totalLicenses": total_enabled,
            "consumedLicenses": total_consumed,
            "availableLicenses": total_enabled - total_consumed,
            "usagePercent": round(total_consumed / total_enabled * 100, 1) if total_enabled > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/assign")
async def assign_license(
    tenant_id: int,
    assignment: LicenseAssignment,
    db: AsyncSession = Depends(get_db)
):
    """Assign a license to a user"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.assign_license(assignment.user_id, assignment.sku_id)
        return {"message": "License assigned successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/remove")
async def remove_license(
    tenant_id: int,
    assignment: LicenseAssignment,
    db: AsyncSession = Depends(get_db)
):
    """Remove a license from a user"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.remove_license(assignment.user_id, assignment.sku_id)
        return {"message": "License removed successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/users-without-license")
async def get_users_without_license(
    tenant_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get users who don't have any license assigned"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        # Get all users
        users_result = await client.get_users(top=999, select=["id", "displayName", "userPrincipalName"])
        users = users_result.get("value", [])
        
        unlicensed = []
        for user in users:
            licenses = await client.get_user_licenses(user["id"])
            if not licenses.get("value"):
                unlicensed.append(user)
        
        return unlicensed
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
