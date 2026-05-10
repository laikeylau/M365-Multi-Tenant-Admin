"""
Intune / Device Management router — managed devices, compliance policies,
configuration profiles, device actions.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_tenant_client

router = APIRouter(prefix="/intune", tags=["Intune"])


# ==================== Managed Devices ====================

@router.get("/{tenant_id}/devices")
async def list_devices(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List managed devices."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_managed_devices()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/devices/{device_id}")
async def get_device(tenant_id: int, device_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific managed device."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_managed_device(device_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Device Actions ====================

@router.post("/{tenant_id}/devices/{device_id}/wipe")
async def wipe_device(
    tenant_id: int, device_id: str, body: dict = None, db: AsyncSession = Depends(get_db)
):
    """Wipe a managed device."""
    client = await get_tenant_client(tenant_id, db)
    try:
        keep = (body or {}).get("keepEnrollmentData", False)
        return await client.wipe_device(device_id, keep_enrollment_data=keep)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/devices/{device_id}/retire")
async def retire_device(tenant_id: int, device_id: str, db: AsyncSession = Depends(get_db)):
    """Retire a managed device (remove corporate data)."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.retire_device(device_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/devices/{device_id}/lock")
async def lock_device(tenant_id: int, device_id: str, db: AsyncSession = Depends(get_db)):
    """Lock a managed device remotely."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.lock_device(device_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/devices/{device_id}/reset-passcode")
async def reset_passcode(tenant_id: int, device_id: str, db: AsyncSession = Depends(get_db)):
    """Reset passcode on a managed device."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.reset_device_passcode(device_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/devices/{device_id}/sync")
async def sync_device(tenant_id: int, device_id: str, db: AsyncSession = Depends(get_db)):
    """Trigger a sync on a managed device."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.sync_device(device_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Compliance Policies ====================

@router.get("/{tenant_id}/compliance-policies")
async def list_compliance_policies(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List device compliance policies."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_compliance_policies()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Configuration Profiles ====================

@router.get("/{tenant_id}/config-profiles")
async def list_config_profiles(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List device configuration profiles."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_device_configurations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
