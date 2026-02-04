"""GNS3 data models"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class GNS3TestRequest(BaseModel):
    """GNS3 connection test request"""
    server_url: str = Field(..., alias="serverUrl")
    auth: Optional[Dict[str, str]] = None


class GNS3TestResponse(BaseModel):
    """GNS3 connection test response"""
    ok: bool
    version: Optional[str] = None
    message: str


class GNS3Project(BaseModel):
    """GNS3 project"""
    project_id: str = Field(..., alias="projectId")
    name: str
    status: str
    path: Optional[str] = None


class DeviceInterface(BaseModel):
    """Device interface"""
    name: str
    adapter: int
    port: int
    link_type: Optional[str] = Field(None, alias="linkType")
    connected: bool = False
    connected_to: Optional[str] = Field(None, alias="connectedTo")


class DeviceInfo(BaseModel):
    """Device information"""
    node_id: str = Field(..., alias="nodeId")
    name: str
    device_type: str = Field(..., alias="deviceType")
    template: Optional[str] = None
    console_host: Optional[str] = Field(None, alias="consoleHost")
    console_port: Optional[int] = Field(None, alias="consolePort")
    console_type: str = Field("telnet", alias="consoleType")
    interfaces: List[DeviceInterface] = []
    status: str = "stopped"


class LinkInfo(BaseModel):
    """Link information"""
    link_id: str = Field(..., alias="linkId")
    nodes: List[Dict[str, Any]]


class ProjectInventory(BaseModel):
    """Project inventory"""
    project_id: str = Field(..., alias="projectId")
    project_name: str = Field(..., alias="projectName")
    devices: List[DeviceInfo]
    links: List[LinkInfo]
    
    class Config:
        populate_by_name = True
