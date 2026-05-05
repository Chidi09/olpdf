import bleach


def sanitize_document_model(document_model: dict) -> dict:
    cleaned = dict(document_model or {})
    blocks = cleaned.get("blocks", [])
    safe_blocks = []

    for block in blocks:
        safe_block = dict(block)
        content = safe_block.get("content")
        if isinstance(content, str):
            safe_block["content"] = bleach.clean(content, strip=True)
        safe_blocks.append(safe_block)

    cleaned["blocks"] = safe_blocks
    return cleaned
