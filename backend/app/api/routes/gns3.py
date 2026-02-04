"""GNS3 API routes"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional, Dict, Any
from loguru import logger

from app.core.config import settings
from app.sessions.models import Session
from app.api.routes.session import get_session_from_header
from app.gns3.client import GNS3Client
from app.gns3.models import GNS3TestRequest, GNS3TestResponse, GNS3Project, ProjectInventory

router = APIRouter(prefix="/gns3", tags=["gns3"])


def _auth_to_dict(auth_obj) -> Optional[Dict[str, Any]]:
    if not auth_obj:
        return None
    # pydantic v2
    if hasattr(auth_obj, "model_dump"):
        return auth_obj.model_dump()
    # pydantic v1
    if hasattr(auth_obj, "dict"):
        return auth_obj.dict()
    return None


@router.post("/test", response_model=GNS3TestResponse)
async def test_connection(request: GNS3TestRequest):
    """Test connection to GNS3 server"""
    if settings.MOCK_MODE:
        return GNS3TestResponse(ok=True, version="2.2.43", message="Connected to GNS3 2.2.43 (Mock Mode)")

    try:
        client = GNS3Client(request.server_url, request.auth)
        return await client.test_connection()
    except Exception as e:
        logger.exception(f"GNS3 test failed: {e}")
        raise HTTPException(status_code=502, detail=f"GNS3 test failed: {str(e)}")


@router.get("/projects", response_model=List[GNS3Project])
async def list_projects(session: Session = Depends(get_session_from_header)):
    """List all GNS3 projects"""
    if settings.MOCK_MODE:
        from app.mocks.gns3_data import get_mock_projects
        return get_mock_projects()

    try:
        auth = _auth_to_dict(session.gns3_auth)
        client = GNS3Client(session.server_url, auth)
        return await client.list_projects()
    except Exception as e:
        logger.exception(f"List projects failed: {e}")
        raise HTTPException(status_code=502, detail=f"List projects failed: {str(e)}")


@router.get("/projects/{project_id}/inventory", response_model=ProjectInventory)
async def get_project_inventory(project_id: str, session: Session = Depends(get_session_from_header)):
    """Get project inventory"""
    if settings.MOCK_MODE:
        from app.mocks.gns3_data import get_mock_inventory
        return get_mock_inventory(project_id)

    try:
        auth = _auth_to_dict(session.gns3_auth)
        client = GNS3Client(session.server_url, auth)
        return await client.get_project_inventory(project_id)
    except Exception as e:
        logger.exception(f"Inventory failed for {project_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Inventory failed: {str(e)}")
