"""Verification API routes"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List, Optional

from app.core.config import settings
from app.sessions.models import Session
from app.api.routes.session import get_session_from_header

router = APIRouter(prefix="/verify", tags=["verify"])


class VerifyRequest(BaseModel):
    """Verification request"""
    device_id: str = Field(..., alias="deviceId")
    pack: str  # connectivity, ospf, switching, etc.


class VerifyCheck(BaseModel):
    """Single verification check"""
    name: str
    command: str
    status: str  # pass, fail, warning
    output: str
    message: Optional[str] = None


class VerifyResponse(BaseModel):
    """Verification response"""
    pack: str
    passed: int
    failed: int
    warnings: int
    checks: List[VerifyCheck]


@router.post("/run", response_model=VerifyResponse)
async def run_verification(
    request: VerifyRequest,
    session: Session = Depends(get_session_from_header)
):
    """Run verification pack on device"""
    # Mock verification results
    if request.pack == "connectivity":
        return VerifyResponse(
            pack="connectivity",
            passed=3,
            failed=0,
            warnings=1,
            checks=[
                VerifyCheck(
                    name="Interface Status",
                    command="show ip interface brief",
                    status="pass",
                    output="All interfaces up/up",
                    message="All configured interfaces are operational"
                ),
                VerifyCheck(
                    name="IP Connectivity",
                    command="ping 10.0.0.2",
                    status="pass",
                    output="Success rate is 100 percent (5/5)",
                    message="Connectivity to neighbor verified"
                ),
                VerifyCheck(
                    name="ARP Table",
                    command="show arp",
                    status="pass",
                    output="10.0.0.2 - 0050.7966.6801 ARPA",
                    message="ARP entries present"
                ),
                VerifyCheck(
                    name="CDP Neighbors",
                    command="show cdp neighbors",
                    status="warning",
                    output="No CDP neighbors found",
                    message="Consider enabling CDP for troubleshooting"
                ),
            ]
        )
    elif request.pack == "ospf":
        return VerifyResponse(
            pack="ospf",
            passed=2,
            failed=0,
            warnings=0,
            checks=[
                VerifyCheck(
                    name="OSPF Neighbors",
                    command="show ip ospf neighbor",
                    status="pass",
                    output="Neighbor ID: 2.2.2.2, State: FULL/DR",
                    message="OSPF adjacency established"
                ),
                VerifyCheck(
                    name="OSPF Routes",
                    command="show ip route ospf",
                    status="pass",
                    output="O 192.168.2.0/24 [110/2] via 10.0.0.2",
                    message="OSPF routes in routing table"
                ),
            ]
        )
    else:
        return VerifyResponse(
            pack=request.pack,
            passed=0,
            failed=0,
            warnings=1,
            checks=[
                VerifyCheck(
                    name="Unknown Pack",
                    command="",
                    status="warning",
                    output="",
                    message=f"Verification pack '{request.pack}' not implemented"
                )
            ]
        )
