"""
Exchange Online management router — transport rules, mailbox settings, distribution groups.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.deps import get_tenant_client

router = APIRouter(prefix="/exchange", tags=["Exchange Online"])


# ==================== Transport Rules ====================

@router.get("/{tenant_id}/transport-rules")
async def list_transport_rules(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List mail flow (transport) rules."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_transport_rules()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Mailbox Settings ====================

@router.get("/{tenant_id}/mailbox-settings/{user_id}")
async def get_mailbox_settings(tenant_id: int, user_id: str, db: AsyncSession = Depends(get_db)):
    """Get mailbox settings for a user (auto-reply, forwarding, language, timezone)."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_mailbox_settings(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{tenant_id}/mailbox-settings/{user_id}")
async def update_mailbox_settings(
    tenant_id: int,
    user_id: str,
    settings: dict,
    db: AsyncSession = Depends(get_db),
):
    """Update mailbox settings for a user (auto-reply, forwarding, etc.)."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.update_mailbox_settings(user_id, settings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Mail / Folders ====================

@router.get("/{tenant_id}/mail-folders/{user_id}")
async def get_mail_folders(tenant_id: int, user_id: str, db: AsyncSession = Depends(get_db)):
    """Get mail folders for a user."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_mail_folders(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/messages/{user_id}")
async def get_messages(
    tenant_id: int,
    user_id: str,
    top: int = 25,
    db: AsyncSession = Depends(get_db),
):
    """Get recent messages for a user."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_messages(user_id, top=top)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
