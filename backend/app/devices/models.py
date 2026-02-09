"""Device operation models"""
from pydantic import BaseModel, Field
from typing import List, Optional

# Import DeviceCredentials for per-device credential support
from app.sessions.models import DeviceCredentials


class ExecuteCommandRequest(BaseModel):
    """Request to execute command on device"""
    command: str
    device_credentials: Optional[DeviceCredentials] = Field(None, alias="deviceCredentials")

    class Config:
        populate_by_name = True


class ExecuteCommandResponse(BaseModel):
    """Command execution response"""
    ok: bool
    output: str
    error: Optional[str] = None


class ApplyConfigRequest(BaseModel):
    """Request to apply configuration"""
    commands: List[str]
    save_config: bool = Field(True, alias="saveConfig")
    device_credentials: Optional[DeviceCredentials] = Field(None, alias="deviceCredentials")

    class Config:
        populate_by_name = True


class ApplyConfigResponse(BaseModel):
    """Configuration apply response"""
    ok: bool
    log: List[str]
    warnings: List[str] = []
    errors: List[str] = []
