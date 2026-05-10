"""
Dashboard and statistics router
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from typing import List
import asyncio
from app.database import get_db
from app.models import Tenant
from app.schemas import DashboardStats, TenantSummary
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)) -> DashboardStats:
    """Get aggregated dashboard statistics across all tenants"""
    # Get all active tenants
    result = await db.execute(select(Tenant).where(Tenant.is_active == True))
    tenants = result.scalars().all()
    
    stats = DashboardStats(
        total_tenants=len(tenants),
        connected_tenants=0,
        error_tenants=0,
        total_users=0,
        active_users=0,
        total_licenses=0,
        consumed_licenses=0,
        license_usage_percent=0,
        last_updated=datetime.utcnow()
    )
    
    # Fetch stats from each tenant concurrently
    async def fetch_tenant_stats(tenant: Tenant):
        try:
            client = graph_manager.get_client(
                tenant.tenant_id,
                tenant.client_id,
                decrypt_tenant_secret(tenant.client_secret)
            )
            summary = await client.get_tenant_summary()
            return {
                "success": True,
                "user_count": summary.get("userCount", 0),
                "active_users": summary.get("activeUsers", 0),
                "total_licenses": summary.get("totalLicenses", 0),
                "consumed_licenses": summary.get("consumedLicenses", 0)
            }
        except Exception:
            return {"success": False}
    
    # Run all tenant fetches concurrently
    results = await asyncio.gather(*[fetch_tenant_stats(t) for t in tenants])
    
    for result in results:
        if result["success"]:
            stats.connected_tenants += 1
            stats.total_users += result["user_count"]
            stats.active_users += result["active_users"]
            stats.total_licenses += result["total_licenses"]
            stats.consumed_licenses += result["consumed_licenses"]
        else:
            stats.error_tenants += 1
    
    # Calculate usage percentage
    if stats.total_licenses > 0:
        stats.license_usage_percent = round(
            stats.consumed_licenses / stats.total_licenses * 100, 1
        )
    
    return stats


@router.get("/tenants")
async def get_all_tenant_summaries(db: AsyncSession = Depends(get_db)) -> List[TenantSummary]:
    """Get summary for all tenants"""
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = result.scalars().all()
    
    summaries = []
    
    async def fetch_summary(tenant: Tenant) -> TenantSummary:
        summary = TenantSummary(
            id=tenant.id,
            name=tenant.name,
            tenant_id=tenant.tenant_id,
            is_connected=False
        )
        
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
        except Exception as e:
            summary.error = str(e)
        
        return summary
    
    summaries = await asyncio.gather(*[fetch_summary(t) for t in tenants])
    return list(summaries)


@router.get("/refresh")
async def refresh_dashboard(db: AsyncSession = Depends(get_db)):
    """Force refresh dashboard data"""
    # Clear cached tokens to force re-authentication
    graph_manager.clear_all()
    
    return await get_dashboard_stats(db)
