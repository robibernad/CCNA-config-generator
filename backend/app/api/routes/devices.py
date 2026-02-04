"""Device operation API routes"""
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from app.core.config import settings
from app.sessions.models import Session
from app.api.routes.session import get_session_from_header
from app.devices.models import ExecuteCommandRequest, ExecuteCommandResponse, ApplyConfigRequest, ApplyConfigResponse
from app.devices.connector import DeviceConnector

router = APIRouter(prefix="/devices", tags=["devices"])


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
    
    connector = DeviceConnector(
        host=device.console_host or "127.0.0.1",
        port=device.console_port or 5000,
        credentials=session.device_credentials
    )
    
    return await connector.execute_command(request.command)


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
    
    connector = DeviceConnector(
        host=device.console_host or "127.0.0.1",
        port=device.console_port or 5000,
        credentials=session.device_credentials
    )
    
    return await connector.apply_config(request.commands, request.save_config)
