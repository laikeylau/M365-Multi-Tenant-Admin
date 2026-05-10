"""
Routers package initialization
"""
from app.routers.tenants import router as tenants_router
from app.routers.users import router as users_router
from app.routers.licenses import router as licenses_router
from app.routers.groups import router as groups_router
from app.routers.domains import router as domains_router
from app.routers.audit import router as audit_router
from app.routers.health import router as health_router
from app.routers.dashboard import router as dashboard_router
from app.routers.reports import router as reports_router
from app.routers.auth import router as auth_router
from app.routers.storage import router as storage_router
from app.routers.health_report import router as health_report_router
from app.routers.report_center import router as report_center_router
from app.routers.exchange import router as exchange_router
from app.routers.entra import router as entra_router
from app.routers.security_defender import router as security_router
from app.routers.intune import router as intune_router
from app.routers.compliance import router as compliance_router
from app.routers.sharepoint_admin import router as sharepoint_router
from app.routers.teams_admin import router as teams_router
from app.routers.auto_register import router as auto_register_router

__all__ = [
    "tenants_router",
    "users_router",
    "licenses_router",
    "groups_router",
    "domains_router",
    "audit_router",
    "health_router",
    "dashboard_router",
    "reports_router",
    "auth_router",
    "storage_router",
    "health_report_router",
    "report_center_router",
    "exchange_router",
    "entra_router",
    "security_router",
    "intune_router",
    "compliance_router",
    "sharepoint_router",
    "teams_router",
    "auto_register_router",
]
