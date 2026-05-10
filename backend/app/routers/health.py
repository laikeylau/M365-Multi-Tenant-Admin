"""
Service health monitoring router
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Tenant
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/health", tags=["Service Health"])


async def get_tenant_client(tenant_id: int, db: AsyncSession):
    """Helper to get Graph client for a tenant"""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return graph_manager.get_client(
        tenant.tenant_id,
        tenant.client_id,
        decrypt_tenant_secret(tenant.client_secret)
    )


@router.get("/{tenant_id}")
async def get_service_health(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Get overall service health status"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_service_health()
        services = result.get("value", [])
        
        # Summarize by status
        summary = {
            "healthy": 0,
            "degraded": 0,
            "unhealthy": 0,
            "investigating": 0
        }
        
        for service in services:
            status = service.get("status", "unknown").lower()
            if status == "servicedegradation":
                summary["degraded"] += 1
            elif status == "serviceinterruption":
                summary["unhealthy"] += 1
            elif status == "investigating":
                summary["investigating"] += 1
            else:
                summary["healthy"] += 1
        
        return {
            "summary": summary,
            "services": services
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/issues")
async def get_service_issues(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Get current service issues and incidents"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_service_issues()
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/messages")
async def get_service_messages(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Get service announcements and messages"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get("/admin/serviceAnnouncement/messages", use_beta=True)
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
