"""Security utilities"""
import re
from typing import Optional
from urllib.parse import urlparse


def sanitize_url(url: str) -> Optional[str]:
    """Sanitize and validate URL"""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return None
        return url
    except Exception:
        return None


def sanitize_string(value: str, max_length: int = 255) -> str:
    """Sanitize string input"""
    # Remove control characters
    value = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', value)
    # Truncate
    return value[:max_length]


def is_safe_hostname(hostname: str) -> bool:
    """Check if hostname is safe to connect to"""
    # Block obviously bad hostnames
    blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
    from .config import settings
    
    if settings.ALLOW_LOCALHOST_GNS3:
        return True
    
    return hostname.lower() not in blocked
