"""Session management API routes"""
from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from app.sessions.store import session_store
from app.sessions.models import CreateSessionRequest, Session, SessionResponse

router = APIRouter(prefix="/session", tags=["session"])


def get_session_from_header(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID")
) -> Session:
    """Dependency to get session from header"""
    if not x_session_id:
        raise HTTPException(status_code=401, detail="Missing X-Session-ID header")

    session = session_store.get(x_session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session (X-Session-ID not found)")

    return session


@router.post("", response_model=SessionResponse)
async def create_session(request: CreateSessionRequest):
    """Create a new session"""
    session = session_store.create(request)

    return SessionResponse(
        sessionId=session.session_id,
        serverUrl=session.server_url,
        hasGns3Auth=session.gns3_auth is not None,
        deviceUsername=session.device_credentials.username,
        deviceTransport=session.device_credentials.transport,
        createdAt=session.created_at,
        expiresAt=session.expires_at
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """Get session info (no secrets)"""
    session = session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionResponse(
        sessionId=session.session_id,
        serverUrl=session.server_url,
        hasGns3Auth=session.gns3_auth is not None,
        deviceUsername=session.device_credentials.username,
        deviceTransport=session.device_credentials.transport,
        createdAt=session.created_at,
        expiresAt=session.expires_at
    )


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    if session_store.delete(session_id):
        return {"ok": True, "message": "Session deleted"}
    raise HTTPException(status_code=404, detail="Session not found")
