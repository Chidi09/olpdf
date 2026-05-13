from typing import Any, Dict


def safe_extract_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, (int, float, bool)):
        return str(content)
    if isinstance(content, dict):
        if "text" in content and isinstance(content["text"], str):
            return content["text"]
        if "content" in content and isinstance(content["content"], str):
            return content["content"]
        return ""
    if isinstance(content, list):
        return " ".join(safe_extract_text(c) for c in content)
    return str(content)


def normalize_block_type(type_str: str, content: Any) -> str:
    t = str(type_str or "paragraph")
    if t == "heading":
        if isinstance(content, dict):
            level = int(content.get("level", 1)) if "level" in content else 1
            return f"heading{max(1, min(level, 3))}"
        return "heading1"
    valid_types = {
        "heading1", "heading2", "heading3", "paragraph",
        "callout", "table", "list", "divider", "page_break",
        "image", "shape", "bullet_list", "ordered_list", "field",
    }
    if t in valid_types:
        return t
    return "paragraph"


def normalize_document_model(model: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(model, dict):
        return model
    blocks = model.get("blocks", [])
    if not isinstance(blocks, list):
        blocks = []
    normalized_blocks = []
    for block in blocks:
        if not isinstance(block, dict):
            normalized_blocks.append(block)
            continue
        content = block.get("content")
        normalized_blocks.append({
            **block,
            "type": normalize_block_type(str(block.get("type", "paragraph")), content),
            "content": safe_extract_text(content),
        })
    return {
        **model,
        "blocks": normalized_blocks,
        "page_dimensions": model.get("page_dimensions") if isinstance(model.get("page_dimensions"), list) else [],
        "styles": model.get("styles") if isinstance(model.get("styles"), dict) else {},
    }
