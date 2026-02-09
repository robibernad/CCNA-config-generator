"""Device operation API routes"""
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from typing import Optional
from pydantic import BaseModel, Field

from app.core.config import settings
from app.sessions.models import Session, DeviceCredentials
from app.api.routes.session import get_session_from_header
from app.devices.models import ExecuteCommandRequest, ExecuteCommandResponse, ApplyConfigRequest, ApplyConfigResponse
from app.devices.connector import DeviceConnector

router = APIRouter(prefix="/devices", tags=["devices"])


def get_device_credentials(
    per_device_creds: Optional[DeviceCredentials],
    session: Session
) -> DeviceCredentials:
    """Get credentials with per-device override fallback to session credentials"""
    credentials = per_device_creds or session.device_credentials

    if not credentials:
        raise HTTPException(
            status_code=400,
            detail="Device credentials required. Please provide credentials for this device."
        )

    return credentials


@router.post("/{device_id}/execute", response_model=ExecuteCommandResponse)
async def execute_command(
    device_id: str,
    request: ExecuteCommandRequest,
    session: Session = Depends(get_session_from_header)
):
    """Execute a show command on device"""
    if settings.MOCK_MODE:
        from app.mocks.gns3_data import get_mock_show_output
        return ExecuteCommandResponse(
            ok=True,
            output=get_mock_show_output(request.command)
        )

    # Get device info from GNS3
    from app.gns3.client import GNS3Client
    from app.mocks.gns3_data import get_mock_inventory

    # For now, use mock to get device info
    inventory = get_mock_inventory("proj-001")
    device = next((d for d in inventory.devices if d.node_id == device_id), None)

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Get credentials with per-device override
    credentials = get_device_credentials(request.device_credentials, session)

    connector = DeviceConnector(
        host=device.console_host or "127.0.0.1",
        port=device.console_port or 5000,
        credentials=credentials
    )

    return await connector.execute_command(request.command)


class ShowRunningConfigRequest(BaseModel):
    """Request to get running configuration"""
    device_credentials: Optional[DeviceCredentials] = Field(None, alias="deviceCredentials")

    class Config:
        populate_by_name = True


@router.post("/{device_id}/show-running-config", response_model=ExecuteCommandResponse)
async def show_running_config(
    device_id: str,
    project_id: str,
    request: ShowRunningConfigRequest,
    session: Session = Depends(get_session_from_header)
):
    """Get the running configuration from device"""
    if settings.MOCK_MODE:
        # Mock running config for testing
        mock_config = """Building configuration...

Current configuration : 2547 bytes
!
version 15.2
service timestamps debug datetime msec
service timestamps log datetime msec
!
hostname R1
!
boot-start-marker
boot-end-marker
!
enable secret 5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m0
!
no aaa new-model
no ip domain lookup
ip cef
!
interface GigabitEthernet0/0
 ip address 192.168.1.1 255.255.255.0
 duplex auto
 speed auto
!
interface GigabitEthernet0/1
 ip address 10.0.0.1 255.255.255.252
 duplex auto
 speed auto
!
router ospf 1
 router-id 1.1.1.1
 network 192.168.1.0 0.0.0.255 area 0
 network 10.0.0.0 0.0.0.3 area 0
!
ip forward-protocol nd
!
no ip http server
no ip http secure-server
!
line con 0
 logging synchronous
 exec-timeout 0 0
line vty 0 4
 password cisco
 login
 transport input ssh
!
end"""
        return ExecuteCommandResponse(
            ok=True,
            output=mock_config
        )

    # Get device info from real GNS3 server
    from app.gns3.client import GNS3Client

    def _auth_to_dict(auth_obj):
        if not auth_obj:
            return None
        if hasattr(auth_obj, "model_dump"):
            return auth_obj.model_dump()
        if hasattr(auth_obj, "dict"):
            return auth_obj.dict()
        return None

    try:
        auth = _auth_to_dict(session.gns3_auth)
        client = GNS3Client(session.server_url, auth)
        inventory = await client.get_project_inventory(project_id)

        device = next((d for d in inventory.devices if d.node_id == device_id), None)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found in project inventory")

        # Check if device is running
        if device.status != "started":
            raise HTTPException(status_code=400, detail=f"Device is not running (status: {device.status})")

        # Get console host and port
        # Note: GNS3 may return console_host as "0.0.0.0" which means listening on all interfaces
        # When connecting, we need to use the actual server IP or localhost
        console_host = device.console_host
        if not console_host or console_host == "0.0.0.0":
            # Extract hostname from server_url
            from urllib.parse import urlparse
            parsed = urlparse(session.server_url)
            console_host = parsed.hostname or "127.0.0.1"

        console_port = device.console_port
        if not console_port:
            raise HTTPException(status_code=400, detail="Device has no console port configured")

        logger.info(f"Connecting to device {device.name} at {console_host}:{console_port}")

        # Get credentials with per-device override
        credentials = get_device_credentials(request.device_credentials, session)

        connector = DeviceConnector(
            host=console_host,
            port=console_port,
            credentials=credentials
        )

        result = await connector.execute_command("show running-config")

        # If the connector returned an error, raise HTTP exception
        if not result.ok:
            logger.error(f"Device command failed: {result.error}")
            raise HTTPException(status_code=502, detail=result.error or "Failed to execute command on device")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Show running config failed: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to get running config: {str(e)}")


@router.post("/{device_id}/apply", response_model=ApplyConfigResponse)
async def apply_config(
    device_id: str,
    request: ApplyConfigRequest,
    session: Session = Depends(get_session_from_header)
):
    """Apply configuration to device"""
    if settings.MOCK_MODE:
        return ApplyConfigResponse(
            ok=True,
            log=[
                "Connected to device (Mock Mode)",
                "Entering configuration mode",
                *[f"  {cmd}" for cmd in request.commands[:5]],
                "..." if len(request.commands) > 5 else "",
                "Configuration applied successfully",
                "Configuration saved" if request.save_config else "Configuration NOT saved"
            ],
            warnings=[],
            errors=[]
        )
    
    # Get device info and apply
    from app.mocks.gns3_data import get_mock_inventory
    inventory = get_mock_inventory("proj-001")
    device = next((d for d in inventory.devices if d.node_id == device_id), None)

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Get credentials with per-device override
    credentials = get_device_credentials(request.device_credentials, session)

    connector = DeviceConnector(
        host=device.console_host or "127.0.0.1",
        port=device.console_port or 5000,
        credentials=credentials
    )

    return await connector.apply_config(request.commands, request.save_config)
