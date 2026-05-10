"""
Storage usage router - Mailbox, OneDrive, SharePoint capacity
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.database import get_db
from app.models import Tenant
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/storage", tags=["Storage"])


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


def format_bytes(bytes_val):
    """Format bytes to human readable string"""
    if bytes_val is None:
        return "0 B"
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(bytes_val) < 1024.0:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.1f} PB"


def parse_csv_report(csv_content: str) -> list[dict]:
    """Parse CSV report from Graph API to list of dicts"""
    lines = csv_content.strip().split('\n')
    if len(lines) < 2:
        return []
    
    # First line is header
    headers = lines[0].split(',')
    results = []
    
    for line in lines[1:]:
        if not line.strip():
            continue
        values = line.split(',')
        row = {}
        for i, header in enumerate(headers):
            row[header.strip()] = values[i].strip() if i < len(values) else ''
        results.append(row)
    
    return results


@router.get("/{tenant_id}/mailbox")
async def get_mailbox_usage(
    tenant_id: int,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Get mailbox usage for all users in the tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        # Use beta API for JSON format
        result = await client.get(
            "/reports/getMailboxUsageDetail(period='D7')",
            params={"$format": "application/json"},
            use_beta=True
        )
        
        # Parse response
        data = result.get("value", [])
        
        # Map to cleaner format
        items = []
        for item in data:
            display_name = item.get("displayName") or item.get("userPrincipalName", "Unknown")
            upn = item.get("userPrincipalName", "")
            
            # Skip if search doesn't match
            if search and search.lower() not in display_name.lower() and search.lower() not in upn.lower():
                continue
            
            storage_used = item.get("storageUsedInBytes", 0) or 0
            quota_warning = item.get("issueWarningQuotaInBytes", 0) or 0
            quota_prohibit = item.get("prohibitSendReceiveQuotaInBytes", 0) or 0
            
            # Calculate usage percentage
            max_quota = quota_prohibit if quota_prohibit > 0 else quota_warning
            usage_percent = (storage_used / max_quota * 100) if max_quota > 0 else 0
            
            items.append({
                "displayName": display_name,
                "userPrincipalName": upn,
                "storageUsed": storage_used,
                "storageUsedFormatted": format_bytes(storage_used),
                "quotaWarning": quota_warning,
                "quotaProhibit": quota_prohibit,
                "quotaFormatted": format_bytes(max_quota),
                "usagePercent": round(usage_percent, 1),
                "itemCount": item.get("itemCount", 0),
                "lastActivityDate": item.get("lastActivityDate", ""),
            })
        
        # Sort by storage used (descending)
        items.sort(key=lambda x: x["storageUsed"], reverse=True)
        
        # Pagination
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_items = items[start:end]
        
        return {
            "items": paginated_items,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/onedrive")
async def get_onedrive_usage(
    tenant_id: int,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Get OneDrive usage for all users in the tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get(
            "/reports/getOneDriveUsageAccountDetail(period='D7')",
            params={"$format": "application/json"},
            use_beta=True
        )
        
        data = result.get("value", [])
        
        items = []
        for item in data:
            owner = item.get("ownerDisplayName") or item.get("ownerPrincipalName", "Unknown")
            upn = item.get("ownerPrincipalName", "")
            
            if search and search.lower() not in owner.lower() and search.lower() not in upn.lower():
                continue
            
            storage_used = item.get("storageUsedInBytes", 0) or 0
            storage_allocated = item.get("storageAllocatedInBytes", 0) or 0
            
            usage_percent = (storage_used / storage_allocated * 100) if storage_allocated > 0 else 0
            
            items.append({
                "ownerDisplayName": owner,
                "ownerPrincipalName": upn,
                "siteUrl": item.get("siteUrl", ""),
                "storageUsed": storage_used,
                "storageUsedFormatted": format_bytes(storage_used),
                "storageAllocated": storage_allocated,
                "storageAllocatedFormatted": format_bytes(storage_allocated),
                "usagePercent": round(usage_percent, 1),
                "fileCount": item.get("fileCount", 0),
                "lastActivityDate": item.get("lastActivityDate", ""),
            })
        
        items.sort(key=lambda x: x["storageUsed"], reverse=True)
        
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_items = items[start:end]
        
        return {
            "items": paginated_items,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}/sharepoint")
async def get_sharepoint_usage(
    tenant_id: int,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Get SharePoint site usage for the tenant"""
    client = await get_tenant_client(tenant_id, db)
    
    try:
        result = await client.get(
            "/reports/getSharePointSiteUsageDetail(period='D7')",
            params={"$format": "application/json"},
            use_beta=True
        )
        
        data = result.get("value", [])
        
        items = []
        for item in data:
            site_name = item.get("siteName") or item.get("siteUrl", "Unknown")
            site_url = item.get("siteUrl", "")
            
            if search and search.lower() not in site_name.lower() and search.lower() not in site_url.lower():
                continue
            
            storage_used = item.get("storageUsedInBytes", 0) or 0
            storage_allocated = item.get("storageAllocatedInBytes", 0) or 0
            
            usage_percent = (storage_used / storage_allocated * 100) if storage_allocated > 0 else 0
            
            items.append({
                "siteName": site_name,
                "siteUrl": site_url,
                "ownerDisplayName": item.get("ownerDisplayName", ""),
                "storageUsed": storage_used,
                "storageUsedFormatted": format_bytes(storage_used),
                "storageAllocated": storage_allocated,
                "storageAllocatedFormatted": format_bytes(storage_allocated),
                "usagePercent": round(usage_percent, 1),
                "fileCount": item.get("fileCount", 0),
                "pageViewCount": item.get("pageViewCount", 0),
                "lastActivityDate": item.get("lastActivityDate", ""),
                "rootWebTemplate": item.get("rootWebTemplate", ""),
            })
        
        items.sort(key=lambda x: x["storageUsed"], reverse=True)
        
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_items = items[start:end]
        
        return {
            "items": paginated_items,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
