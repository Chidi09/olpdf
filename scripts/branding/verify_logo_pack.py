#!/usr/bin/env python3
"""Validate generated OLPDF logo assets for dimensions and transparency."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]


EXPECTED: dict[str, dict[str, object]] = {
    "apps/web/public/logo.png": {"mode": "RGBA", "min_opaque": 5000},
    "apps/web/public/brand/generated/logo-primary.png": {"size": (1200, 400), "mode": "RGBA", "transparent_corners": True, "min_opaque": 15000},
    "apps/web/public/brand/generated/icon-192.png": {"size": (192, 192), "mode": "RGBA", "transparent_corners": True, "min_opaque": 1000},
    "apps/web/public/brand/generated/icon-512.png": {"size": (512, 512), "mode": "RGBA", "transparent_corners": True, "min_opaque": 8000},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=REPO_ROOT,
        help="Repository root path.",
    )
    return parser.parse_args()


def validate_file(path: Path, spec: dict[str, object]) -> list[str]:
    errors: list[str] = []
    if not path.exists():
        errors.append(f"missing file: {path}")
        return errors

    with Image.open(path) as image:
        if image.format != "PNG":
            errors.append(f"{path.name}: format is {image.format}, expected PNG")
        if "size" in spec and image.size != spec["size"]:
            errors.append(f"{path.name}: size {image.size}, expected {spec['size']}")
        if image.mode != spec["mode"]:
            errors.append(f"{path.name}: mode {image.mode}, expected {spec['mode']}")

        rgba = image.convert("RGBA")
        if spec.get("transparent_corners", False):
            corners = [
                rgba.getpixel((0, 0)),
                rgba.getpixel((rgba.width - 1, 0)),
                rgba.getpixel((0, rgba.height - 1)),
                rgba.getpixel((rgba.width - 1, rgba.height - 1)),
            ]
            for i, color in enumerate(corners):
                if color[3] > 6:
                    errors.append(f"{path.name}: corner {i} alpha={color[3]}, expected transparent")
                    break

        min_opaque = int(spec.get("min_opaque", 0))
        if min_opaque > 0:
            opaque_pixels = sum(1 for px in rgba.getdata() if px[3] >= 220)
            if opaque_pixels < min_opaque:
                errors.append(f"{path.name}: opaque pixels {opaque_pixels}, expected >= {min_opaque}")

    return errors


def main() -> int:
    args = parse_args()
    problems: list[str] = []
    for rel, spec in EXPECTED.items():
        problems.extend(validate_file(args.repo_root / rel, spec))

    if problems:
        print("Logo pack verification FAILED")
        for p in problems:
            print(f"- {p}")
        return 1

    print("Logo pack verification PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
