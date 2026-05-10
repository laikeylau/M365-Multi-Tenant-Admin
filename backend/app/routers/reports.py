"""
Report export router
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import csv
import io
from datetime import datetime
from app.database import get_db
from app.models import Tenant
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/reports", tags=["Reports"])


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
    ), tenant


@router.get("/{tenant_id}/users/csv")
async def export_users_csv(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Export all users to CSV"""
    client, tenant = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_users(
            top=999,
            select=["displayName", "userPrincipalName", "mail", "accountEnabled", "jobTitle", "department", "createdDateTime"]
        )
        users = result.get("value", [])
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Display Name", "User Principal Name", "Email", 
            "Enabled", "Job Title", "Department", "Created Date"
        ])
        
        # Data rows
        for user in users:
            writer.writerow([
                user.get("displayName", ""),
                user.get("userPrincipalName", ""),
                user.get("mail", ""),
                "Yes" if user.get("accountEnabled") else "No",
                user.get("jobTitle", ""),
                user.get("department", ""),
                user.get("createdDateTime", "")[:10] if user.get("createdDateTime") else ""
            ])
        
        output.seek(0)
        filename = f"{tenant.name}_users_{datetime.now().strftime('%Y%m%d')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/licenses/csv")
async def export_licenses_csv(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Export license report to CSV"""
    client, tenant = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_subscribed_skus()
        skus = result.get("value", [])
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "SKU Part Number", "Total", "Consumed", "Available", "Usage %"
        ])
        
        for sku in skus:
            prepaid = sku.get("prepaidUnits", {})
            enabled = prepaid.get("enabled", 0)
            consumed = sku.get("consumedUnits", 0)
            available = enabled - consumed
            usage = round(consumed / enabled * 100, 1) if enabled > 0 else 0
            
            writer.writerow([
                sku.get("skuPartNumber", ""),
                enabled,
                consumed,
                available,
                f"{usage}%"
            ])
        
        output.seek(0)
        filename = f"{tenant.name}_licenses_{datetime.now().strftime('%Y%m%d')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/user-licenses/csv")
async def export_user_licenses_csv(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Export user license assignments to CSV - shows which licenses are assigned to each user"""
    client, tenant = await get_tenant_client(tenant_id, db)
    
    try:
        # First get all SKUs to build a mapping of skuId to skuPartNumber
        skus_result = await client.get_subscribed_skus()
        skus = skus_result.get("value", [])
        sku_map = {sku.get("skuId"): sku.get("skuPartNumber", "Unknown") for sku in skus}
        
        # Get all users
        users_result = await client.get_users(
            top=999,
            select=["id", "displayName", "userPrincipalName", "mail", "accountEnabled"]
        )
        users = users_result.get("value", [])
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "Display Name", "User Principal Name", "Email", 
            "Account Enabled", "Assigned Licenses", "License Count"
        ])
        
        # Process each user
        for user in users:
            user_id = user.get("id")
            
            # Get licenses for this user
            try:
                licenses_result = await client.get_user_licenses(user_id)
                license_details = licenses_result.get("value", [])
                
                # Get license names
                license_names = []
                for lic in license_details:
                    sku_id = lic.get("skuId")
                    sku_name = sku_map.get(sku_id, sku_id)  # Use skuId as fallback
                    license_names.append(sku_name)
                
                licenses_str = ", ".join(license_names) if license_names else "None"
                license_count = len(license_names)
            except Exception:
                licenses_str = "Error retrieving"
                license_count = 0
            
            writer.writerow([
                user.get("displayName", ""),
                user.get("userPrincipalName", ""),
                user.get("mail", ""),
                "Yes" if user.get("accountEnabled") else "No",
                licenses_str,
                license_count
            ])
        
        output.seek(0)
        filename = f"{tenant.name}_user_licenses_{datetime.now().strftime('%Y%m%d')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/groups/csv")
async def export_groups_csv(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Export groups to CSV"""
    client, tenant = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get_groups()
        groups = result.get("value", [])
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "Display Name", "Description", "Mail", "Security Enabled", "Mail Enabled"
        ])
        
        for group in groups:
            writer.writerow([
                group.get("displayName", ""),
                group.get("description", ""),
                group.get("mail", ""),
                "Yes" if group.get("securityEnabled") else "No",
                "Yes" if group.get("mailEnabled") else "No"
            ])
        
        output.seek(0)
        filename = f"{tenant.name}_groups_{datetime.now().strftime('%Y%m%d')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
