"""
User management router
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.database import get_db
from app.models import Tenant
from app.schemas import M365UserCreate, M365UserResponse, UserInvitation
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/users", tags=["Users"])


async def get_tenant_client(tenant_id: int, db: AsyncSession):
    """Helper to get Graph client for a tenant"""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not tenant.is_active:
        raise HTTPException(status_code=400, detail="Tenant is not active")
    
    return graph_manager.get_client(
        tenant.tenant_id,
        tenant.client_id,
        decrypt_tenant_secret(tenant.client_secret)
    )


@router.get("/{tenant_id}")
async def list_users(
    tenant_id: int,
    top: int = Query(100, ge=1, le=999),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List users in a tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        params = {
            "$top": top,
            "$select": "id,displayName,userPrincipalName,mail,accountEnabled,createdDateTime,jobTitle,department"
        }
        if search:
            params["$filter"] = f"startswith(displayName, '{search}') or startswith(userPrincipalName, '{search}')"
        
        result = await client.get("/users", params=params)
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/{user_id}")
async def get_user(
    tenant_id: int,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific user"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        return await client.get_user(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}")
async def create_user(
    tenant_id: int,
    user_data: M365UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new user in a tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        return await client.create_user(user_data.to_graph_format())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{tenant_id}/{user_id}")
async def update_user(
    tenant_id: int,
    user_id: str,
    user_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update a user"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        return await client.update_user(user_id, user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tenant_id}/{user_id}")
async def delete_user(
    tenant_id: int,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a user"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        await client.delete_user(user_id)
        return {"message": "User deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/invite")
async def invite_user(
    tenant_id: int,
    invitation: UserInvitation,
    db: AsyncSession = Depends(get_db)
):
    """Invite an external user to the tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.post("/invitations", data=invitation.to_graph_format())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/bulk-import")
async def bulk_import_users(
    tenant_id: int,
    users: List[M365UserCreate],
    db: AsyncSession = Depends(get_db)
):
    """Bulk import users to a tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    results = {
        "success": [],
        "failed": []
    }
    
    for user in users:
        try:
            created = await client.create_user(user.to_graph_format())
            results["success"].append({
                "userPrincipalName": user.user_principal_name,
                "id": created.get("id")
            })
        except Exception as e:
            results["failed"].append({
                "userPrincipalName": user.user_principal_name,
                "error": str(e)
            })
    
    return results


@router.get("/{tenant_id}/{user_id}/licenses")
async def get_user_licenses(
    tenant_id: int,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get licenses assigned to a user"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_user_licenses(user_id)
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
