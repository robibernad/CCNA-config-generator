"""Interface role inference API routes"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List

from app.core.config import settings
from app.sessions.models import Session
from app.api.routes.session import get_session_from_header

router = APIRouter(prefix="/inference", tags=["inference"])


class RoleInferenceRequest(BaseModel):
    """Role inference request"""
    project_id: str = Field(..., alias="projectId")
    device_id: str = Field(..., alias="deviceId")


class InterfaceSuggestion(BaseModel):
    """Interface role suggestion"""
    interface_name: str = Field(..., alias="interfaceName")
    suggested_role: str = Field(..., alias="suggestedRole")
    reason: str


class EtherChannelCandidate(BaseModel):
    """EtherChannel bundle candidate"""
    interfaces: List[str]
    neighbor_device: str = Field(..., alias="neighborDevice")
    reason: str


class RoleInferenceResponse(BaseModel):
    """Role inference response"""
    suggestions: List[InterfaceSuggestion]
    etherchannel_candidates: List[EtherChannelCandidate] = Field(..., alias="etherchannelCandidates")


@router.post("/roles", response_model=RoleInferenceResponse)
async def infer_roles(
    request: RoleInferenceRequest,
    session: Session = Depends(get_session_from_header)
):
    """Infer interface roles based on topology"""
    # Mock suggestions
    return RoleInferenceResponse(
        suggestions=[
            InterfaceSuggestion(
                interfaceName="GigabitEthernet0/0",
                suggestedRole="uplink",
                reason="Connected to router"
            ),
            InterfaceSuggestion(
                interfaceName="GigabitEthernet0/1",
                suggestedRole="access",
                reason="Connected to end host"
            ),
        ],
        etherchannelCandidates=[
            EtherChannelCandidate(
                interfaces=["GigabitEthernet1/0", "GigabitEthernet1/1"],
                neighborDevice="Core-SW",
                reason="Multiple parallel links detected"
            )
        ]
    )
