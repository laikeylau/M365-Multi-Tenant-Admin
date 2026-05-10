"""
Teams management router — teams, channels, members, tags.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_tenant_client

router = APIRouter(prefix="/teams", tags=["Teams"])


# ==================== Teams ====================

@router.get("/{tenant_id}")
async def list_teams(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List all teams."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_teams()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/{team_id}")
async def get_team(tenant_id: int, team_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific team."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_team(team_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}")
async def create_team(tenant_id: int, data: dict, db: AsyncSession = Depends(get_db)):
    """Create a new team (async operation)."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.create_team(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{tenant_id}/{team_id}")
async def update_team(
    tenant_id: int, team_id: str, data: dict, db: AsyncSession = Depends(get_db)
):
    """Update team settings."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.update_team(team_id, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tenant_id}/{team_id}")
async def delete_team(tenant_id: int, team_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a team."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.delete_team(team_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Channels ====================

@router.get("/{tenant_id}/{team_id}/channels")
async def list_channels(tenant_id: int, team_id: str, db: AsyncSession = Depends(get_db)):
    """List channels in a team."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_channels(team_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/{team_id}/channels")
async def create_channel(
    tenant_id: int, team_id: str, data: dict, db: AsyncSession = Depends(get_db)
):
    """Create a channel in a team."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.create_channel(team_id, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tenant_id}/{team_id}/channels/{channel_id}")
async def delete_channel(
    tenant_id: int, team_id: str, channel_id: str, db: AsyncSession = Depends(get_db)
):
    """Delete a channel from a team."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.delete_channel(team_id, channel_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Members ====================

@router.get("/{tenant_id}/{team_id}/members")
async def list_team_members(tenant_id: int, team_id: str, db: AsyncSession = Depends(get_db)):
    """Get members of a team."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_team_members(team_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Tags ====================

@router.get("/{tenant_id}/{team_id}/tags")
async def list_team_tags(tenant_id: int, team_id: str, db: AsyncSession = Depends(get_db)):
    """Get tags for a team."""
    client = await get_tenant_client(tenant_id, db)
    try:
        return await client.get_team_tags(team_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
