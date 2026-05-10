"""
Security / Defender management router — alerts, incidents, secure scores.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_tenant_client

router = APIRouter(prefix="/security", tags=["Security"])


# ==================== Alerts ====================

@router.get("/{tenant_id}/alerts")
async def list_alerts(tenant_id: int, top: int = 50, db: AsyncSession = Depends(get_db)):
    """List security alerts (v2)."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_security_alerts(top=top)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/alerts/{alert_id}")
async def get_alert(tenant_id: int, alert_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific security alert."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_security_alert(alert_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{tenant_id}/alerts/{alert_id}")
async def update_alert(
    tenant_id: int, alert_id: str, data: dict, db: AsyncSession = Depends(get_db)
):
    """Update security alert status (e.g. resolve, dismiss)."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.update_security_alert(alert_id, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Incidents ====================

@router.get("/{tenant_id}/incidents")
async def list_incidents(tenant_id: int, top: int = 50, db: AsyncSession = Depends(get_db)):
    """List security incidents."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_security_incidents(top=top)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/incidents/{incident_id}")
async def get_incident(
    tenant_id: int, incident_id: str, db: AsyncSession = Depends(get_db)
):
    """Get a specific security incident."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_security_incident(incident_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{tenant_id}/incidents/{incident_id}")
async def update_incident(
    tenant_id: int, incident_id: str, data: dict, db: AsyncSession = Depends(get_db)
):
    """Update security incident (status, classification, assignment)."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.update_security_incident(incident_id, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Secure Score ====================

@router.get("/{tenant_id}/secure-scores")
async def list_secure_scores(tenant_id: int, top: int = 5, db: AsyncSession = Depends(get_db)):
    """List secure scores (latest N)."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_secure_scores(top=top)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
