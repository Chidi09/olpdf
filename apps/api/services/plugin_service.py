"""
Plugin SDK service layer — validates manifests, enforces permission contracts,
and manages the plugin lifecycle (submit → review → publish → install).
"""
import re
from typing import Any, Dict, List

from fastapi import HTTPException

ALLOWED_PERMISSIONS = {
    "blocks:read", "blocks:write",
    "ui:side_panel", "ui:toolbar_button", "ui:context_menu",
    "document:read", "document:export",
    "network:declared",
}

ALLOWED_HOOKS = {
    "onDocumentLoad", "onDocumentSave", "onSelection",
    "onBlockChange", "onPageChange", "onExport",
}

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")


def validate_manifest(manifest: Dict[str, Any]) -> None:
    required = {"name", "version", "permissions", "entry"}
    missing = required - set(manifest.keys())
    if missing:
        raise HTTPException(status_code=422, detail=f"Manifest missing required fields: {missing}")

    if not _VERSION_RE.match(manifest.get("version", "")):
        raise HTTPException(status_code=422, detail="Manifest version must follow semver (e.g. 1.0.0)")

    unknown_perms = set(manifest.get("permissions", [])) - ALLOWED_PERMISSIONS
    if unknown_perms:
        raise HTTPException(status_code=422, detail=f"Unknown permissions requested: {unknown_perms}")

    unknown_hooks = set(manifest.get("hooks", [])) - ALLOWED_HOOKS
    if unknown_hooks:
        raise HTTPException(status_code=422, detail=f"Unknown hooks declared: {unknown_hooks}")


def generate_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower().strip()).strip("-")
    return slug[:60]


def validate_slug(slug: str) -> None:
    if not _SLUG_RE.match(slug):
        raise HTTPException(status_code=422, detail="Slug must be lowercase alphanumeric with hyphens only")


def submit_plugin(
    author_id: str,
    name: str,
    slug: str,
    description: str,
    manifest: Dict[str, Any],
    bundle_url: str,
    version: str,
    category: str,
) -> Dict[str, Any]:
    validate_manifest(manifest)
    validate_slug(slug)

    from ..repositories.plugin_repo import PluginRepository

    existing = PluginRepository.get_by_slug(slug)
    if existing:
        raise HTTPException(status_code=409, detail=f"A plugin with slug '{slug}' already exists")

    return PluginRepository.create(
        author_id=author_id,
        name=name,
        slug=slug,
        description=description,
        manifest=manifest,
        bundle_url=bundle_url,
        version=version,
        category=category,
    )
