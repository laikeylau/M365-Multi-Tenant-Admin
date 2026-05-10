"""
Service for auto-registering Azure AD applications with required permissions.
Uses Microsoft Graph API to:
1. Look up Microsoft Graph service principal and its app roles
2. Create an app registration with required permissions
3. Create a service principal for the app
4. Create a client secret
5. Grant admin consent
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional

import httpx

logger = logging.getLogger(__name__)

GRAPH_APP_ID = "00000003-0000-0000-c000-000000000000"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# Application permissions (type="Role") required by the M365 Admin Platform
REQUIRED_PERMISSIONS = [
    "User.ReadWrite.All",
    "Directory.ReadWrite.All",
    "Organization.Read.All",
    "Reports.Read.All",
    "Group.ReadWrite.All",
    "Domain.Read.All",
    "AuditLog.Read.All",
    "SecurityEvents.ReadWrite.All",
    "DeviceManagementManagedDevices.Read.All",
    "DeviceManagementConfiguration.Read.All",
    "Team.ReadBasic.All",
    "TeamSettings.ReadWrite.All",
    "Channel.ReadBasic.All",
    "Sites.ReadWrite.All",
    "MailboxSettings.ReadWrite",
    "InformationProtectionPolicy.Read.All",
    "Application.Read.All",
    "Policy.Read.All",
    "ServiceHealth.Read.All",
    "IdentityRiskEvent.Read.All",
    "AppRoleAssignment.ReadWrite.All",
]


async def _graph_request(
    token: str, method: str, url: str, json_data: Optional[dict] = None
) -> dict:
    """Make an authenticated Graph API request."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(method, url, headers=headers, json=json_data)
        if resp.status_code >= 400:
            raise Exception(
                f"Graph API {method} {url} returned {resp.status_code}: {resp.text[:500]}"
            )
        if resp.status_code == 204:
            return {}
        return resp.json()


async def get_graph_sp_and_roles(token: str) -> Tuple[str, Dict[str, dict]]:
    """
    Get the Microsoft Graph service principal ID and its app role mapping.
    Returns: (graph_sp_id, { "permission_name": {"id": role_id, "displayName": ...}, ... })
    """
    data = await _graph_request(
        token,
        "GET",
        f"{GRAPH_BASE}/servicePrincipals?$filter=appId eq '{GRAPH_APP_ID}'&$select=id,appRoles",
    )
    sps = data.get("value", [])
    if not sps:
        raise Exception("Microsoft Graph service principal not found in tenant")

    graph_sp_id = sps[0]["id"]
    app_roles = sps[0].get("appRoles", [])

    role_map = {}
    for role in app_roles:
        if role.get("isEnabled"):
            role_map[role["value"]] = {
                "id": role["id"],
                "displayName": role.get("displayName", role["value"]),
            }

    return graph_sp_id, role_map


async def create_app_registration(
    token: str, display_name: str, required_perms: List[str]
) -> dict:
    """
    Create an Azure AD app registration with the required application permissions.
    Returns the created application object.
    """
    # 1. Look up Graph SP and roles
    graph_sp_id, role_map = await get_graph_sp_and_roles(token)

    # 2. Build requiredResourceAccess
    resource_access = []
    resolved = []
    missing = []
    for perm_name in required_perms:
        if perm_name in role_map:
            resource_access.append(
                {"id": role_map[perm_name]["id"], "type": "Role"}
            )
            resolved.append(perm_name)
        else:
            missing.append(perm_name)
            logger.warning("Permission not found in Graph appRoles: %s", perm_name)

    if missing:
        logger.warning("Missing permissions: %s", missing)

    # 3. Create the app registration
    app_data = {
        "displayName": display_name,
        "signInAudience": "AzureADMyOrg",
        "requiredResourceAccess": [
            {
                "resourceAppId": GRAPH_APP_ID,
                "resourceAccess": resource_access,
            }
        ],
    }

    app = await _graph_request(token, "POST", f"{GRAPH_BASE}/applications", app_data)
    app_id = app["id"]
    app_client_id = app["appId"]

    logger.info("Created app registration: %s (appId=%s)", display_name, app_client_id)

    # 4. Create service principal for the app
    sp_data = {"appId": app_client_id, "accountEnabled": True}
    sp = await _graph_request(
        token, "POST", f"{GRAPH_BASE}/servicePrincipals", sp_data
    )
    sp_id = sp["id"]

    logger.info("Created service principal: %s", sp_id)

    # 5. Create client secret (expires in 2 years)
    secret_data = {
        "passwordCredential": {
            "displayName": f"M365 Admin Platform - {datetime.utcnow().strftime('%Y%m%d')}",
            "endDateTime": (datetime.utcnow() + timedelta(days=730)).isoformat() + "Z",
        }
    }
    secret_result = await _graph_request(
        token,
        "POST",
        f"{GRAPH_BASE}/applications/{app_id}/addPassword",
        secret_data,
    )
    client_secret = secret_result.get("secretText", "")

    logger.info("Created client secret for app %s", app_client_id)

    # 6. Grant admin consent for each permission
    consent_errors = []
    for perm_name in resolved:
        if perm_name not in role_map:
            continue
        try:
            assignment_data = {
                "principalId": sp_id,
                "resourceId": graph_sp_id,
                "appRoleId": role_map[perm_name]["id"],
            }
            await _graph_request(
                token,
                "POST",
                f"{GRAPH_BASE}/servicePrincipals/{sp_id}/appRoleAssignments",
                assignment_data,
            )
            logger.info("Granted admin consent: %s", perm_name)
        except Exception as e:
            consent_errors.append(f"{perm_name}: {e}")
            logger.warning("Failed to grant consent for %s: %s", perm_name, e)

    # 7. Get tenant ID from the organization
    org_data = await _graph_request(token, "GET", f"{GRAPH_BASE}/organization")
    orgs = org_data.get("value", [])
    tenant_id = orgs[0].get("id", "") if orgs else ""
    tenant_name = orgs[0].get("displayName", "") if orgs else ""

    return {
        "appId": app_client_id,
        "appObjectId": app_id,
        "servicePrincipalId": sp_id,
        "clientSecret": client_secret,
        "tenantId": tenant_id,
        "tenantDisplayName": tenant_name,
        "displayName": display_name,
        "resolvedPermissions": resolved,
        "missingPermissions": missing,
        "consentErrors": consent_errors,
    }


# Delegated scopes needed for the auto-register flow (device code flow)
DEVICE_CODE_SCOPES = [
    "Application.ReadWrite.All",
    "AppRoleAssignment.ReadWrite.All",
    "Directory.ReadWrite.All",
]
