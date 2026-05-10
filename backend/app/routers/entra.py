"""
Entra ID (Azure AD) management router — conditional access, app registrations,
service principals, named locations, identity protection.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_tenant_client

router = APIRouter(prefix="/entra", tags=["Entra ID"])


# ==================== Conditional Access ====================

@router.get("/{tenant_id}/conditional-access")
async def list_conditional_access_policies(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List all Conditional Access policies."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_conditional_access_policies()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/conditional-access/{policy_id}")
async def get_conditional_access_policy(
    tenant_id: int, policy_id: str, db: AsyncSession = Depends(get_db)
):
    """Get a specific Conditional Access policy."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_conditional_access_policy(policy_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== App Registrations ====================

@router.get("/{tenant_id}/applications")
async def list_applications(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List app registrations."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_applications()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/applications/{app_id}")
async def get_application(tenant_id: int, app_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific app registration."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_application(app_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Service Principals ====================

@router.get("/{tenant_id}/service-principals")
async def list_service_principals(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List service principals (enterprise apps)."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_service_principals()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/service-principals/{sp_id}")
async def get_service_principal(
    tenant_id: int, sp_id: str, db: AsyncSession = Depends(get_db)
):
    """Get a specific service principal."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_service_principal(sp_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Named Locations ====================

@router.get("/{tenant_id}/named-locations")
async def list_named_locations(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Get named locations for Conditional Access."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_named_locations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Identity Protection ====================

@router.get("/{tenant_id}/risky-users")
async def list_risky_users(tenant_id: int, top: int = 50, db: AsyncSession = Depends(get_db)):
    """Get risky users from Identity Protection."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_risky_users(top=top)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/risk-detections")
async def list_risk_detections(tenant_id: int, top: int = 50, db: AsyncSession = Depends(get_db)):
    """Get risk detections from Identity Protection."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_risk_detections(top=top)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MFA Registration ====================

@router.get("/{tenant_id}/mfa-registration")
async def get_mfa_registration(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Get MFA / authentication methods user registration details."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_credential_user_registration()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
