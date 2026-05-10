"""
M365 Multi-Tenant Admin Platform
FastAPI Application Entry Point
"""
import logging
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db
from app.routers.auth import require_auth
from app.routers import (
    tenants_router,
    users_router,
    licenses_router,
    groups_router,
    domains_router,
    audit_router,
    health_router,
    dashboard_router,
    reports_router,
    auth_router,
    storage_router,
    health_report_router,
    report_center_router,
    exchange_router,
    entra_router,
    security_router,
    intune_router,
    compliance_router,
    sharepoint_router,
    teams_router,
    auto_register_router,
)
from app.services.graph_client import GraphClient

# Configure structured logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    await init_db()
    logger.info("Database initialized")
    yield
    # Shutdown — close the shared HTTP connection pool
    await GraphClient.close_http_client()
    logger.info("HTTP client closed")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Microsoft 365 Multi-Tenant Administration Platform",
    lifespan=lifespan
)

cors_origins = settings.cors_origins_list()
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,  # Authorization header; no cookies by default
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register routers
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(auto_register_router, prefix=settings.API_V1_PREFIX)  # No auth required
authz = [Depends(require_auth)]
app.include_router(dashboard_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(tenants_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(users_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(licenses_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(groups_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(domains_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(audit_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(health_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(reports_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(storage_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(health_report_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(report_center_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(exchange_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(entra_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(security_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(intune_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(compliance_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(sharepoint_router, prefix=settings.API_V1_PREFIX, dependencies=authz)
app.include_router(teams_router, prefix=settings.API_V1_PREFIX, dependencies=authz)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "api": settings.API_V1_PREFIX
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
