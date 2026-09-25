from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter — imported by main.py (to register the exception handler)
# and by API routers (to decorate specific endpoints).
limiter = Limiter(key_func=get_remote_address)
