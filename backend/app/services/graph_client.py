"""
Microsoft Graph API Client
Handles authentication and API calls for multiple tenants.

Improvements over initial version:
- Exponential backoff retry on transient failures
- Connection pooling via a shared httpx.AsyncClient
- Structured logging
"""
import logging
import httpx
from msal import ConfidentialClientApplication
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import asyncio
import csv
import io

logger = logging.getLogger(__name__)


class GraphClientError(Exception):
    """Raised when Graph API returns an unrecoverable error."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class GraphClient:
    """Microsoft Graph API client for a specific tenant."""

    GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
    GRAPH_API_BETA = "https://graph.microsoft.com/beta"
    DEFAULT_SCOPES = ["https://graph.microsoft.com/.default"]

    # Retry configuration
    MAX_RETRIES = 3
    RETRY_BACKOFF_BASE = 1.0  # seconds
    RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
    REQUEST_TIMEOUT = 30.0

    # Shared connection pool (class-level, reused across all clients)
    _http_client: Optional[httpx.AsyncClient] = None

    @classmethod
    def _get_http_client(cls) -> httpx.AsyncClient:
        """Return a shared httpx.AsyncClient with connection pooling."""
        if cls._http_client is None or cls._http_client.is_closed:
            cls._http_client = httpx.AsyncClient(
                follow_redirects=True,
                timeout=cls.REQUEST_TIMEOUT,
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=20,
                    keepalive_expiry=120,
                ),
            )
        return cls._http_client

    @classmethod
    async def close_http_client(cls):
        """Shutdown the shared HTTP client (call on app shutdown)."""
        if cls._http_client and not cls._http_client.is_closed:
            await cls._http_client.aclose()
            cls._http_client = None

    def __init__(self, tenant_id: str, client_id: str, client_secret: str):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self._access_token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

        # Initialize MSAL app
        self._msal_app = ConfidentialClientApplication(
            client_id=client_id,
            client_credential=client_secret,
            authority=f"https://login.microsoftonline.com/{tenant_id}",
        )
        logger.debug("GraphClient initialized for tenant %s", tenant_id)

    async def _ensure_token(self) -> str:
        """Ensure we have a valid access token."""
        if self._access_token and self._token_expires and datetime.utcnow() < self._token_expires:
            return self._access_token

        logger.debug("Acquiring new token for tenant %s", self.tenant_id)
        result = self._msal_app.acquire_token_for_client(scopes=self.DEFAULT_SCOPES)

        if "access_token" in result:
            self._access_token = result["access_token"]
            # Token expires in ~1 hour, refresh 5 minutes early
            self._token_expires = datetime.utcnow() + timedelta(
                seconds=result.get("expires_in", 3600) - 300
            )
            logger.debug("Token acquired for tenant %s, expires at %s", self.tenant_id, self._token_expires)
            return self._access_token
        else:
            error = result.get("error_description", result.get("error", "Unknown error"))
            raise GraphClientError(f"Failed to acquire token for tenant {self.tenant_id}: {error}")

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        use_beta: bool = False,
    ) -> Dict[str, Any]:
        """Make an authenticated request to Graph API with retry logic."""
        token = await self._ensure_token()
        base_url = self.GRAPH_API_BETA if use_beta else self.GRAPH_API_BASE
        url = f"{base_url}{endpoint}"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        client = self._get_http_client()
        last_exc: Optional[Exception] = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=data,
                    params=params,
                )

                if response.status_code == 204:
                    return {}

                # Retry on transient / throttling errors
                if response.status_code in self.RETRY_STATUS_CODES:
                    # Respect Retry-After header if present
                    retry_after = response.headers.get("Retry-After")
                    if retry_after:
                        wait = float(retry_after)
                    else:
                        wait = self.RETRY_BACKOFF_BASE * (2 ** (attempt - 1))

                    logger.warning(
                        "Graph API %s %s returned %d (attempt %d/%d), retrying in %.1fs",
                        method, endpoint, response.status_code, attempt, self.MAX_RETRIES, wait,
                    )
                    if attempt < self.MAX_RETRIES:
                        await asyncio.sleep(wait)
                        # Refresh token on 401-like responses
                        if response.status_code in {401}:
                            self._access_token = None
                            token = await self._ensure_token()
                            headers["Authorization"] = f"Bearer {token}"
                        continue

                # Non-retryable HTTP error
                if response.status_code >= 400:
                    body_preview = response.text[:500] if response.text else ""
                    raise GraphClientError(
                        f"Graph API {method} {endpoint} returned {response.status_code}: {body_preview}",
                        status_code=response.status_code,
                    )

                # Reports API returns CSV after redirect
                content_type = response.headers.get("content-type", "")
                if "text/csv" in content_type or "application/octet-stream" in content_type:
                    return self._parse_csv(response.text)

                return response.json()

            except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as exc:
                last_exc = exc
                wait = self.RETRY_BACKOFF_BASE * (2 ** (attempt - 1))
                logger.warning(
                    "Graph API %s %s network error (attempt %d/%d): %s, retrying in %.1fs",
                    method, endpoint, attempt, self.MAX_RETRIES, exc, wait,
                )
                if attempt < self.MAX_RETRIES:
                    await asyncio.sleep(wait)
                    continue

        # All retries exhausted
        raise GraphClientError(
            f"Graph API {method} {endpoint} failed after {self.MAX_RETRIES} attempts: {last_exc}"
        )

    @staticmethod
    def _parse_csv(text: str) -> Dict[str, Any]:
        """Parse CSV report response into {value: [...]}."""
        reader = csv.DictReader(io.StringIO(text))
        rows = []
        for row in reader:
            clean = {}
            for k, v in row.items():
                key = k.lstrip("\ufeff").strip()
                clean[key] = v
            rows.append(clean)
        return {"value": rows}

    # ==================== HTTP Verbs ====================

    async def get(self, endpoint: str, params: Optional[Dict] = None, use_beta: bool = False) -> Dict[str, Any]:
        return await self._request("GET", endpoint, params=params, use_beta=use_beta)

    async def post(self, endpoint: str, data: Dict, use_beta: bool = False) -> Dict[str, Any]:
        return await self._request("POST", endpoint, data=data, use_beta=use_beta)

    async def patch(self, endpoint: str, data: Dict, use_beta: bool = False) -> Dict[str, Any]:
        return await self._request("PATCH", endpoint, data=data, use_beta=use_beta)

    async def delete(self, endpoint: str, use_beta: bool = False) -> Dict[str, Any]:
        return await self._request("DELETE", endpoint, use_beta=use_beta)

    # ==================== User Operations ====================

    async def get_users(self, top: int = 100, select: Optional[List[str]] = None) -> Dict[str, Any]:
        params: Dict[str, Any] = {"$top": top}
        if select:
            params["$select"] = ",".join(select)
        return await self.get("/users", params=params)

    async def get_user(self, user_id: str) -> Dict[str, Any]:
        return await self.get(f"/users/{user_id}")

    async def create_user(self, user_data: Dict) -> Dict[str, Any]:
        return await self.post("/users", data=user_data)

    async def update_user(self, user_id: str, user_data: Dict) -> Dict[str, Any]:
        return await self.patch(f"/users/{user_id}", data=user_data)

    async def delete_user(self, user_id: str) -> Dict[str, Any]:
        return await self.delete(f"/users/{user_id}")

    async def get_user_count(self) -> int:
        result = await self.get("/users/$count", params={"$top": 1})
        if isinstance(result, int):
            return result
        users = await self.get("/users", params={"$select": "id", "$top": 999})
        return len(users.get("value", []))

    # ==================== License Operations ====================

    async def get_subscribed_skus(self) -> Dict[str, Any]:
        return await self.get("/subscribedSkus")

    async def get_user_licenses(self, user_id: str) -> Dict[str, Any]:
        return await self.get(f"/users/{user_id}/licenseDetails")

    async def assign_license(self, user_id: str, sku_id: str) -> Dict[str, Any]:
        data = {"addLicenses": [{"skuId": sku_id}], "removeLicenses": []}
        return await self.post(f"/users/{user_id}/assignLicense", data=data)

    async def remove_license(self, user_id: str, sku_id: str) -> Dict[str, Any]:
        data = {"addLicenses": [], "removeLicenses": [sku_id]}
        return await self.post(f"/users/{user_id}/assignLicense", data=data)

    # ==================== Group Operations ====================

    async def get_groups(self, top: int = 100) -> Dict[str, Any]:
        return await self.get("/groups", params={"$top": top})

    async def get_group(self, group_id: str) -> Dict[str, Any]:
        return await self.get(f"/groups/{group_id}")

    async def get_group_members(self, group_id: str) -> Dict[str, Any]:
        return await self.get(f"/groups/{group_id}/members")

    async def create_group(self, group_data: Dict) -> Dict[str, Any]:
        return await self.post("/groups", data=group_data)

    # ==================== Domain Operations ====================

    async def get_domains(self) -> Dict[str, Any]:
        return await self.get("/domains")

    async def get_domain(self, domain_id: str) -> Dict[str, Any]:
        return await self.get(f"/domains/{domain_id}")

    # ==================== Directory Roles ====================

    async def get_directory_roles(self) -> Dict[str, Any]:
        return await self.get("/directoryRoles")

    async def get_role_members(self, role_id: str) -> Dict[str, Any]:
        return await self.get(f"/directoryRoles/{role_id}/members")

    # ==================== Service Health ====================

    async def get_service_health(self) -> Dict[str, Any]:
        return await self.get("/admin/serviceAnnouncement/healthOverviews", use_beta=True)

    async def get_service_issues(self) -> Dict[str, Any]:
        return await self.get("/admin/serviceAnnouncement/issues", use_beta=True)

    # ==================== Audit Logs ====================

    async def get_sign_ins(self, top: int = 100) -> Dict[str, Any]:
        return await self.get("/auditLogs/signIns", params={"$top": top}, use_beta=True)

    async def get_directory_audits(self, top: int = 100) -> Dict[str, Any]:
        return await self.get("/auditLogs/directoryAudits", params={"$top": top}, use_beta=True)

    # ==================== Organization Info ====================

    async def get_organization(self) -> Dict[str, Any]:
        return await self.get("/organization")

    async def get_tenant_summary(self) -> Dict[str, Any]:
        """Get a summary of tenant information (users + licenses + org)."""
        org, users, skus = await asyncio.gather(
            self.get_organization(),
            self.get_users(top=999, select=["id", "accountEnabled"]),
            self.get_subscribed_skus(),
        )

        org_info = org.get("value", [{}])[0] if org.get("value") else {}
        user_list = users.get("value", [])
        sku_list = skus.get("value", [])

        total_licenses = sum(sku.get("prepaidUnits", {}).get("enabled", 0) for sku in sku_list)
        consumed_licenses = sum(sku.get("consumedUnits", 0) for sku in sku_list)

        return {
            "displayName": org_info.get("displayName", "Unknown"),
            "tenantId": self.tenant_id,
            "verifiedDomains": org_info.get("verifiedDomains", []),
            "userCount": len(user_list),
            "activeUsers": len([u for u in user_list if u.get("accountEnabled", False)]),
            "totalLicenses": total_licenses,
            "consumedLicenses": consumed_licenses,
            "licenseUsagePercent": round(consumed_licenses / total_licenses * 100, 1) if total_licenses > 0 else 0,
        }

    # ==================== Health Report ====================

    async def get_m365_active_user_detail(self, period: str = "D30") -> Dict[str, Any]:
        return await self.get(f"/reports/getOffice365ActiveUserDetail(period='{period}')")

    async def get_mailbox_usage_detail(self, period: str = "D30") -> Dict[str, Any]:
        return await self.get(f"/reports/getMailboxUsageDetail(period='{period}')")

    async def get_credential_user_registration(self) -> Dict[str, Any]:
        return await self.get("/reports/authenticationMethods/userRegistrationDetails")

    async def get_risky_users(self, top: int = 50) -> Dict[str, Any]:
        return await self.get(
            "/identityProtection/riskyUsers",
            params={"$top": top, "$orderby": "riskLastUpdatedDateTime desc"},
        )

    async def get_risk_detections(self, top: int = 50) -> Dict[str, Any]:
        return await self.get(
            "/identityProtection/riskDetections",
            params={"$top": top, "$orderby": "detectedDateTime desc"},
        )

    async def get_secure_scores(self, top: int = 1) -> Dict[str, Any]:
        return await self.get("/security/secureScores", params={"$top": top})


class GraphClientManager:
    """Manager for multiple Graph API clients (one per tenant)."""

    def __init__(self):
        self._clients: Dict[str, GraphClient] = {}

    def get_client(self, tenant_id: str, client_id: str, client_secret: str) -> GraphClient:
        """Get or create a Graph client for the specified tenant."""
        if tenant_id not in self._clients:
            self._clients[tenant_id] = GraphClient(tenant_id, client_id, client_secret)
        return self._clients[tenant_id]

    def remove_client(self, tenant_id: str):
        """Remove a client from the cache."""
        self._clients.pop(tenant_id, None)

    def clear_all(self):
        """Clear all cached clients."""
        self._clients.clear()


# Global client manager instance
graph_manager = GraphClientManager()
