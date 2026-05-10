"""
Microsoft Graph API Client
Handles authentication and API calls for multiple tenants
"""
import httpx
from msal import ConfidentialClientApplication
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import asyncio
from functools import lru_cache


class GraphClient:
    """Microsoft Graph API client for a specific tenant"""
    
    GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
    GRAPH_API_BETA = "https://graph.microsoft.com/beta"
    
    DEFAULT_SCOPES = ["https://graph.microsoft.com/.default"]
    
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
            authority=f"https://login.microsoftonline.com/{tenant_id}"
        )
    
    async def _ensure_token(self) -> str:
        """Ensure we have a valid access token"""
        if self._access_token and self._token_expires and datetime.utcnow() < self._token_expires:
            return self._access_token
        
        # Acquire new token
        result = self._msal_app.acquire_token_for_client(scopes=self.DEFAULT_SCOPES)
        
        if "access_token" in result:
            self._access_token = result["access_token"]
            # Token expires in ~1 hour, refresh 5 minutes early
            self._token_expires = datetime.utcnow() + timedelta(seconds=result.get("expires_in", 3600) - 300)
            return self._access_token
        else:
            error = result.get("error_description", result.get("error", "Unknown error"))
            raise Exception(f"Failed to acquire token: {error}")
    
    async def _request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        use_beta: bool = False
    ) -> Dict[str, Any]:
        """Make an authenticated request to Graph API"""
        token = await self._ensure_token()
        base_url = self.GRAPH_API_BETA if use_beta else self.GRAPH_API_BASE
        url = f"{base_url}{endpoint}"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=data,
                params=params,
                timeout=30.0
            )
            
            if response.status_code == 204:
                return {}
            
            response.raise_for_status()
            
            # Reports API returns CSV after redirect
            content_type = response.headers.get("content-type", "")
            if "text/csv" in content_type or "application/octet-stream" in content_type:
                return self._parse_csv(response.text)
            
            return response.json()

    @staticmethod
    def _parse_csv(text: str) -> Dict[str, Any]:
        """Parse CSV report response into {value: [...]}"""
        import csv, io
        reader = csv.DictReader(io.StringIO(text))
        # Remove BOM from first header if present
        rows = []
        for row in reader:
            clean = {}
            for k, v in row.items():
                key = k.lstrip('\ufeff').strip()
                clean[key] = v
            rows.append(clean)
        return {"value": rows}
    
    async def get(self, endpoint: str, params: Optional[Dict] = None, use_beta: bool = False) -> Dict[str, Any]:
        """GET request to Graph API"""
        return await self._request("GET", endpoint, params=params, use_beta=use_beta)
    
    async def post(self, endpoint: str, data: Dict, use_beta: bool = False) -> Dict[str, Any]:
        """POST request to Graph API"""
        return await self._request("POST", endpoint, data=data, use_beta=use_beta)
    
    async def patch(self, endpoint: str, data: Dict, use_beta: bool = False) -> Dict[str, Any]:
        """PATCH request to Graph API"""
        return await self._request("PATCH", endpoint, data=data, use_beta=use_beta)
    
    async def delete(self, endpoint: str, use_beta: bool = False) -> Dict[str, Any]:
        """DELETE request to Graph API"""
        return await self._request("DELETE", endpoint, use_beta=use_beta)
    
    # ==================== User Operations ====================
    
    async def get_users(self, top: int = 100, select: Optional[List[str]] = None) -> Dict[str, Any]:
        """Get list of users"""
        params = {"$top": top}
        if select:
            params["$select"] = ",".join(select)
        return await self.get("/users", params=params)
    
    async def get_user(self, user_id: str) -> Dict[str, Any]:
        """Get a specific user"""
        return await self.get(f"/users/{user_id}")
    
    async def create_user(self, user_data: Dict) -> Dict[str, Any]:
        """Create a new user"""
        return await self.post("/users", data=user_data)
    
    async def update_user(self, user_id: str, user_data: Dict) -> Dict[str, Any]:
        """Update a user"""
        return await self.patch(f"/users/{user_id}", data=user_data)
    
    async def delete_user(self, user_id: str) -> Dict[str, Any]:
        """Delete a user"""
        return await self.delete(f"/users/{user_id}")
    
    async def get_user_count(self) -> int:
        """Get total user count"""
        result = await self.get("/users/$count", params={"$top": 1})
        # If $count endpoint doesn't work, fall back to counting
        if isinstance(result, int):
            return result
        users = await self.get("/users", params={"$select": "id", "$top": 999})
        return len(users.get("value", []))
    
    # ==================== License Operations ====================
    
    async def get_subscribed_skus(self) -> Dict[str, Any]:
        """Get all subscribed SKUs (licenses)"""
        return await self.get("/subscribedSkus")
    
    async def get_user_licenses(self, user_id: str) -> Dict[str, Any]:
        """Get licenses assigned to a user"""
        return await self.get(f"/users/{user_id}/licenseDetails")
    
    async def assign_license(self, user_id: str, sku_id: str) -> Dict[str, Any]:
        """Assign a license to a user"""
        data = {
            "addLicenses": [{"skuId": sku_id}],
            "removeLicenses": []
        }
        return await self.post(f"/users/{user_id}/assignLicense", data=data)
    
    async def remove_license(self, user_id: str, sku_id: str) -> Dict[str, Any]:
        """Remove a license from a user"""
        data = {
            "addLicenses": [],
            "removeLicenses": [sku_id]
        }
        return await self.post(f"/users/{user_id}/assignLicense", data=data)
    
    # ==================== Group Operations ====================
    
    async def get_groups(self, top: int = 100) -> Dict[str, Any]:
        """Get list of groups"""
        return await self.get("/groups", params={"$top": top})
    
    async def get_group(self, group_id: str) -> Dict[str, Any]:
        """Get a specific group"""
        return await self.get(f"/groups/{group_id}")
    
    async def get_group_members(self, group_id: str) -> Dict[str, Any]:
        """Get members of a group"""
        return await self.get(f"/groups/{group_id}/members")
    
    async def create_group(self, group_data: Dict) -> Dict[str, Any]:
        """Create a new group"""
        return await self.post("/groups", data=group_data)
    
    # ==================== Domain Operations ====================
    
    async def get_domains(self) -> Dict[str, Any]:
        """Get list of domains"""
        return await self.get("/domains")
    
    async def get_domain(self, domain_id: str) -> Dict[str, Any]:
        """Get a specific domain"""
        return await self.get(f"/domains/{domain_id}")
    
    # ==================== Directory Roles ====================
    
    async def get_directory_roles(self) -> Dict[str, Any]:
        """Get directory roles"""
        return await self.get("/directoryRoles")
    
    async def get_role_members(self, role_id: str) -> Dict[str, Any]:
        """Get members of a directory role"""
        return await self.get(f"/directoryRoles/{role_id}/members")
    
    # ==================== Service Health ====================
    
    async def get_service_health(self) -> Dict[str, Any]:
        """Get service health status"""
        return await self.get("/admin/serviceAnnouncement/healthOverviews", use_beta=True)
    
    async def get_service_issues(self) -> Dict[str, Any]:
        """Get current service issues"""
        return await self.get("/admin/serviceAnnouncement/issues", use_beta=True)
    
    # ==================== Audit Logs ====================
    
    async def get_sign_ins(self, top: int = 100) -> Dict[str, Any]:
        """Get sign-in logs"""
        return await self.get("/auditLogs/signIns", params={"$top": top}, use_beta=True)
    
    async def get_directory_audits(self, top: int = 100) -> Dict[str, Any]:
        """Get directory audit logs"""
        return await self.get("/auditLogs/directoryAudits", params={"$top": top}, use_beta=True)
    
    # ==================== Organization Info ====================
    
    async def get_organization(self) -> Dict[str, Any]:
        """Get organization information"""
        return await self.get("/organization")
    
    async def get_tenant_summary(self) -> Dict[str, Any]:
        """Get a summary of tenant information"""
        org = await self.get_organization()
        users = await self.get_users(top=999, select=["id", "accountEnabled"])
        skus = await self.get_subscribed_skus()
        
        org_info = org.get("value", [{}])[0] if org.get("value") else {}
        user_list = users.get("value", [])
        sku_list = skus.get("value", [])
        
        # Calculate license totals
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
            "licenseUsagePercent": round(consumed_licenses / total_licenses * 100, 1) if total_licenses > 0 else 0
        }

    # ==================== Health Report ====================

    async def get_m365_active_user_detail(self, period: str = "D30") -> Dict[str, Any]:
        """Get Office 365 active user detail for the given period"""
        return await self.get(f"/reports/getOffice365ActiveUserDetail(period='{period}')")

    async def get_mailbox_usage_detail(self, period: str = "D30") -> Dict[str, Any]:
        """Get mailbox usage detail for the given period"""
        return await self.get(f"/reports/getMailboxUsageDetail(period='{period}')")

    async def get_credential_user_registration(self) -> Dict[str, Any]:
        """Get MFA / authentication methods user registration details (v1.0)"""
        return await self.get("/reports/authenticationMethods/userRegistrationDetails")

    async def get_risky_users(self, top: int = 50) -> Dict[str, Any]:
        """Get risky users from Identity Protection"""
        return await self.get("/identityProtection/riskyUsers",
                              params={"$top": top, "$orderby": "riskLastUpdatedDateTime desc"})

    async def get_risk_detections(self, top: int = 50) -> Dict[str, Any]:
        """Get risk detections from Identity Protection"""
        return await self.get("/identityProtection/riskDetections",
                              params={"$top": top, "$orderby": "detectedDateTime desc"})

    async def get_secure_scores(self, top: int = 1) -> Dict[str, Any]:
        """Get Secure Score (latest)"""
        return await self.get("/security/secureScores",
                              params={"$top": top})



class GraphClientManager:
    """Manager for multiple Graph API clients"""
    
    def __init__(self):
        self._clients: Dict[str, GraphClient] = {}
    
    def get_client(self, tenant_id: str, client_id: str, client_secret: str) -> GraphClient:
        """Get or create a Graph client for the specified tenant"""
        if tenant_id not in self._clients:
            self._clients[tenant_id] = GraphClient(tenant_id, client_id, client_secret)
        return self._clients[tenant_id]
    
    def remove_client(self, tenant_id: str):
        """Remove a client from the cache"""
        if tenant_id in self._clients:
            del self._clients[tenant_id]
    
    def clear_all(self):
        """Clear all cached clients"""
        self._clients.clear()


# Global client manager instance
graph_manager = GraphClientManager()
