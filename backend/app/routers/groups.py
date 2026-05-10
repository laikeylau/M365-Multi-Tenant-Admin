"""
Groups and roles management router
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Tenant
from app.schemas import GroupCreate
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/groups", tags=["Groups & Roles"])


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
async def list_groups(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List all groups in a tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_groups()
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/{group_id}")
async def get_group(
    tenant_id: int,
    group_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific group"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        return await client.get_group(group_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/{group_id}/members")
async def get_group_members(
    tenant_id: int,
    group_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get members of a group"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_group_members(group_id)
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}")
async def create_group(
    tenant_id: int,
    group_data: GroupCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new group"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        return await client.create_group(group_data.to_graph_format())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tenant_id}/{group_id}")
async def delete_group(
    tenant_id: int,
    group_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a group"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        await client.delete(f"/groups/{group_id}")
        return {"message": "Group deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/{group_id}/members")
async def add_group_member(
    tenant_id: int,
    group_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Add a member to a group"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        data = {
            "@odata.id": f"https://graph.microsoft.com/v1.0/directoryObjects/{user_id}"
        }
        await client.post(f"/groups/{group_id}/members/$ref", data=data)
        return {"message": "Member added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tenant_id}/{group_id}/members/{user_id}")
async def remove_group_member(
    tenant_id: int,
    group_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Remove a member from a group"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        await client.delete(f"/groups/{group_id}/members/{user_id}/$ref")
        return {"message": "Member removed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Directory Roles ====================

@router.get("/{tenant_id}/roles")
async def list_directory_roles(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List all directory roles in a tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_directory_roles()
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/roles/{role_id}/members")
async def get_role_members(
    tenant_id: int,
    role_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get members of a directory role"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_role_members(role_id)
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
