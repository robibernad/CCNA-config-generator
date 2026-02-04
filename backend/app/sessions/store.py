"""Session store with TTL"""
import uuid
import threading
from datetime import datetime, timedelta
from typing import Dict, Optional
from loguru import logger

from app.core.config import settings
from .models import Session, CreateSessionRequest


class SessionStore:
    """In-memory session store with TTL cleanup"""

    def __init__(self):
        self._sessions: Dict[str, Session] = {}
        self._lock = threading.Lock()
        self._cleanup_thread = None
        self._start_cleanup()

    def _start_cleanup(self):
        """Start background cleanup thread"""
        def cleanup_loop():
            import time
            while True:
                time.sleep(300)  # Run every 5 minutes
                self._cleanup_expired()

        self._cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
        self._cleanup_thread.start()

    def _cleanup_expired(self):
        """Remove expired sessions"""
        now = datetime.utcnow()
        with self._lock:
            expired = [
                sid for sid, session in self._sessions.items()
                if session.expires_at < now
            ]
            for sid in expired:
                del self._sessions[sid]
                logger.info(f"Cleaned up expired session: {sid[:8]}...")

    def create(self, request: CreateSessionRequest) -> Session:
        """Create a new session"""
        session_id = str(uuid.uuid4())
        now = datetime.utcnow()
        expires = now + timedelta(seconds=settings.SESSION_TTL)

        # IMPORTANT: keep naming consistent with routes/session.py usage (snake_case)
        session = Session(
            session_id=session_id,
            server_url=request.server_url,
            gns3_auth=request.gns3_auth,
            device_credentials=request.device_credentials,
            created_at=now,
            expires_at=expires,
        )

        with self._lock:
            self._sessions[session_id] = session

        logger.info(f"Created session: {session_id[:8]}...")
        return session

    def get(self, session_id: str) -> Optional[Session]:
        """Get session by ID"""
        with self._lock:
            session = self._sessions.get(session_id)
            if session and session.expires_at > datetime.utcnow():
                return session
            if session:
                # Expired
                del self._sessions[session_id]
        return None

    def delete(self, session_id: str) -> bool:
        """Delete session"""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                logger.info(f"Deleted session: {session_id[:8]}...")
                return True
        return False


# Singleton instance
session_store = SessionStore()
