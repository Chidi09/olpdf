import json
import os
from typing import Any, Callable, Optional


_client = None


async def get_redis():
    global _client
    if _client is not None:
        return _client
    url = os.environ.get("REDIS_URL", "")
    if not url or url == "memory://":
        return None
    try:
        import redis.asyncio as aioredis
        _client = aioredis.from_url(url, decode_responses=True, max_connections=20)
        await _client.ping()
        return _client
    except Exception:
        _client = None
        return None


async def cache_get(key: str) -> Optional[Any]:
    try:
        r = await get_redis()
        if not r:
            return None
        raw = await r.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    try:
        r = await get_redis()
        if not r:
            return
        await r.set(key, json.dumps(value), ex=ttl)
    except Exception:
        pass


async def cache_del(key: str) -> None:
    try:
        r = await get_redis()
        if not r:
            return
        await r.delete(key)
    except Exception:
        pass


async def cache_del_pattern(pattern: str) -> None:
    try:
        r = await get_redis()
        if not r:
            return
        keys = [k async for k in r.scan_iter(match=pattern)]
        if keys:
            await r.delete(*keys)
    except Exception:
        pass


async def cache_or_fetch(key: str, fn: Callable[[], Any], ttl: int = 300) -> Any:
    cached = await cache_get(key)
    if cached is not None:
        return cached
    result = fn()
    if result is not None:
        await cache_set(key, result, ttl)
    return result
