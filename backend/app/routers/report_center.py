"""
Report Center — comprehensive M365 reporting endpoints
Phase 1: User reports, License reports, Security reports
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Tenant
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/report-center", tags=["Report Center"])


async def _get_client(tenant_id: int, db: AsyncSession):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return graph_manager.get_client(
        tenant.tenant_id, tenant.client_id,
        decrypt_tenant_secret(tenant.client_secret)
    )


# ───────────────────── User Reports ─────────────────────

@router.get("/{tenant_id}/users/overview")
async def user_overview(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """User statistics overview — all / enabled / disabled / guest / synced"""
    client = await _get_client(tenant_id, db)

    users_data = await client.get_users(
        top=999,
        select=["id", "displayName", "userPrincipalName", "mail",
                "accountEnabled", "userType", "createdDateTime",
                "onPremisesSyncEnabled", "lastPasswordChangeDateTime",
                "department", "jobTitle", "companyName"]
    )
    users = users_data.get("value", [])

    total = len(users)
    enabled = sum(1 for u in users if u.get("accountEnabled"))
    disabled = total - enabled
    guests = sum(1 for u in users if u.get("userType") == "Guest")
    members = total - guests
    synced = sum(1 for u in users if u.get("onPremisesSyncEnabled"))
    cloud_only = total - synced

    # Recently created (last 30 days)
    cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat() + "Z"
    recent = sum(1 for u in users
                 if (u.get("createdDateTime") or "") >= cutoff)

    # Department distribution (top 10)
    dept_counts: dict = {}
    for u in users:
        dept = u.get("department") or "未设置"
        dept_counts[dept] = dept_counts.get(dept, 0) + 1
    dept_distribution = sorted(dept_counts.items(), key=lambda x: -x[1])[:10]

    return {
        "summary": {
            "total": total,
            "enabled": enabled,
            "disabled": disabled,
            "guests": guests,
            "members": members,
            "synced": synced,
            "cloudOnly": cloud_only,
            "recentlyCreated": recent,
        },
        "departmentDistribution": [
            {"name": d, "count": c} for d, c in dept_distribution
        ],
        "users": users,
    }


@router.get("/{tenant_id}/users/disabled")
async def disabled_users(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List disabled users"""
    client = await _get_client(tenant_id, db)
    data = await client.get(
        "/users",
        params={
            "$filter": "accountEnabled eq false",
            "$select": "id,displayName,userPrincipalName,mail,createdDateTime,department,jobTitle",
            "$top": "999",
        }
    )
    return data


@router.get("/{tenant_id}/users/guests")
async def guest_users(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """List guest / external users"""
    client = await _get_client(tenant_id, db)
    data = await client.get(
        "/users",
        params={
            "$filter": "userType eq 'Guest'",
            "$select": "id,displayName,userPrincipalName,mail,createdDateTime,externalUserState",
            "$top": "999",
        }
    )
    return data


@router.get("/{tenant_id}/users/recent")
async def recent_users(
    tenant_id: int,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Users created in the last N days"""
    client = await _get_client(tenant_id, db)
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    data = await client.get(
        "/users",
        params={
            "$filter": f"createdDateTime ge {cutoff}",
            "$select": "id,displayName,userPrincipalName,mail,accountEnabled,createdDateTime,userType",
            "$top": "999",
            "$orderby": "createdDateTime desc",
        }
    )
    return data


@router.get("/{tenant_id}/users/admins")
async def admin_users(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """All admin users with their roles"""
    client = await _get_client(tenant_id, db)
    roles_data = await client.get_directory_roles()
    roles = roles_data.get("value", [])

    admins = {}
    for role in roles:
        role_id = role["id"]
        role_name = role.get("displayName", "Unknown")
        try:
            members_data = await client.get_role_members(role_id)
            for m in members_data.get("value", []):
                uid = m.get("id")
                if uid not in admins:
                    admins[uid] = {
                        "id": uid,
                        "displayName": m.get("displayName"),
                        "userPrincipalName": m.get("userPrincipalName"),
                        "mail": m.get("mail"),
                        "roles": [],
                    }
                admins[uid]["roles"].append(role_name)
        except Exception:
            pass

    return {
        "value": list(admins.values()),
        "totalAdmins": len(admins),
        "totalRoles": len(roles),
        "roles": [{"id": r["id"], "displayName": r.get("displayName"),
                    "memberCount": 0} for r in roles],
    }


# ───────────────────── License Reports ─────────────────────

@router.get("/{tenant_id}/licenses/overview")
async def license_overview(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """License usage overview with subscription details"""
    client = await _get_client(tenant_id, db)
    skus_data = await client.get_subscribed_skus()
    skus = skus_data.get("value", [])

    total_enabled = 0
    total_consumed = 0
    subscriptions = []
    for sku in skus:
        prepaid = sku.get("prepaidUnits", {})
        enabled = prepaid.get("enabled", 0)
        consumed = sku.get("consumedUnits", 0)
        available = enabled - consumed
        cap_status = sku.get("capabilityStatus", "")
        total_enabled += enabled
        total_consumed += consumed
        subscriptions.append({
            "skuId": sku.get("skuId"),
            "skuPartNumber": sku.get("skuPartNumber"),
            "displayName": sku.get("skuPartNumber"),
            "enabled": enabled,
            "consumed": consumed,
            "available": available,
            "usagePercent": round(consumed / enabled * 100, 1) if enabled else 0,
            "capabilityStatus": cap_status,
        })

    return {
        "summary": {
            "totalSubscriptions": len(subscriptions),
            "totalEnabled": total_enabled,
            "totalConsumed": total_consumed,
            "totalAvailable": total_enabled - total_consumed,
            "overallUsagePercent": round(
                total_consumed / total_enabled * 100, 1
            ) if total_enabled else 0,
        },
        "subscriptions": subscriptions,
    }


@router.get("/{tenant_id}/licenses/unlicensed-users")
async def unlicensed_users(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Users without any license assigned"""
    client = await _get_client(tenant_id, db)
    # Graph API: filter users with no assigned licenses
    all_users = await client.get_users(
        top=999,
        select=["id", "displayName", "userPrincipalName", "mail",
                "accountEnabled", "assignedLicenses", "userType"]
    )
    users = all_users.get("value", [])
    unlicensed = [u for u in users if not u.get("assignedLicenses")]
    return {"value": unlicensed, "count": len(unlicensed)}


@router.get("/{tenant_id}/licenses/licensed-users")
async def licensed_users(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Users with licenses assigned"""
    client = await _get_client(tenant_id, db)
    all_users = await client.get_users(
        top=999,
        select=["id", "displayName", "userPrincipalName", "mail",
                "accountEnabled", "assignedLicenses", "userType"]
    )
    users = all_users.get("value", [])
    licensed = [u for u in users if u.get("assignedLicenses")]
    return {"value": licensed, "count": len(licensed)}


# ───────────────────── Security Reports ─────────────────────

@router.get("/{tenant_id}/security/overview")
async def security_overview(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Security overview — MFA, password, admin stats"""
    client = await _get_client(tenant_id, db)
    errors = []

    # --- MFA registration ---
    mfa_data = {"total": 0, "registered": 0, "capable": 0, "coveragePercent": 0,
                "details": []}
    try:
        res = await client.get_credential_user_registration()
        details = res.get("value", [])
        mfa_data["total"] = len(details)
        mfa_data["registered"] = sum(
            1 for d in details if d.get("isMfaRegistered")
        )
        mfa_data["capable"] = sum(
            1 for d in details if d.get("isMfaCapable")
        )
        mfa_data["coveragePercent"] = round(
            mfa_data["registered"] / mfa_data["total"] * 100, 1
        ) if mfa_data["total"] else 0
        # Users without MFA
        mfa_data["details"] = [
            {
                "id": d.get("id"),
                "userPrincipalName": d.get("userPrincipalName"),
                "userDisplayName": d.get("userDisplayName"),
                "isMfaRegistered": d.get("isMfaRegistered"),
                "isMfaCapable": d.get("isMfaCapable"),
                "isSsprRegistered": d.get("isSsprRegistered"),
                "isPasswordlessCapable": d.get("isPasswordlessCapable"),
                "methodsRegistered": d.get("methodsRegistered", []),
            }
            for d in details
        ]
    except Exception as e:
        errors.append(f"mfa: {e}")

    # --- Password status ---
    pwd_data = {"neverExpires": 0, "recentChanged": 0, "details": []}
    try:
        users_res = await client.get_users(
            top=999,
            select=["id", "displayName", "userPrincipalName",
                    "lastPasswordChangeDateTime", "passwordPolicies",
                    "accountEnabled", "userType"]
        )
        users = users_res.get("value", [])
        for u in users:
            if u.get("userType") == "Guest":
                continue
            policies = u.get("passwordPolicies") or ""
            never_expires = "DisablePasswordExpiration" in policies
            last_changed = u.get("lastPasswordChangeDateTime")
            if never_expires:
                pwd_data["neverExpires"] += 1
            if last_changed:
                cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat() + "Z"
                if last_changed >= cutoff:
                    pwd_data["recentChanged"] += 1
            pwd_data["details"].append({
                "id": u.get("id"),
                "displayName": u.get("displayName"),
                "userPrincipalName": u.get("userPrincipalName"),
                "lastPasswordChangeDateTime": last_changed,
                "passwordNeverExpires": never_expires,
                "accountEnabled": u.get("accountEnabled"),
            })
    except Exception as e:
        errors.append(f"password: {e}")

    # --- Admin stats ---
    admin_data = {"totalAdmins": 0, "globalAdmins": 0}
    try:
        roles_res = await client.get_directory_roles()
        roles = roles_res.get("value", [])
        admin_ids = set()
        for role in roles:
            try:
                members = await client.get_role_members(role["id"])
                member_list = members.get("value", [])
                for m in member_list:
                    admin_ids.add(m.get("id"))
                if "Global Administrator" in (role.get("displayName") or ""):
                    admin_data["globalAdmins"] = len(member_list)
            except Exception:
                pass
        admin_data["totalAdmins"] = len(admin_ids)
    except Exception as e:
        errors.append(f"admins: {e}")

    return {
        "mfa": mfa_data,
        "password": pwd_data,
        "admins": admin_data,
        "errors": errors,
    }


@router.get("/{tenant_id}/security/mfa-details")
async def mfa_details(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Detailed MFA registration status per user"""
    client = await _get_client(tenant_id, db)
    res = await client.get_credential_user_registration()
    return res


# ───────────────────── Exchange / Mailbox Reports (Phase 2) ─────────────────────

def _safe_int(v, default=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _safe_float(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _bytes_to_gb(b):
    return round(_safe_float(b) / (1024 ** 3), 2)


@router.get("/{tenant_id}/exchange/overview")
async def exchange_overview(
    tenant_id: int,
    period: str = Query("D7", regex="^D(7|30|90|180)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange mailbox usage overview.
    Uses /reports/getMailboxUsageDetail(period='D7') — returns CSV.
    """
    client = await _get_client(tenant_id, db)
    data = await client.get(
        f"/reports/getMailboxUsageDetail(period='{period}')"
    )
    rows = data.get("value", [])

    total = len(rows)
    # CSV columns (Display Name style): "User Principal Name", "Storage Used (Byte)",
    # "Issue Warning Quota (Byte)", "Prohibit Send Quota (Byte)",
    # "Prohibit Send/Receive Quota (Byte)", "Has Archive", "Item Count",
    # "Is Deleted", "Deleted Date", "Last Activity Date"
    active = 0
    inactive = 0
    deleted = 0
    has_archive = 0
    total_storage = 0
    total_items = 0
    over_warning = 0

    mailboxes = []
    for r in rows:
        # Normalise keys — Graph CSV may use different capitalisations
        upn = r.get("User Principal Name") or r.get("userPrincipalName") or ""
        display = r.get("Display Name") or r.get("displayName") or ""
        storage = _safe_int(r.get("Storage Used (Byte)") or r.get("storageUsedInBytes"))
        warning_q = _safe_int(r.get("Issue Warning Quota (Byte)") or r.get("issueWarningQuotaInBytes"))
        send_q = _safe_int(r.get("Prohibit Send Quota (Byte)") or r.get("prohibitSendQuotaInBytes"))
        items = _safe_int(r.get("Item Count") or r.get("itemCount"))
        is_del = str(r.get("Is Deleted") or r.get("isDeleted") or "").lower() in ("true", "1")
        archive = str(r.get("Has Archive") or r.get("hasArchive") or "").lower() in ("true", "1")
        last_activity = r.get("Last Activity Date") or r.get("lastActivityDate") or ""

        total_storage += storage
        total_items += items
        if is_del:
            deleted += 1
        elif last_activity:
            active += 1
        else:
            inactive += 1
        if archive:
            has_archive += 1
        if warning_q and storage > warning_q:
            over_warning += 1

        mailboxes.append({
            "userPrincipalName": upn,
            "displayName": display,
            "storageUsedBytes": storage,
            "storageUsedGB": _bytes_to_gb(storage),
            "warningQuotaBytes": warning_q,
            "sendQuotaBytes": send_q,
            "itemCount": items,
            "isDeleted": is_del,
            "hasArchive": archive,
            "lastActivityDate": last_activity,
            "overWarning": warning_q > 0 and storage > warning_q,
        })

    # Sort by storage desc
    mailboxes.sort(key=lambda m: m["storageUsedBytes"], reverse=True)

    return {
        "summary": {
            "total": total,
            "active": active,
            "inactive": inactive,
            "deleted": deleted,
            "hasArchive": has_archive,
            "overWarningQuota": over_warning,
            "totalStorageGB": _bytes_to_gb(total_storage),
            "totalItems": total_items,
        },
        "mailboxes": mailboxes,
    }


@router.get("/{tenant_id}/exchange/activity")
async def exchange_activity(
    tenant_id: int,
    period: str = Query("D7", regex="^D(7|30|90|180)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Email activity per user.
    Uses /reports/getEmailActivityUserDetail(period='D7') — CSV.
    """
    client = await _get_client(tenant_id, db)
    data = await client.get(
        f"/reports/getEmailActivityUserDetail(period='{period}')"
    )
    rows = data.get("value", [])

    total_send = 0
    total_receive = 0
    total_read = 0
    users = []
    for r in rows:
        send = _safe_int(r.get("Send Count") or r.get("sendCount"))
        recv = _safe_int(r.get("Receive Count") or r.get("receiveCount"))
        read = _safe_int(r.get("Read Count") or r.get("readCount"))
        total_send += send
        total_receive += recv
        total_read += read
        users.append({
            "userPrincipalName": r.get("User Principal Name") or r.get("userPrincipalName") or "",
            "displayName": r.get("Display Name") or r.get("displayName") or "",
            "sendCount": send,
            "receiveCount": recv,
            "readCount": read,
            "lastActivityDate": r.get("Last Activity Date") or r.get("lastActivityDate") or "",
        })

    users.sort(key=lambda u: u["sendCount"] + u["receiveCount"], reverse=True)

    return {
        "summary": {
            "totalUsers": len(users),
            "totalSend": total_send,
            "totalReceive": total_receive,
            "totalRead": total_read,
        },
        "users": users,
    }


@router.get("/{tenant_id}/exchange/app-usage")
async def exchange_app_usage(
    tenant_id: int,
    period: str = Query("D7", regex="^D(7|30|90|180)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Email app (client) usage per user.
    Uses /reports/getEmailAppUsageUserDetail(period='D7') — CSV.
    """
    client = await _get_client(tenant_id, db)
    data = await client.get(
        f"/reports/getEmailAppUsageUserDetail(period='{period}')"
    )
    rows = data.get("value", [])

    # Aggregate app counts
    app_counts: dict = {}
    users = []
    for r in rows:
        upn = r.get("User Principal Name") or r.get("userPrincipalName") or ""
        display = r.get("Display Name") or r.get("displayName") or ""
        last_activity = r.get("Last Activity Date") or r.get("lastActivityDate") or ""

        # Check which apps are used (CSV columns like "Outlook", "Web", "POP3", etc.)
        apps_used = []
        for app in ["Outlook", "Web", "POP3", "IMAP4", "SMTP",
                     "Outlook for Mac", "Outlook for Mobile",
                     "Other for Mobile", "Outlook for Windows"]:
            key_csv = app
            key_json = app.lower().replace(" ", "").replace("for", "For")
            val = str(r.get(key_csv) or r.get(key_json) or "").lower()
            if val in ("yes", "true", "1"):
                apps_used.append(app)
                app_counts[app] = app_counts.get(app, 0) + 1

        users.append({
            "userPrincipalName": upn,
            "displayName": display,
            "appsUsed": apps_used,
            "lastActivityDate": last_activity,
        })

    app_distribution = sorted(app_counts.items(), key=lambda x: -x[1])

    return {
        "summary": {
            "totalUsers": len(users),
            "appDistribution": [
                {"name": name, "count": cnt} for name, cnt in app_distribution
            ],
        },
        "users": users,
    }


# ───────────────────── Teams Reports (Phase 3) ─────────────────────

@router.get("/{tenant_id}/teams/overview")
async def teams_overview(
    tenant_id: int,
    period: str = Query("D7", regex="^D(7|30|90|180)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Teams user activity overview.
    /reports/getTeamsUserActivityUserDetail(period='D7') — CSV.
    """
    client = await _get_client(tenant_id, db)
    data = await client.get(
        f"/reports/getTeamsUserActivityUserDetail(period='{period}')"
    )
    rows = data.get("value", [])

    total = len(rows)
    active = 0
    total_chats = 0
    total_calls = 0
    total_meetings = 0
    users = []

    for r in rows:
        upn = r.get("User Principal Name") or r.get("userPrincipalName") or ""
        display = r.get("Display Name") or r.get("displayName") or ""
        last_activity = r.get("Last Activity Date") or r.get("lastActivityDate") or ""
        chats = _safe_int(r.get("Team Chat Message Count") or r.get("teamChatMessageCount"))
        calls = _safe_int(r.get("Call Count") or r.get("callCount"))
        meetings = _safe_int(r.get("Meeting Count") or r.get("meetingCount"))
        private_chats = _safe_int(r.get("Private Chat Message Count") or r.get("privateChatMessageCount"))
        is_del = str(r.get("Is Deleted") or r.get("isDeleted") or "").lower() in ("true", "1")

        if last_activity and not is_del:
            active += 1
        total_chats += chats + private_chats
        total_calls += calls
        total_meetings += meetings

        users.append({
            "userPrincipalName": upn,
            "displayName": display,
            "lastActivityDate": last_activity,
            "teamChatMessageCount": chats,
            "privateChatMessageCount": private_chats,
            "callCount": calls,
            "meetingCount": meetings,
            "isDeleted": is_del,
        })

    users.sort(key=lambda u: u["teamChatMessageCount"] + u["callCount"] + u["meetingCount"], reverse=True)

    return {
        "summary": {
            "total": total,
            "active": active,
            "inactive": total - active,
            "totalChats": total_chats,
            "totalCalls": total_calls,
            "totalMeetings": total_meetings,
        },
        "users": users,
    }


@router.get("/{tenant_id}/teams/device-usage")
async def teams_device_usage(
    tenant_id: int,
    period: str = Query("D7", regex="^D(7|30|90|180)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Teams device usage per user.
    /reports/getTeamsDeviceUsageUserDetail(period='D7') — CSV.
    """
    client = await _get_client(tenant_id, db)
    data = await client.get(
        f"/reports/getTeamsDeviceUsageUserDetail(period='{period}')"
    )
    rows = data.get("value", [])

    device_counts: dict = {}
    users = []
    for r in rows:
        upn = r.get("User Principal Name") or r.get("userPrincipalName") or ""
        display = r.get("Display Name") or r.get("displayName") or ""
        last_activity = r.get("Last Activity Date") or r.get("lastActivityDate") or ""

        devices_used = []
        for dev in ["Windows", "Mac", "Web", "iOS", "Android Phone",
                     "Windows Phone", "Chrome OS", "Linux"]:
            key_csv = f"Used {dev}"
            key_json = f"used{dev.replace(' ', '')}"
            val = str(r.get(key_csv) or r.get(dev) or r.get(key_json) or "").lower()
            if val in ("yes", "true", "1"):
                devices_used.append(dev)
                device_counts[dev] = device_counts.get(dev, 0) + 1

        users.append({
            "userPrincipalName": upn,
            "displayName": display,
            "devicesUsed": devices_used,
            "lastActivityDate": last_activity,
        })

    device_distribution = sorted(device_counts.items(), key=lambda x: -x[1])

    return {
        "summary": {
            "totalUsers": len(users),
            "deviceDistribution": [
                {"name": name, "count": cnt} for name, cnt in device_distribution
            ],
        },
        "users": users,
    }


# ───────────────────── SharePoint Reports (Phase 3) ─────────────────────

@router.get("/{tenant_id}/sharepoint/overview")
async def sharepoint_overview(
    tenant_id: int,
    period: str = Query("D7", regex="^D(7|30|90|180)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    SharePoint site usage overview.
    /reports/getSharePointSiteUsageDetail(period='D7') — CSV.
    """
    client = await _get_client(tenant_id, db)
    data = await client.get(
        f"/reports/getSharePointSiteUsageDetail(period='{period}')"
    )
    rows = data.get("value", [])

    total = len(rows)
    active = 0
    inactive = 0
    total_storage = 0
    total_files = 0
    total_pages_visited = 0

    sites = []
    for r in rows:
        url = r.get("Site URL") or r.get("siteUrl") or ""
        name = r.get("Site Name") or r.get("siteName") or ""  # not always available
        owner = r.get("Owner Display Name") or r.get("ownerDisplayName") or ""
        last_activity = r.get("Last Activity Date") or r.get("lastActivityDate") or ""
        storage = _safe_int(r.get("Storage Used (Byte)") or r.get("storageUsedInBytes"))
        allocated = _safe_int(r.get("Storage Allocated (Byte)") or r.get("storageAllocatedInBytes"))
        files = _safe_int(r.get("File Count") or r.get("fileCount"))
        active_files = _safe_int(r.get("Active File Count") or r.get("activeFileCount"))
        pages = _safe_int(r.get("Page View Count") or r.get("pageViewCount"))
        visited_pages = _safe_int(r.get("Visited Page Count") or r.get("visitedPageCount"))
        is_del = str(r.get("Is Deleted") or r.get("isDeleted") or "").lower() in ("true", "1")

        if last_activity and not is_del:
            active += 1
        else:
            inactive += 1
        total_storage += storage
        total_files += files
        total_pages_visited += visited_pages

        sites.append({
            "siteUrl": url,
            "siteName": name or url.split("/")[-1] if url else "-",
            "ownerDisplayName": owner,
            "lastActivityDate": last_activity,
            "storageUsedBytes": storage,
            "storageUsedGB": _bytes_to_gb(storage),
            "storageAllocatedGB": _bytes_to_gb(allocated),
            "fileCount": files,
            "activeFileCount": active_files,
            "pageViewCount": pages,
            "visitedPageCount": visited_pages,
            "isDeleted": is_del,
        })

    sites.sort(key=lambda s: s["storageUsedBytes"], reverse=True)

    return {
        "summary": {
            "total": total,
            "active": active,
            "inactive": inactive,
            "totalStorageGB": _bytes_to_gb(total_storage),
            "totalFiles": total_files,
            "totalPagesVisited": total_pages_visited,
        },
        "sites": sites,
    }


# ───────────────────── OneDrive Reports (Phase 3) ─────────────────────

@router.get("/{tenant_id}/onedrive/overview")
async def onedrive_overview(
    tenant_id: int,
    period: str = Query("D7", regex="^D(7|30|90|180)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    OneDrive usage overview.
    /reports/getOneDriveUsageAccountDetail(period='D7') — CSV.
    """
    client = await _get_client(tenant_id, db)
    data = await client.get(
        f"/reports/getOneDriveUsageAccountDetail(period='{period}')"
    )
    rows = data.get("value", [])

    total = len(rows)
    active = 0
    total_storage = 0
    total_files = 0

    accounts = []
    for r in rows:
        upn = r.get("Owner Principal Name") or r.get("ownerPrincipalName") or ""
        display = r.get("Owner Display Name") or r.get("ownerDisplayName") or ""
        url = r.get("Site URL") or r.get("siteUrl") or ""
        last_activity = r.get("Last Activity Date") or r.get("lastActivityDate") or ""
        storage = _safe_int(r.get("Storage Used (Byte)") or r.get("storageUsedInBytes"))
        allocated = _safe_int(r.get("Storage Allocated (Byte)") or r.get("storageAllocatedInBytes"))
        files = _safe_int(r.get("File Count") or r.get("fileCount"))
        active_files = _safe_int(r.get("Active File Count") or r.get("activeFileCount"))
        is_del = str(r.get("Is Deleted") or r.get("isDeleted") or "").lower() in ("true", "1")

        if last_activity and not is_del:
            active += 1
        total_storage += storage
        total_files += files

        accounts.append({
            "ownerPrincipalName": upn,
            "ownerDisplayName": display,
            "siteUrl": url,
            "lastActivityDate": last_activity,
            "storageUsedBytes": storage,
            "storageUsedGB": _bytes_to_gb(storage),
            "storageAllocatedGB": _bytes_to_gb(allocated),
            "fileCount": files,
            "activeFileCount": active_files,
            "isDeleted": is_del,
        })

    accounts.sort(key=lambda a: a["storageUsedBytes"], reverse=True)

    return {
        "summary": {
            "total": total,
            "active": active,
            "inactive": total - active,
            "totalStorageGB": _bytes_to_gb(total_storage),
            "totalFiles": total_files,
        },
        "accounts": accounts,
    }


# ───────────────────── Trends (Phase 4) ─────────────────────

@router.get("/{tenant_id}/trends/storage")
async def trends_storage(
    tenant_id: int,
    period: str = Query("D30", regex="^D(7|30|90|180)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Daily storage trend for Exchange, SharePoint, OneDrive.
    Returns arrays of {date, valueGB} for chart rendering.
    """
    client = await _get_client(tenant_id, db)

    async def _fetch_trend(report_name: str, storage_col: str) -> list:
        try:
            data = await client.get(
                f"/reports/{report_name}(period='{period}')"
            )
            rows = data.get("value", [])
            points = []
            for r in rows:
                dt = r.get("Report Date") or r.get("reportDate") or ""
                val = _safe_int(r.get(storage_col) or 0)
                if dt:
                    points.append({"date": dt, "valueGB": _bytes_to_gb(val)})
            points.sort(key=lambda p: p["date"])
            return points
        except Exception:
            return []

    exchange, sharepoint, onedrive = await asyncio.gather(
        _fetch_trend("getMailboxUsageStorage", "Storage Used (Byte)"),
        _fetch_trend("getSharePointSiteUsageStorage", "Storage Used (Byte)"),
        _fetch_trend("getOneDriveUsageStorage", "Storage Used (Byte)"),
    )

    return {
        "exchange": exchange,
        "sharepoint": sharepoint,
        "onedrive": onedrive,
    }


@router.get("/{tenant_id}/trends/activity")
async def trends_activity(
    tenant_id: int,
    period: str = Query("D30", regex="^D(7|30|90|180)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Daily activity trend: email send/receive, Teams chats, SP file activity.
    """
    client = await _get_client(tenant_id, db)

    async def _fetch_counts(report_name: str, count_cols: list) -> list:
        try:
            data = await client.get(
                f"/reports/{report_name}(period='{period}')"
            )
            rows = data.get("value", [])
            points = []
            for r in rows:
                dt = r.get("Report Date") or r.get("reportDate") or ""
                if not dt:
                    continue
                point: dict = {"date": dt}
                for col_label, col_csv, col_json in count_cols:
                    point[col_label] = _safe_int(r.get(col_csv) or r.get(col_json) or 0)
                points.append(point)
            points.sort(key=lambda p: p["date"])
            return points
        except Exception:
            return []

    email, teams, sharepoint = await asyncio.gather(
        _fetch_counts("getEmailActivityCounts", [
            ("send", "Send Count", "sendCount"),
            ("receive", "Receive Count", "receiveCount"),
        ]),
        _fetch_counts("getTeamsUserActivityCounts", [
            ("chat", "Team Chat Message Count", "teamChatMessageCount"),
            ("call", "Call Count", "callCount"),
            ("meeting", "Meeting Count", "meetingCount"),
        ]),
        _fetch_counts("getSharePointActivityFileCounts", [
            ("viewedOrEdited", "Viewed Or Edited", "viewedOrEdited"),
            ("synced", "Synced", "synced"),
            ("shared", "Shared Internally", "sharedInternally"),
        ]),
    )

    return {
        "email": email,
        "teams": teams,
        "sharepoint": sharepoint,
    }


@router.get("/{tenant_id}/trends/secure-score")
async def trends_secure_score(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Microsoft Secure Score trend (latest 90 entries).
    """
    client = await _get_client(tenant_id, db)
    try:
        data = await client.get(
            "/security/secureScores",
            params={"$top": "90", "$select": "createdDateTime,currentScore,maxScore"},
        )
        entries = data.get("value", [])
        points = []
        for e in entries:
            dt = (e.get("createdDateTime") or "")[:10]
            current = e.get("currentScore", 0)
            maximum = e.get("maxScore", 1)
            points.append({
                "date": dt,
                "score": current,
                "maxScore": maximum,
                "percentage": round(current / maximum * 100, 1) if maximum else 0,
            })
        points.sort(key=lambda p: p["date"])
        return {"scores": points}
    except Exception:
        return {"scores": []}
