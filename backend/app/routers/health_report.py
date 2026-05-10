"""
Health Report router – monthly health check data
Covers: usage, license compliance, security alerts, secure score
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Tenant
from app.services.graph_client import graph_manager
from app.security.tenant_secrets import decrypt_tenant_secret

router = APIRouter(prefix="/health-report", tags=["Health Report"])


async def _client(tenant_id: int, db: AsyncSession):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not tenant.is_active:
        raise HTTPException(status_code=400, detail="Tenant is not active")
    return graph_manager.get_client(
        tenant.tenant_id, tenant.client_id,
        decrypt_tenant_secret(tenant.client_secret)
    )


# ==================== 使用率 ====================

@router.get("/{tenant_id}/usage")
async def get_usage_report(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Usage report: active users and mailbox usage"""
    client = await _client(tenant_id, db)

    errors: list[str] = []

    # Active users
    active_users_data = []
    try:
        res = await client.get_m365_active_user_detail()
        active_users_data = res.get("value", []) if isinstance(res, dict) else []
    except Exception as e:
        errors.append(f"active_users: {e}")

    # Mailbox usage
    mailbox_data = []
    try:
        res = await client.get_mailbox_usage_detail()
        mailbox_data = res.get("value", []) if isinstance(res, dict) else []
    except Exception as e:
        errors.append(f"mailbox_usage: {e}")

    # Summarize — handle both JSON keys (camelCase) and CSV keys (Display Name)
    total_users = len(active_users_data)
    license_keys = [
        "hasExchangeLicense", "Has Exchange License",
        "hasOneDriveLicense", "Has OneDrive License",
        "hasSharePointLicense", "Has SharePoint License",
        "hasTeamsLicense", "Has Teams License",
    ]
    active_count = sum(
        1 for u in active_users_data
        if any(str(u.get(k, "")).lower() in ("true", "1") for k in license_keys)
    )

    return {
        "totalUsers": total_users,
        "activeUsers": active_count,
        "activeRate": round(active_count / total_users * 100, 1) if total_users else 0,
        "mailboxCount": len(mailbox_data),
        "activeUserDetail": active_users_data[:20],
        "mailboxDetail": mailbox_data[:20],
        "errors": errors,
    }


# ==================== 授权合规 ====================

@router.get("/{tenant_id}/license-compliance")
async def get_license_compliance(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """License compliance: usage vs allocation"""
    client = await _client(tenant_id, db)

    skus_res = await client.get_subscribed_skus()
    sku_list = skus_res.get("value", [])

    licenses = []
    total_enabled = 0
    total_consumed = 0
    for sku in sku_list:
        prepaid = sku.get("prepaidUnits", {})
        enabled = prepaid.get("enabled", 0)
        consumed = sku.get("consumedUnits", 0)
        total_enabled += enabled
        total_consumed += consumed
        licenses.append({
            "skuId": sku.get("skuId"),
            "skuPartNumber": sku.get("skuPartNumber"),
            "enabled": enabled,
            "consumed": consumed,
            "available": enabled - consumed,
            "usagePercent": round(consumed / enabled * 100, 1) if enabled else 0,
        })

    # Find inactive licensed users (enabled=False but have licenses)
    users_res = await client.get_users(
        top=999,
        select=["id", "displayName", "userPrincipalName", "accountEnabled", "assignedLicenses"]
    )
    users = users_res.get("value", [])
    inactive_licensed = [
        {
            "id": u.get("id"),
            "displayName": u.get("displayName"),
            "userPrincipalName": u.get("userPrincipalName"),
            "licensesCount": len(u.get("assignedLicenses", [])),
        }
        for u in users
        if not u.get("accountEnabled") and u.get("assignedLicenses")
    ]

    return {
        "totalEnabled": total_enabled,
        "totalConsumed": total_consumed,
        "overallUsagePercent": round(total_consumed / total_enabled * 100, 1) if total_enabled else 0,
        "licenses": licenses,
        "inactiveLicensedUsers": inactive_licensed,
        "inactiveLicensedCount": len(inactive_licensed),
    }


# ==================== 资安告警 ====================

@router.get("/{tenant_id}/security-alerts")
async def get_security_alerts(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Security alerts: risky users, risk detections, MFA coverage"""
    client = await _client(tenant_id, db)

    errors: list[str] = []

    # Risky users
    risky_users = []
    try:
        res = await client.get_risky_users()
        risky_users = res.get("value", [])
    except Exception as e:
        errors.append(f"risky_users: {e}")

    # Risk detections
    risk_detections = []
    try:
        res = await client.get_risk_detections()
        risk_detections = res.get("value", [])
    except Exception as e:
        errors.append(f"risk_detections: {e}")

    # MFA registration
    mfa_stats = {"registered": 0, "total": 0, "coveragePercent": 0}
    try:
        res = await client.get_credential_user_registration()
        details = res.get("value", [])
        mfa_stats["total"] = len(details)
        mfa_stats["registered"] = sum(1 for d in details if d.get("isMfaRegistered"))
        mfa_stats["coveragePercent"] = (
            round(mfa_stats["registered"] / mfa_stats["total"] * 100, 1)
            if mfa_stats["total"] else 0
        )
    except Exception as e:
        errors.append(f"mfa: {e}")

    # Summarize risky users by risk level
    risk_summary = {"high": 0, "medium": 0, "low": 0, "none": 0}
    for u in risky_users:
        level = (u.get("riskLevel") or "none").lower()
        risk_summary[level] = risk_summary.get(level, 0) + 1

    return {
        "riskyUsers": risky_users[:20],
        "riskyUserCount": len(risky_users),
        "riskSummary": risk_summary,
        "riskDetections": risk_detections[:20],
        "riskDetectionCount": len(risk_detections),
        "mfa": mfa_stats,
        "errors": errors,
    }


# ==================== Secure Score ====================

@router.get("/{tenant_id}/secure-score")
async def get_secure_score(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Secure Score and improvement actions"""
    client = await _client(tenant_id, db)

    errors: list[str] = []
    score_data = {}
    try:
        res = await client.get_secure_scores(top=1)
        scores = res.get("value", [])
        if scores:
            latest = scores[0]
            score_data = {
                "currentScore": latest.get("currentScore", 0),
                "maxScore": latest.get("maxScore", 0),
                "scorePercent": (
                    round(latest.get("currentScore", 0) / latest.get("maxScore", 1) * 100, 1)
                    if latest.get("maxScore") else 0
                ),
                "createdDateTime": latest.get("createdDateTime"),
                "controlScores": latest.get("controlScores", [])[:30],
            }
    except Exception as e:
        errors.append(f"secure_score: {e}")

    return {
        **score_data,
        "errors": errors,
    }


# ==================== 汇总 ====================

@router.get("/{tenant_id}/summary")
async def get_health_report_summary(tenant_id: int, db: AsyncSession = Depends(get_db)):
    """Full health report summary combining all sections"""
    usage = await get_usage_report(tenant_id, db)
    compliance = await get_license_compliance(tenant_id, db)
    security = await get_security_alerts(tenant_id, db)
    score = await get_secure_score(tenant_id, db)

    return {
        "usage": usage,
        "licenseCompliance": compliance,
        "securityAlerts": security,
        "secureScore": score,
    }
