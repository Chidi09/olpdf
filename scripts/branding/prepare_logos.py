#!/usr/bin/env python3
"""Prepare deterministic OLPDF logo assets from a single source image."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=REPO_ROOT / "ChatGPT Image May 6, 2026, 05_24_59 PM.png",
        help="Path to the source logo image.",
    )
    parser.add_argument(
        "--public-dir",
        type=Path,
        default=REPO_ROOT / "apps" / "web" / "public",
        help="Path to apps/web/public.",
    )
    return parser.parse_args()


def trim_to_alpha(image: Image.Image, threshold: int = 6) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("Image appears empty after transparency normalization")
    return rgba.crop(bounds)


def fit_to_canvas(image: Image.Image, size: tuple[int, int], padding: float) -> Image.Image:
    width, height = size
    pad_x = int(round(width * padding))
    pad_y = int(round(height * padding))
    target_w = max(width - (pad_x * 2), 1)
    target_h = max(height - (pad_y * 2), 1)

    source_w, source_h = image.size
    scale = min(target_w / source_w, target_h / source_h)
    resized = image.resize(
        (
            max(1, int(round(source_w * scale))),
            max(1, int(round(source_h * scale))),
        ),
        resample=Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    offset_x = (width - resized.width) // 2
    offset_y = (height - resized.height) // 2
    canvas.alpha_composite(resized, (offset_x, offset_y))
    return canvas


def write_png(image: Image.Image, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_path, format="PNG", compress_level=9, optimize=False)


def main() -> int:
    args = parse_args()
    source = args.source
    if not source.exists():
        raise FileNotFoundError(f"Source image not found: {source}")

    public_dir: Path = args.public_dir
    generated = public_dir / "brand" / "generated"

    with Image.open(source) as raw:
        trimmed = trim_to_alpha(raw.convert("RGBA"))

    logo_primary = fit_to_canvas(trimmed, (1200, 400), padding=0.08)
    icon_512 = fit_to_canvas(trimmed, (512, 512), padding=0.16)
    icon_192 = fit_to_canvas(trimmed, (192, 192), padding=0.16)

    write_png(trimmed, public_dir / "logo.png")
    write_png(logo_primary, generated / "logo-primary.png")
    write_png(icon_192, generated / "icon-192.png")
    write_png(icon_512, generated / "icon-512.png")

    print("Generated assets:")
    print(f"- {public_dir / 'logo.png'}")
    print(f"- {generated / 'logo-primary.png'}")
    print(f"- {generated / 'icon-192.png'}")
    print(f"- {generated / 'icon-512.png'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
