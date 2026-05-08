import os
from slowapi import Limiter
from slowapi.util import get_remote_address

_storage_uri = os.getenv("REDIS_URL", "memory://")
limiter = Limiter(key_func=get_remote_address, storage_uri=_storage_uri)
