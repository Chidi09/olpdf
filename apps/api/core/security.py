import bleach
import secrets
import hashlib


def sanitize_string(value: str) -> str:
    if not value:
        return value
    return bleach.clean(value, strip=True)


def sanitize_text(value: str) -> str:
    return sanitize_string(value)


def sanitize_html(value: str) -> str:
    if not value:
        return value
    return bleach.clean(value, strip=True)


def _sanitize_json_value(value):
    if isinstance(value, str):
        return bleach.clean(value, strip=True)
    if isinstance(value, list):
        return [_sanitize_json_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _sanitize_json_value(item) for key, item in value.items()}
    return value


def sanitize_dict(data: dict) -> dict:
    if not data:
        return data
    return _sanitize_json_value(data)


def sanitize_document_model(document_model: dict) -> dict:
    cleaned = dict(document_model or {})

    if "meta" in cleaned:
        meta = cleaned["meta"]
        if isinstance(meta.get("title"), str):
            meta["title"] = bleach.clean(meta["title"], strip=True)
        if isinstance(meta.get("author"), str):
            meta["author"] = bleach.clean(meta["author"], strip=True)

    blocks = cleaned.get("blocks", [])
    safe_blocks = []
    for block in blocks:
        safe_block = dict(block)
        content = safe_block.get("content")
        if isinstance(content, str):
            safe_block["content"] = bleach.clean(content, strip=True)
        if isinstance(safe_block.get("fabric_data"), dict):
            safe_block["fabric_data"] = _sanitize_json_value(safe_block["fabric_data"])
        safe_blocks.append(safe_block)

    cleaned["blocks"] = safe_blocks
    return cleaned


def generate_api_key() -> str:
    return f"olp_{secrets.token_urlsafe(32)}"


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def get_key_prefix(key: str) -> str:
    return key[:8]
