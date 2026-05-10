"""
Audit logs router
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import Tenant, AuditLog
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


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


@router.get("/{tenant_id}/sign-ins")
async def get_sign_in_logs(
    tenant_id: int,
    top: int = Query(50, ge=1, le=500),
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db)
):
    """Get sign-in audit logs from M365 tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        # Filter for last N days
        filter_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        params = {
            "$top": top,
            "$filter": f"createdDateTime ge {filter_date}",
            "$orderby": "createdDateTime desc"
        }
        
        result = await client.get("/auditLogs/signIns", params=params, use_beta=True)
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/directory")
async def get_directory_audit_logs(
    tenant_id: int,
    top: int = Query(50, ge=1, le=500),
    days: int = Query(7, ge=1, le=30),
    activity_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get directory audit logs from M365 tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        filter_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        filter_str = f"activityDateTime ge {filter_date}"
        
        if activity_filter:
            filter_str += f" and activityDisplayName eq '{activity_filter}'"
        
        params = {
            "$top": top,
            "$filter": filter_str,
            "$orderby": "activityDateTime desc"
        }
        
        result = await client.get("/auditLogs/directoryAudits", params=params, use_beta=True)
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Local Audit Logs ====================

@router.get("/local")
async def get_local_audit_logs(
    tenant_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """Get local platform audit logs"""
    query = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    
    if tenant_id:
        query = query.where(AuditLog.tenant_id == tenant_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [
        {
            "id": log.id,
            "tenant_id": log.tenant_id,
            "user_id": log.user_id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat()
        }
        for log in logs
    ]


async def log_action(
    db: AsyncSession,
    action: str,
    resource_type: str,
    tenant_id: Optional[int] = None,
    user_id: Optional[int] = None,
    resource_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None
):
    """Helper function to create audit log entries"""
    log = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address
    )
    db.add(log)
    await db.commit()
