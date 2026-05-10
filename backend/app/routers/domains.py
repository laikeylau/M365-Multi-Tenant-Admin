"""
Domain management router
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Tenant
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/domains", tags=["Domains"])


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
async def list_domains(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List all domains in a tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_domains()
        domains = result.get("value", [])
        
        # Enrich domain info
        for domain in domains:
            domain["status"] = "verified" if domain.get("isVerified") else "unverified"
            domain["type"] = "initial" if domain.get("isInitial") else "custom"
        
        return domains
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/{domain_id}")
async def get_domain(
    tenant_id: int,
    domain_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific domain"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        return await client.get_domain(domain_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/{domain_id}/verification-records")
async def get_verification_records(
    tenant_id: int,
    domain_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get DNS verification records for a domain"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get(f"/domains/{domain_id}/verificationDnsRecords")
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/{domain_id}/service-records")
async def get_service_records(
    tenant_id: int,
    domain_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get DNS service configuration records for a domain"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get(f"/domains/{domain_id}/serviceConfigurationRecords")
        return result.get("value", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{tenant_id}/{domain_id}/verify")
async def verify_domain(
    tenant_id: int,
    domain_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Trigger domain verification"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.post(f"/domains/{domain_id}/verify", data={})
        return {"message": "Domain verification initiated", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
