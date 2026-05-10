"""
Dashboard and statistics router
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List
import asyncio
import logging

from app.database import get_db
from app.models import Tenant
from app.schemas import DashboardStats, TenantSummary
from app.services.graph_client import graph_manager
from app.services.cache import get_cached, set_cached, invalidate_all
from app.security.tenant_secrets import decrypt_tenant_secret

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

CACHE_KEY_SUMMARY = "tenant_summary"
CACHE_TTL_MINUTES = 10


async def _fetch_tenant_summary(tenant: Tenant, use_cache: bool = True) -> TenantSummary:
    """Fetch summary for a single tenant, with optional caching."""
    summary = TenantSummary(
        id=tenant.id,
        name=tenant.name,
        tenant_id=tenant.tenant_id,
        is_connected=False,
    )

    # Try cache first
    if use_cache:
        cached = await get_cached(tenant.id, CACHE_KEY_SUMMARY)
        if cached is not None:
            summary.display_name = cached.get("displayName")
            summary.user_count = cached.get("userCount", 0)
            summary.active_users = cached.get("activeUsers", 0)
            summary.total_licenses = cached.get("totalLicenses", 0)
            summary.consumed_licenses = cached.get("consumedLicenses", 0)
            summary.license_usage_percent = cached.get("licenseUsagePercent", 0)
            summary.is_connected = True
            logger.debug("Cache hit for tenant %s (%s)", tenant.name, tenant.tenant_id)
            return summary

    try:
        client = graph_manager.get_client(
            tenant.tenant_id,
            tenant.client_id,
            decrypt_tenant_secret(tenant.client_secret),
        )
        data = await client.get_tenant_summary()

        summary.display_name = data.get("displayName")
        summary.user_count = data.get("userCount", 0)
        summary.active_users = data.get("activeUsers", 0)
        summary.total_licenses = data.get("totalLicenses", 0)
        summary.consumed_licenses = data.get("consumedLicenses", 0)
        summary.license_usage_percent = data.get("licenseUsagePercent", 0)
        summary.is_connected = True

        # Store in cache
        await set_cached(tenant.id, CACHE_KEY_SUMMARY, data, ttl_minutes=CACHE_TTL_MINUTES)
        logger.debug("Cached summary for tenant %s", tenant.name)

    except Exception as e:
        summary.error = str(e)
        logger.warning("Failed to fetch summary for tenant %s: %s", tenant.name, e)

    return summary


@router.get("")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)) -> DashboardStats:
    """Get aggregated dashboard statistics across all tenants."""
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
        last_updated=datetime.utcnow(),
    )

    summaries = await asyncio.gather(
        *[_fetch_tenant_summary(t) for t in tenants],
        return_exceptions=True,
    )

    for s in summaries:
        if isinstance(s, Exception):
            stats.error_tenants += 1
            continue
        if s.is_connected:
            stats.connected_tenants += 1
            stats.total_users += s.user_count
            stats.active_users += s.active_users
            stats.total_licenses += s.total_licenses
            stats.consumed_licenses += s.consumed_licenses
        else:
            stats.error_tenants += 1

    if stats.total_licenses > 0:
        stats.license_usage_percent = round(
            stats.consumed_licenses / stats.total_licenses * 100, 1
        )

    return stats


@router.get("/tenants")
async def get_all_tenant_summaries(db: AsyncSession = Depends(get_db)) -> List[TenantSummary]:
    """Get summary for all tenants."""
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = result.scalars().all()

    summaries = await asyncio.gather(
        *[_fetch_tenant_summary(t) for t in tenants],
        return_exceptions=True,
    )

    # Convert any exceptions to error summaries
    output: List[TenantSummary] = []
    for i, s in enumerate(summaries):
        if isinstance(s, Exception):
            output.append(TenantSummary(
                id=tenants[i].id,
                name=tenants[i].name,
                tenant_id=tenants[i].tenant_id,
                is_connected=False,
                error=str(s),
            ))
        else:
            output.append(s)

    return output


@router.get("/refresh")
async def refresh_dashboard(db: AsyncSession = Depends(get_db)):
    """Force refresh dashboard data — clears cache and re-fetches."""
    graph_manager.clear_all()
    await invalidate_all()
    return await get_dashboard_stats(db)
