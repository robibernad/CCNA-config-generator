"""Session models"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class GNS3Auth(BaseModel):
    """GNS3 authentication"""
    username: str
    password: str

    class Config:
        populate_by_name = True


class DeviceCredentials(BaseModel):
    """Device connection credentials"""
    username: str
    password: str
    enable_secret: Optional[str] = Field(None, alias="enableSecret")
    transport: str = "telnet"  # telnet or ssh

    class Config:
        populate_by_name = True


class CreateSessionRequest(BaseModel):
    """Request to create a session"""
    server_url: str = Field(..., alias="serverUrl")
    gns3_auth: Optional[GNS3Auth] = Field(None, alias="gns3Auth")
    device_credentials: DeviceCredentials = Field(..., alias="deviceCredentials")

    class Config:
        populate_by_name = True


class Session(BaseModel):
    """Session data"""
    session_id: str = Field(..., alias="sessionId")
    server_url: str = Field(..., alias="serverUrl")
    gns3_auth: Optional[GNS3Auth] = Field(None, alias="gns3Auth")
    device_credentials: DeviceCredentials = Field(..., alias="deviceCredentials")
    created_at: datetime = Field(..., alias="createdAt")
    expires_at: datetime = Field(..., alias="expiresAt")

    class Config:
        populate_by_name = True


class SessionResponse(BaseModel):
    """Session response (no secrets)"""
    session_id: str = Field(..., alias="sessionId")
    server_url: str = Field(..., alias="serverUrl")
    has_gns3_auth: bool = Field(..., alias="hasGns3Auth")
    device_username: str = Field(..., alias="deviceUsername")
    device_transport: str = Field(..., alias="deviceTransport")
    created_at: datetime = Field(..., alias="createdAt")
    expires_at: datetime = Field(..., alias="expiresAt")

    class Config:
        populate_by_name = True
