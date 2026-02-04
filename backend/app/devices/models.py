"""Device operation models"""
from pydantic import BaseModel, Field
from typing import List, Optional


class ExecuteCommandRequest(BaseModel):
    """Request to execute command on device"""
    command: str


class ExecuteCommandResponse(BaseModel):
    """Command execution response"""
    ok: bool
    output: str
    error: Optional[str] = None


class ApplyConfigRequest(BaseModel):
    """Request to apply configuration"""
    commands: List[str]
    save_config: bool = Field(True, alias="saveConfig")


class ApplyConfigResponse(BaseModel):
    """Configuration apply response"""
    ok: bool
    log: List[str]
    warnings: List[str] = []
    errors: List[str] = []
