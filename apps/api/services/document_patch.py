from typing import Any, Dict, List, Set


_LAYOUT_FIELDS: Set[str] = {
    "bounding_box", "page_index", "column_index", "z_index",
    "font_meta", "spacing", "alignment", "confidence_score",
}

_TEXT_FIELDS: Set[str] = {
    "content", "rich_spans",
}


def apply_ai_block_patch(existing_model: Dict[str, Any], after_blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Apply AI block changes while preserving layout metadata.

    Instead of wholesale replacement, match by block ID and only
    update text/content fields. Layout fields like bounding_box,
    page_index, font_meta, etc. are preserved from the existing blocks.
    """
    existing_blocks = existing_model.get("blocks", [])
    existing_by_id = {b["id"]: b for b in existing_blocks if "id" in b}

    after_by_id = {b["id"]: b for b in after_blocks if "id" in b}

    patched_blocks: List[Dict[str, Any]] = []
    for existing_block in existing_blocks:
        block_id = existing_block.get("id", "")
        after = after_by_id.get(block_id)
        if after:
            merged = dict(existing_block)
            for key in _TEXT_FIELDS:
                if key in after:
                    merged[key] = after[key]
            patched_blocks.append(merged)
        else:
            patched_blocks.append(existing_block)

    # Append any new blocks from after_blocks that weren't in the original
    for after_block in after_blocks:
        block_id = after_block.get("id", "")
        if block_id not in existing_by_id:
            patched_blocks.append(after_block)

    result = dict(existing_model)
    result["blocks"] = patched_blocks
    return result
