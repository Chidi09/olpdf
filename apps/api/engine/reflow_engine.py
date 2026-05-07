import math
from collections import defaultdict
from typing import Any


CHAR_WIDTH_RATIO = 0.6
LINE_HEIGHT_RATIO = 1.2
MARGIN_BOTTOM = 72.0


def _default_bbox(cursor_y: float) -> list[float]:
    return [72.0, cursor_y, 523.0, cursor_y + 14.0]


def estimate_block_height(block: dict[str, Any]) -> float:
    bbox = block.get("bounding_box") or _default_bbox(72.0)
    font_meta = block.get("font_meta") or {}
    content = str(block.get("content") or "")
    font_size = float(font_meta.get("size", 11.0) or 11.0)
    block_width = max(float(bbox[2]) - float(bbox[0]), 1.0)
    chars_per_line = max(block_width / max(font_size * CHAR_WIDTH_RATIO, 1.0), 1.0)
    lines = max(1, math.ceil(len(content) / chars_per_line))
    return max(lines * font_size * LINE_HEIGHT_RATIO, font_size * LINE_HEIGHT_RATIO)


def reflow_page_blocks(
    blocks: list[dict[str, Any]], page_index: int, page_height: float
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    current_page_blocks: list[dict[str, Any]] = []
    overflow_blocks: list[dict[str, Any]] = []

    sorted_blocks = sorted(
        blocks,
        key=lambda b: ((b.get("bounding_box") or [72.0, 72.0, 523.0, 86.0])[1]),
    )

    first_bbox = sorted_blocks[0].get("bounding_box") if sorted_blocks else None
    cursor_y = float(first_bbox[1]) if isinstance(first_bbox, list) and len(first_bbox) == 4 else 72.0

    for block in sorted_blocks:
        mutable = dict(block)
        bbox = mutable.get("bounding_box")
        if not (isinstance(bbox, list) and len(bbox) == 4):
            bbox = _default_bbox(cursor_y)

        font_meta = mutable.get("font_meta") or {}
        font_size = float(font_meta.get("size", 11.0) or 11.0)
        new_height = estimate_block_height(mutable)
        max_usable_height = max(float(page_height) - (MARGIN_BOTTOM * 2), font_size * LINE_HEIGHT_RATIO)

        if new_height > max_usable_height:
            mutable["page_index"] = int(page_index)
            mutable["bounding_box"] = [float(bbox[0]), cursor_y, float(bbox[2]), cursor_y + new_height]
            current_page_blocks.append(mutable)
            cursor_y += new_height + (font_size * 0.3)
            continue

        if cursor_y + new_height > float(page_height) - MARGIN_BOTTOM:
            overflow_top = MARGIN_BOTTOM
            mutable["page_index"] = int(page_index) + 1
            mutable["bounding_box"] = [float(bbox[0]), overflow_top, float(bbox[2]), overflow_top + new_height]
            overflow_blocks.append(mutable)
            continue

        mutable["page_index"] = int(page_index)
        mutable["bounding_box"] = [float(bbox[0]), cursor_y, float(bbox[2]), cursor_y + new_height]
        current_page_blocks.append(mutable)
        cursor_y += new_height + (font_size * 0.3)

    return current_page_blocks, overflow_blocks


def reflow_document(document_model: dict[str, Any]) -> dict[str, Any]:
    updated = dict(document_model)
    blocks = [dict(b) for b in (document_model.get("blocks") or []) if isinstance(b, dict)]
    page_dimensions = {
        int(dim.get("page_index", 0)): {
            "page_index": int(dim.get("page_index", 0)),
            "width": float(dim.get("width", 595.28)),
            "height": float(dim.get("height", 841.89)),
        }
        for dim in (document_model.get("page_dimensions") or [])
        if isinstance(dim, dict)
    }

    blocks_by_page: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for block in blocks:
        blocks_by_page[int(block.get("page_index", 0))].append(block)

    if not blocks_by_page:
        updated["blocks"] = []
        updated["page_dimensions"] = list(page_dimensions.values())
        return updated

    queue = sorted(blocks_by_page.keys())
    reflowed_blocks: list[dict[str, Any]] = []
    visited_pages: set[int] = set()

    while queue:
        page_index = queue.pop(0)
        if page_index in visited_pages:
            continue
        visited_pages.add(page_index)

        page_dim = page_dimensions.get(page_index, {"page_index": page_index, "width": 595.28, "height": 841.89})
        page_dimensions[page_index] = page_dim

        current_page_items = blocks_by_page.get(page_index, [])
        current_blocks, overflow = reflow_page_blocks(current_page_items, page_index, page_dim["height"])
        reflowed_blocks.extend(current_blocks)

        if overflow:
            next_page = page_index + 1
            blocks_by_page[next_page].extend(overflow)
            if next_page not in queue:
                queue.append(next_page)
                queue.sort()
            if next_page not in page_dimensions:
                page_dimensions[next_page] = {
                    "page_index": next_page,
                    "width": page_dim["width"],
                    "height": page_dim["height"],
                }

    updated["blocks"] = sorted(
        reflowed_blocks,
        key=lambda b: (int(b.get("page_index", 0)), float((b.get("bounding_box") or [0, 0, 0, 0])[1])),
    )
    updated["page_dimensions"] = [page_dimensions[idx] for idx in sorted(page_dimensions.keys())]
    return updated
