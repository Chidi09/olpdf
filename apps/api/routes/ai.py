from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from ..models import AiInstructionPayload
from ..repositories import DocumentRepository
from ..auth_utils import require_auth, check_ownership
from ..ai_utils import execute_ai_instruction
from ..services.ai_service import chat_with_document, summarise_document, detect_pii
from ..supabase_client import supabase
from ..security_utils import sanitize_string
from ..engine.normalizer import normalize_document_model
from ..services.document_patch import apply_ai_block_patch
from ..engine.reflow_engine import reflow_document
from ..services.css_theme_translator import CSSThemeTranslator
from ..services import theme_library

# Import limiter from limiter module
from ..limiter import limiter

router = APIRouter(prefix="/api/ai", tags=["ai"])


class AiBlockRewritePayload(BaseModel):
    instruction: str


def _flatten_document_text(model: Dict[str, Any]) -> str:
    return "\n\n".join(
        b.get("content", "") for b in model.get("blocks", [])
        if b.get("content") and b.get("type") != "table"
    )

@router.get("/documents/{document_id}/logs")
async def get_ai_logs(document_id: str, user: dict = Depends(require_auth)) -> List[dict]:
    check_ownership(document_id, user)
    return DocumentRepository.get_logs(document_id)

@router.post("/documents/{document_id}/instruction")
@limiter.limit("5/minute")
async def ai_instruction(request: Request, document_id: str, payload: AiInstructionPayload, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    instruction = sanitize_string(payload.instruction)
    return await execute_ai_instruction(document_id, instruction)


@router.post("/documents/{document_id}/chat")
@limiter.limit("10/minute")
async def ai_chat(request: Request, document_id: str, payload: AiInstructionPayload, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    message = sanitize_string(payload.instruction)
    return await chat_with_document(document_id, message)


@router.post("/documents/{document_id}/summarise")
@limiter.limit("5/minute")
async def ai_summarise(request: Request, document_id: str, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    doc = DocumentRepository.get_by_id(document_id)
    model = doc.get("document_model", {})
    text = _flatten_document_text(model)
    short = text[:1200]
    if not short:
        return {"summary": "No text content available."}
    sentences = [s.strip() for s in short.replace("\n", " ").split(".") if s.strip()]
    summary = ". ".join(sentences[:3]).strip()
    if summary and not summary.endswith("."):
        summary = summary + "."
    return {"summary": summary or short[:240]}


@router.post("/documents/{document_id}/blocks/{block_id}/rewrite")
@limiter.limit("10/minute")
async def ai_rewrite_block(request: Request, document_id: str, block_id: str, payload: AiBlockRewritePayload, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    doc = DocumentRepository.get_by_id(document_id)
    model = doc.get("document_model", {})
    blocks = model.get("blocks", [])
    block = next((b for b in blocks if b.get("id") == block_id), None)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    original = str(block.get("content", ""))
    instruction = sanitize_string(payload.instruction).lower()

    if instruction == "shorten":
        suggestion = original[: max(1, len(original) // 2)].strip()
    elif instruction == "formal":
        suggestion = f"In formal terms, {original[:1].lower() + original[1:] if original else original}"
    elif instruction == "casual":
        suggestion = f"In simple terms, {original[:1].lower() + original[1:] if original else original}"
    elif instruction == "improve":
        suggestion = original.strip()
    else:
        suggestion = original.strip()

    return {"suggestion": suggestion, "original": original}


@router.post("/documents/{document_id}/blocks/{block_id}/ocr-verify")
@limiter.limit("10/minute")
async def ai_ocr_verify_block(request: Request, document_id: str, block_id: str, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    doc = DocumentRepository.get_by_id(document_id)
    model = doc.get("document_model", {})
    blocks = model.get("blocks", [])
    block = next((b for b in blocks if b.get("id") == block_id), None)
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    confidence = float(block.get("confidence_score", 1.0) or 1.0)
    if confidence >= 0.9:
        return {"verified": True, "correction": None}
    return {"verified": False, "correction": str(block.get("content", "")).strip()}


@router.post("/documents/{document_id}/detect-pii")
@limiter.limit("10/minute")
async def ai_detect_pii(request: Request, document_id: str, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    return await detect_pii(document_id)


class ThemePayload(BaseModel):
    css: str = ""
    theme_name: str = ""


class ThemePresetPayload(BaseModel):
    preset_id: str


@router.post("/documents/{document_id}/theme")
@limiter.limit("5/minute")
async def ai_apply_theme(request: Request, document_id: str, payload: ThemePayload, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    instruction = f"""Apply the following CSS theme to the document. Use the ApplyTheme tool with exactly this CSS. Theme name: {payload.theme_name or 'custom'}
    
CSS:
{payload.css}"""
    if payload.css:
        instruction = f"""First call ReadPageMetrics to examine the document layout, then call ApplyTheme with the following CSS. Theme name: {payload.theme_name or 'custom'}

CSS:
{payload.css}"""
    return await execute_ai_instruction(document_id, instruction)


@router.post("/documents/{document_id}/theme/preset")
@limiter.limit("10/minute")
async def ai_apply_theme_preset(request: Request, document_id: str, payload: ThemePresetPayload, user: dict = Depends(require_auth)) -> dict:
    check_ownership(document_id, user)
    css_text = theme_library.THEMES.get(payload.preset_id)
    if not css_text:
        raise HTTPException(status_code=404, detail=f"Theme '{payload.preset_id}' not found. Available: {', '.join(theme_library.THEMES.keys())}")

    doc = DocumentRepository.get_by_id(document_id)
    model = doc.get("document_model", {})
    before_blocks = [dict(b) for b in model.get("blocks", [])]

    translator = CSSThemeTranslator()
    theme_map = translator.translate(css_text)
    global_rules = theme_map.pop("_global", {})
    blocks = model.get("blocks", [])
    for block in blocks:
        block_type = block.get("type", "paragraph")
        rules = dict(global_rules)
        type_rules = theme_map.get(block_type, {})
        rules.update(type_rules)
        if not rules:
            continue
        if "font_meta" in rules:
            existing_fm = block.get("font_meta") or {}
            existing_fm.update(rules["font_meta"])
            block["font_meta"] = existing_fm
        if "alignment" in rules:
            block["alignment"] = rules["alignment"]
        if "style_overrides" in rules:
            existing_so = block.get("style_overrides") or {}
            existing_so.update(rules["style_overrides"])
            block["style_overrides"] = existing_so

    model.setdefault("styles", {})["active_theme"] = payload.preset_id
    reflowed = reflow_document(model)

    log_res = supabase.table("ai_edit_logs").insert({
        "document_id": document_id,
        "instruction": f"Apply preset theme: {payload.preset_id}",
        "tool_calls": [{"name": "ApplyTheme", "args": {"theme_name": payload.preset_id}}],
        "diff_snapshot": {"before": before_blocks, "after": reflowed.get("blocks", [])},
        "status": "pending_review",
    }).execute()

    return {
        "log_id": log_res.data[0]["id"],
        "updated_model": reflowed,
        "tool_calls": [{"name": "ApplyTheme", "args": {"theme_name": payload.preset_id}}],
        "diff_snapshot": {"before": before_blocks, "after": reflowed.get("blocks", [])},
    }


@router.post("/logs/{log_id}/accept")
async def accept_ai_edit(log_id: str, user: dict = Depends(require_auth)) -> dict:
    res = supabase.table("ai_edit_logs").select("*").eq("id", log_id).single().execute()
    log = res.data
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    check_ownership(log["document_id"], user)
    
    doc = DocumentRepository.get_by_id(log["document_id"])
    model = doc["document_model"]
    after_blocks = log["diff_snapshot"]["after"]
    patched = apply_ai_block_patch(model, after_blocks)
    reflowed = reflow_document(patched)
    DocumentRepository.update(log["document_id"], {"document_model": reflowed})
    DocumentRepository.update_log(log_id, {"status": "accepted"})
    return {"status": "success", "document_model": normalize_document_model(reflowed)}

@router.post("/logs/{log_id}/reject")
async def reject_ai_edit(log_id: str, user: dict = Depends(require_auth)) -> dict:
    res = supabase.table("ai_edit_logs").select("*").eq("id", log_id).single().execute()
    log = res.data
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    check_ownership(log["document_id"], user)
    
    DocumentRepository.update_log(log_id, {"status": "rejected"})
    return {"status": "success"}
