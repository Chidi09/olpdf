import json
import os
from typing import Any, Callable, Optional


_redis = None


def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    url = os.environ.get("REDIS_URL", "")
    if not url or url == "memory://" or url.startswith("memory"):
        _redis = None
        return None
    try:
        import redis as r
        _redis = r.from_url(url, decode_responses=True, socket_timeout=1, socket_connect_timeout=1)
        _redis.ping()
        return _redis
    except Exception:
        _redis = None
        return None


def get(key: str) -> Optional[Any]:
    try:
        r = _get_redis()
        if not r:
            return None
        val = r.get(key)
        if val is None:
            return None
        return json.loads(val)
    except Exception:
        return None


def set(key: str, value: Any, ttl: int = 300) -> None:
    try:
        r = _get_redis()
        if not r:
            return
        r.setex(key, ttl, json.dumps(value))
    except Exception:
        pass


def delete(key: str) -> None:
    try:
        r = _get_redis()
        if not r:
            return
        r.delete(key)
    except Exception:
        pass


def delete_pattern(pattern: str) -> None:
    try:
        r = _get_redis()
        if not r:
            return
        for k in r.scan_iter(match=pattern):
            r.delete(k)
    except Exception:
        pass


def cache_or_fetch(key: str, fn: Callable[[], Any], ttl: int = 300) -> Any:
    cached = get(key)
    if cached is not None:
        return cached
    result = fn()
    if result is not None:
        set(key, result, ttl)
    return result
