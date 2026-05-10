"""
Cache service for Graph API responses.

Uses the CachedData model in SQLite as the backing store.
Provides a simple async get/set/invalidate interface.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import CachedData

logger = logging.getLogger(__name__)

DEFAULT_TTL_MINUTES = 10


async def get_cached(tenant_id: int, key: str) -> Optional[Any]:
    """
    Return cached value for (tenant_id, key) if it exists and hasn't expired.
    Returns None on miss or deserialization failure.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(CachedData).where(
                CachedData.tenant_id == tenant_id,
                CachedData.cache_key == key,
                CachedData.expires_at > datetime.utcnow(),
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        try:
            return json.loads(row.data)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Cache deserialization failed for tenant=%s key=%s", tenant_id, key)
            return None


async def set_cached(
    tenant_id: int,
    key: str,
    value: Any,
    ttl_minutes: int = DEFAULT_TTL_MINUTES,
) -> None:
    """
    Store value in cache. Overwrites any existing entry for the same key.
    """
    async with AsyncSessionLocal() as session:
        # Upsert: delete existing then insert
        await session.execute(
            delete(CachedData).where(
                CachedData.tenant_id == tenant_id,
                CachedData.cache_key == key,
            )
        )
        entry = CachedData(
            tenant_id=tenant_id,
            cache_key=key,
            data=json.dumps(value, default=str),
            expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes),
        )
        session.add(entry)
        await session.commit()
        logger.debug("Cached tenant=%s key=%s ttl=%dm", tenant_id, key, ttl_minutes)


async def invalidate(tenant_id: int, key: Optional[str] = None) -> None:
    """
    Remove cache entries. If key is None, clears all entries for the tenant.
    """
    async with AsyncSessionLocal() as session:
        stmt = delete(CachedData).where(CachedData.tenant_id == tenant_id)
        if key is not None:
            stmt = stmt.where(CachedData.cache_key == key)
        await session.execute(stmt)
        await session.commit()
        logger.debug("Invalidated cache tenant=%s key=%s", tenant_id, key or "*")


async def invalidate_all() -> None:
    """Clear the entire cache."""
    async with AsyncSessionLocal() as session:
        await session.execute(delete(CachedData))
        await session.commit()
        logger.debug("Invalidated entire cache")
