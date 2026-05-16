from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

SELECTOR_MAP: Dict[str, str] = {
    "h1": "heading1",
    "h2": "heading2",
    "h3": "heading3",
    "p": "paragraph",
    "ul": "list",
    "ol": "list",
    "table": "table",
    "hr": "divider",
    "*": "_global",
}

CLASS_MAP: Dict[str, str] = {
    "heading1": "heading1",
    "heading2": "heading2",
    "heading3": "heading3",
    "paragraph": "paragraph",
    "list": "list",
    "table": "table",
    "callout": "callout",
    "divider": "divider",
}

PROPERTY_MAP: Dict[str, str] = {
    "font-size": "font_meta.size",
    "font-family": "font_meta.family",
    "color": "font_meta.color",
    "font-weight": "font_meta.is_bold",
    "font-style": "font_meta.is_italic",
    "text-align": "alignment",
    "line-height": "style_overrides.line_height",
    "margin-top": "style_overrides.margin_top",
    "margin-bottom": "style_overrides.margin_bottom",
    "background-color": "style_overrides.background_color",
    "border-left": "style_overrides.border_left",
    "padding": "style_overrides.padding",
    "letter-spacing": "style_overrides.letter_spacing",
    "text-transform": "style_overrides.text_transform",
}


def _strip_css_comments(text: str) -> str:
    return re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)


def _parse_css_rules(css_text: str) -> List[Tuple[str, Dict[str, str]]]:
    clean = _strip_css_comments(css_text)
    rules: List[Tuple[str, Dict[str, str]]] = []
    pattern = re.compile(
        r"""
        (?P<selectors>[^{]+)
        \{
        (?P<body>[^}]*)
        \}
        """,
        re.VERBOSE | re.DOTALL,
    )
    for match in pattern.finditer(clean):
        raw_selectors = match.group("selectors").strip()
        body = match.group("body").strip()
        if not raw_selectors or not body:
            continue
        props: Dict[str, str] = {}
        for line in body.split(";"):
            line = line.strip()
            if not line:
                continue
            if ":" not in line:
                continue
            key, _, val = line.partition(":")
            key = key.strip().lower()
            val = val.strip()
            if key and val:
                props[key] = val
        for selector in [s.strip() for s in raw_selectors.split(",")]:
            selector = selector.strip()
            if selector:
                rules.append((selector, dict(props)))
    return rules


def _resolve_block_type(selector: str) -> Optional[str]:
    if selector in SELECTOR_MAP:
        return SELECTOR_MAP[selector]
    if selector.startswith("."):
        cls = selector[1:]
        if cls in CLASS_MAP:
            return CLASS_MAP[cls]
    return None


def _normalize_color(value: str) -> str:
    value = value.strip().lower()
    if value.startswith("#"):
        return value[:7]
    named = {
        "black": "#000000",
        "white": "#ffffff",
        "red": "#ff0000",
        "green": "#008000",
        "blue": "#0000ff",
        "navy": "#000080",
        "gray": "#808080",
        "grey": "#808080",
    }
    if value in named:
        return named[value]
    rgb_match = re.match(r"rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)", value)
    if rgb_match:
        r, g, b = int(rgb_match.group(1)), int(rgb_match.group(2)), int(rgb_match.group(3))
        return f"#{r:02x}{g:02x}{b:02x}"
    return "#000000"


def _parse_font_size(value: str) -> Optional[float]:
    value = value.strip().lower()
    m = re.match(r"^([\d.]+)\s*(pt|px)?$", value)
    if m:
        num = float(m.group(1))
        unit = m.group(2)
        if unit == "px":
            num = num / 1.333
        return max(1.0, min(500.0, round(num, 1)))
    return None


def _clean_font_family(value: str) -> str:
    value = value.strip().strip("'\"").strip()
    return value[:100]


def _is_bold(value: str) -> bool:
    return value.strip().lower() in ("bold", "700", "800", "900")


def _is_italic(value: str) -> bool:
    return value.strip().lower() == "italic"


def _to_hex_color(value: str) -> str:
    return _normalize_color(value)


class CSSThemeTranslator:
    def translate(self, css_text: str) -> Dict[str, Dict[str, Any]]:
        rules = _parse_css_rules(css_text)
        result: Dict[str, Dict[str, Any]] = {}

        for selector, props in rules:
            block_type = _resolve_block_type(selector)
            if block_type is None:
                continue
            if block_type not in result:
                result[block_type] = {}

            font_meta: Dict[str, Any] = {}
            alignment: Optional[str] = None
            style_overrides: Dict[str, Any] = {}

            for css_prop, css_val in props.items():
                target = PROPERTY_MAP.get(css_prop)
                if target is None:
                    style_overrides[css_prop] = css_val
                    continue

                if target.startswith("font_meta."):
                    field = target.split(".", 1)[1]
                    if field == "size":
                        parsed = _parse_font_size(css_val)
                        if parsed is not None:
                            font_meta["size"] = parsed
                    elif field == "family":
                        font_meta["family"] = _clean_font_family(css_val)
                    elif field == "color":
                        font_meta["color"] = _to_hex_color(css_val)
                    elif field == "is_bold":
                        font_meta["is_bold"] = _is_bold(css_val)
                    elif field == "is_italic":
                        font_meta["is_italic"] = _is_italic(css_val)

                elif target == "alignment":
                    alignment = css_val.strip().lower()
                    if alignment not in ("left", "center", "right", "justify"):
                        alignment = "left"

                elif target.startswith("style_overrides."):
                    field = target.split(".", 1)[1]
                    style_overrides[field] = css_val

            if font_meta:
                current = result[block_type]
                current["font_meta"] = {**current.get("font_meta", {}), **font_meta}
            if alignment is not None:
                result[block_type]["alignment"] = alignment
            if style_overrides:
                existing = result[block_type].get("style_overrides", {})
                existing.update(style_overrides)
                result[block_type]["style_overrides"] = existing

        return result
