"""
Auto-register router — Device Code Flow for automated Azure AD app registration.

Flow:
1. POST /auto-register/start  → Initiates device code flow, returns user_code + verification_uri
2. GET  /auto-register/status/{flow_id} → Polls status; on success, creates the app registration
"""
import logging
import threading
import uuid
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException
from msal import PublicClientApplication

from app.services.app_registration import (
    DEVICE_CODE_SCOPES,
    REQUIRED_PERMISSIONS,
    create_app_registration,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auto-register", tags=["Auto Register"])

# Well-known Azure PowerShell public client app (supports device code flow)
AZURE_POWERSHELL_APP_ID = "1950a258-227b-4e31-a9cf-717495945fc2"
AUTHORITY = "https://login.microsoftonline.com/common"

# In-memory store for active device code flows
_active_flows: Dict[str, dict] = {}


def _poll_device_code(flow_id: str):
    """
    Background thread: blocks until the user completes login or the flow expires.
    MSAL's acquire_token_by_device_flow handles polling internally.
    """
    data = _active_flows.get(flow_id)
    if not data:
        return
    try:
        result = data["msal_app"].acquire_token_by_device_flow(
            data["flow"],
            scopes=DEVICE_CODE_SCOPES,
        )
        if "access_token" in result:
            data["status"] = "authenticated"
            data["token"] = result["access_token"]
            logger.info("Device code flow %s: user authenticated", flow_id)
        else:
            data["status"] = "error"
            data["error"] = result.get(
                "error_description",
                result.get("error", "Authentication failed"),
            )
            logger.warning("Device code flow %s failed: %s", flow_id, data["error"])
    except Exception as e:
        data["status"] = "error"
        data["error"] = str(e)
        logger.exception("Device code flow %s exception", flow_id)


@router.post("/start")
async def start_auto_register():
    """
    Start the device code flow for auto-registration.
    Returns the user_code and verification_uri for the user to complete login.
    """
    flow_id = str(uuid.uuid4())

    msal_app = PublicClientApplication(
        client_id=AZURE_POWERSHELL_APP_ID,
        authority=AUTHORITY,
    )

    flow = msal_app.initiate_device_flow(scopes=DEVICE_CODE_SCOPES)

    if "user_code" not in flow:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initiate device code flow: {flow.get('error_description', 'Unknown error')}",
        )

    _active_flows[flow_id] = {
        "msal_app": msal_app,
        "flow": flow,
        "status": "pending",  # pending → authenticated → creating → done → error
        "token": None,
        "result": None,
        "error": None,
    }

    # Start background thread to poll for authentication
    thread = threading.Thread(target=_poll_device_code, args=(flow_id,), daemon=True)
    thread.start()

    return {
        "flow_id": flow_id,
        "user_code": flow["user_code"],
        "verification_uri": flow["verification_uri"],
        "expires_in": flow.get("expires_in", 900),
        "interval": flow.get("interval", 5),
        "message": flow.get("message", ""),
    }


@router.get("/status/{flow_id}")
async def check_auto_register_status(flow_id: str, app_name: str = "M365 Multi-Tenant Admin"):
    """
    Check the status of an auto-register flow.
    When authenticated, triggers the app registration creation.
    """
    data = _active_flows.get(flow_id)
    if not data:
        raise HTTPException(status_code=404, detail="Flow not found or expired")

    status = data["status"]

    if status == "pending":
        return {"status": "pending", "message": "Waiting for user to authenticate..."}

    if status == "error":
        error = data["error"]
        _active_flows.pop(flow_id, None)
        return {"status": "error", "error": error}

    if status == "authenticated":
        # User has authenticated — now create the app registration
        data["status"] = "creating"
        try:
            result = await create_app_registration(
                token=data["token"],
                display_name=app_name,
                required_perms=REQUIRED_PERMISSIONS,
            )
            data["status"] = "done"
            data["result"] = result
            _active_flows.pop(flow_id, None)
            return {"status": "success", "app": result}
        except Exception as e:
            data["status"] = "error"
            data["error"] = str(e)
            _active_flows.pop(flow_id, None)
            logger.exception("App registration creation failed for flow %s", flow_id)
            return {"status": "error", "error": str(e)}

    if status == "creating":
        return {"status": "creating", "message": "Creating app registration and assigning permissions..."}

    if status == "done":
        result = data["result"]
        _active_flows.pop(flow_id, None)
        return {"status": "success", "app": result}

    return {"status": "error", "error": "Unknown status"}


@router.delete("/cancel/{flow_id}")
async def cancel_auto_register(flow_id: str):
    """Cancel an active auto-register flow."""
    _active_flows.pop(flow_id, None)
    return {"status": "cancelled"}
