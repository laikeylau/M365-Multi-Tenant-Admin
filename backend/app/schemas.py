"""
Pydantic schemas for API request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ==================== Tenant Schemas ====================

class TenantBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    tenant_id: str = Field(..., pattern=r'^[a-f0-9-]{36}$')
    client_id: str = Field(..., pattern=r'^[a-f0-9-]{36}$')
    domain: Optional[str] = None


class TenantCreate(TenantBase):
    client_secret: str = Field(..., min_length=1)


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    client_secret: Optional[str] = None
    domain: Optional[str] = None
    is_active: Optional[bool] = None


class TenantResponse(TenantBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TenantSummary(BaseModel):
    """Summary information for a tenant"""
    id: int
    name: str
    tenant_id: str
    display_name: Optional[str] = None
    user_count: int = 0
    active_users: int = 0
    total_licenses: int = 0
    consumed_licenses: int = 0
    license_usage_percent: float = 0.0
    is_connected: bool = False
    error: Optional[str] = None


# ==================== User Schemas ====================

class M365UserBase(BaseModel):
    display_name: str = Field(..., alias="displayName")
    user_principal_name: str = Field(..., alias="userPrincipalName")
    mail: Optional[str] = None
    
    class Config:
        populate_by_name = True


class M365UserCreate(BaseModel):
    display_name: str = Field(..., alias="displayName")
    user_principal_name: str = Field(..., alias="userPrincipalName")
    mail_nickname: str = Field(..., alias="mailNickname")
    password: str
    force_change_password: bool = Field(True, alias="forceChangePasswordNextSignIn")
    
    class Config:
        populate_by_name = True
    
    def to_graph_format(self) -> Dict[str, Any]:
        return {
            "accountEnabled": True,
            "displayName": self.display_name,
            "mailNickname": self.mail_nickname,
            "userPrincipalName": self.user_principal_name,
            "passwordProfile": {
                "forceChangePasswordNextSignIn": self.force_change_password,
                "password": self.password
            }
        }


class M365UserResponse(BaseModel):
    id: str
    display_name: Optional[str] = Field(None, alias="displayName")
    user_principal_name: Optional[str] = Field(None, alias="userPrincipalName")
    mail: Optional[str] = None
    account_enabled: Optional[bool] = Field(None, alias="accountEnabled")
    created_datetime: Optional[str] = Field(None, alias="createdDateTime")
    job_title: Optional[str] = Field(None, alias="jobTitle")
    department: Optional[str] = None
    
    class Config:
        populate_by_name = True


class UserInvitation(BaseModel):
    email: EmailStr
    redirect_url: str = "https://myapps.microsoft.com"
    send_invitation_message: bool = True
    
    def to_graph_format(self) -> Dict[str, Any]:
        return {
            "invitedUserEmailAddress": self.email,
            "inviteRedirectUrl": self.redirect_url,
            "sendInvitationMessage": self.send_invitation_message
        }


# ==================== License Schemas ====================

class LicenseInfo(BaseModel):
    sku_id: str = Field(..., alias="skuId")
    sku_part_number: str = Field(..., alias="skuPartNumber")
    consumed_units: int = Field(0, alias="consumedUnits")
    enabled_units: int = 0
    suspended_units: int = 0
    warning_units: int = 0
    
    class Config:
        populate_by_name = True


class LicenseAssignment(BaseModel):
    user_id: str
    sku_id: str


# ==================== Group Schemas ====================

class GroupResponse(BaseModel):
    id: str
    display_name: Optional[str] = Field(None, alias="displayName")
    description: Optional[str] = None
    mail: Optional[str] = None
    mail_enabled: Optional[bool] = Field(None, alias="mailEnabled")
    security_enabled: Optional[bool] = Field(None, alias="securityEnabled")
    group_types: Optional[List[str]] = Field(None, alias="groupTypes")
    
    class Config:
        populate_by_name = True


class GroupCreate(BaseModel):
    display_name: str = Field(..., alias="displayName")
    description: Optional[str] = None
    mail_enabled: bool = Field(False, alias="mailEnabled")
    mail_nickname: str = Field(..., alias="mailNickname")
    security_enabled: bool = Field(True, alias="securityEnabled")
    
    class Config:
        populate_by_name = True
    
    def to_graph_format(self) -> Dict[str, Any]:
        return {
            "displayName": self.display_name,
            "description": self.description,
            "mailEnabled": self.mail_enabled,
            "mailNickname": self.mail_nickname,
            "securityEnabled": self.security_enabled
        }


# ==================== Domain Schemas ====================

class DomainResponse(BaseModel):
    id: str
    is_default: Optional[bool] = Field(None, alias="isDefault")
    is_verified: Optional[bool] = Field(None, alias="isVerified")
    is_initial: Optional[bool] = Field(None, alias="isInitial")
    
    class Config:
        populate_by_name = True


# ==================== Service Health Schemas ====================

class ServiceHealthResponse(BaseModel):
    id: str
    service: str
    status: str


# ==================== Dashboard Schemas ====================

class DashboardStats(BaseModel):
    total_tenants: int = 0
    connected_tenants: int = 0
    error_tenants: int = 0
    total_users: int = 0
    active_users: int = 0
    total_licenses: int = 0
    consumed_licenses: int = 0
    license_usage_percent: float = 0.0
    last_updated: datetime


class TenantStats(BaseModel):
    tenant_id: int
    name: str
    user_count: int = 0
    license_count: int = 0
    is_connected: bool = False
    status: str = "unknown"


# ==================== Auth Schemas ====================

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None


class LocalUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)


class LocalUserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Common Schemas ====================

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int = 1
    page_size: int = 20
    has_next: bool = False


class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
