import json
import os
import re
from typing import Any, Dict, Optional

import google.generativeai as genai

from ..core.supabase_client import supabase
from .ai_providers import get_provider_for_user, ToolCall as _ToolCall

GENAI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

_VALID_BLOCK_TYPES = {"paragraph", "heading1", "heading2", "heading3", "callout", "table", "list", "divider", "page_break"}
_VALID_STYLE_PROPS = {"font_family", "base_font_size", "line_height", "margin_top", "margin_bottom", "heading1_color", "body_color"}

_TOOL_DECLARATIONS = [{"function_declarations": [
    {"name": "RewriteBlock", "description": "Rewrite the content of an existing block.", "parameters": {"type": "OBJECT", "properties": {"block_id": {"type": "STRING"}, "new_content": {"type": "STRING"}, "reason": {"type": "STRING"}}, "required": ["block_id", "new_content", "reason"]}},
    {"name": "InsertBlock", "description": "Insert a new block after a specific block ID (use 'START' for the beginning).", "parameters": {"type": "OBJECT", "properties": {"after_block_id": {"type": "STRING"}, "block_type": {"type": "STRING", "enum": list(_VALID_BLOCK_TYPES)}, "content": {"type": "STRING"}}, "required": ["after_block_id", "block_type", "content"]}},
    {"name": "DeleteBlock", "description": "Delete a specific block.", "parameters": {"type": "OBJECT", "properties": {"block_id": {"type": "STRING"}}, "required": ["block_id"]}},
    {"name": "ReorderBlocks", "description": "Reorder all blocks in the document.", "parameters": {"type": "OBJECT", "properties": {"block_ids_in_order": {"type": "ARRAY", "items": {"type": "STRING"}}}, "required": ["block_ids_in_order"]}},
]}]


def apply_tool_call(document: Dict[str, Any], tool_call: "_ToolCall | Any") -> Dict[str, Any]:
    name = tool_call.name
    args = tool_call.args if isinstance(tool_call.args, dict) else dict(tool_call.args)
    blocks = document.get("blocks", [])

    if name == "RewriteBlock":
        for b in blocks:
            if b["id"] == args.get("block_id"):
                b["content"] = args.get("new_content")
                # Clear rich_spans so the layout engine correctly reconstructs formatting from raw string
                if "rich_spans" in b:
                    del b["rich_spans"]
                break

    elif name == "InsertBlock":
        block_type = args.get("block_type", "paragraph")
        if block_type not in _VALID_BLOCK_TYPES:
            block_type = "paragraph"
        new_id = f"blk_ai_{os.urandom(4).hex()}"
        new_block = {
            "id": new_id, 
            "type": block_type, 
            "content": args.get("content", ""), 
            "confidence_score": 1.0, 
            "needs_review": False, 
            "style_overrides": {},
            "float": "none"
        }
        after_id = args.get("after_block_id")
        if after_id == "START":
            if blocks:
                first_id = blocks[0]["id"]
                new_block["next_block_id"] = first_id
                blocks[0]["prev_block_id"] = new_id
            blocks.insert(0, new_block)
        else:
            for i, b in enumerate(blocks):
                if b["id"] == after_id:
                    # Heal links
                    next_id = b.get("next_block_id")
                    b["next_block_id"] = new_id
                    new_block["prev_block_id"] = b["id"]
                    if next_id:
                        new_block["next_block_id"] = next_id
                        for nb in blocks:
                            if nb["id"] == next_id:
                                nb["prev_block_id"] = new_id
                                break
                    blocks.insert(i + 1, new_block)
                    break
            else:
                # after_block_id not found — append at tail and wire up the previous last block
                if blocks:
                    tail = blocks[-1]
                    tail["next_block_id"] = new_id
                    new_block["prev_block_id"] = tail["id"]
                blocks.append(new_block)

    elif name == "DeleteBlock":
        block_id = args.get("block_id")
        # Find the block to delete to heal links
        deleted_block = next((b for b in blocks if b["id"] == block_id), None)
        if deleted_block:
            prev_id = deleted_block.get("prev_block_id")
            next_id = deleted_block.get("next_block_id")
            if prev_id:
                for b in blocks:
                    if b["id"] == prev_id:
                        if next_id:
                            b["next_block_id"] = next_id
                        else:
                            b.pop("next_block_id", None)
            if next_id:
                for b in blocks:
                    if b["id"] == next_id:
                        if prev_id:
                            b["prev_block_id"] = prev_id
                        else:
                            b.pop("prev_block_id", None)
                            
        document["blocks"] = [b for b in blocks if b["id"] != block_id]

    elif name == "ReorderBlocks":
        order = args.get("block_ids_in_order", [])
        block_map = {b["id"]: b for b in blocks}
        ordered = [block_map[bid] for bid in order if bid in block_map]
        mentioned = set(order)
        ordered += [b for b in blocks if b["id"] not in mentioned]
        
        # Re-link the AST flow sequentially
        for i in range(len(ordered)):
            if i > 0:
                ordered[i]["prev_block_id"] = ordered[i-1]["id"]
            else:
                ordered[i].pop("prev_block_id", None)
                
            if i < len(ordered) - 1:
                ordered[i]["next_block_id"] = ordered[i+1]["id"]
            else:
                ordered[i].pop("next_block_id", None)
                
        document["blocks"] = ordered

    elif name == "UpdateStyle":
        prop = args.get("property")
        if prop in _VALID_STYLE_PROPS:
            document.setdefault("styles", {})[prop] = args.get("value")

    return document


async def execute_ai_instruction(document_id: str, instruction: str, user_id: str = "") -> Dict[str, Any]:
    res = supabase.table("documents").select("*").eq("id", document_id).single().execute()
    document = res.data
    doc_model = document["document_model"]

    doc_context = [{"id": b["id"], "type": b["type"], "preview": (b.get("content") or "")[:120]} for b in doc_model.get("blocks", [])]

    provider = await get_provider_for_user(user_id) if user_id else None
    prompt = f"""You are a document editor with access to precise editing tools.
Document structure:
{json.dumps(doc_context, indent=2)}

<user_instruction>
{instruction}
</user_instruction>

Use your tools to make the requested changes. Be precise."""

    if provider:
        tool_calls = await provider.run_with_tools(prompt, _TOOL_DECLARATIONS)
    else:
        # Fallback: env Gemini key
        model = genai.GenerativeModel("gemini-2.5-flash")
        chat = model.start_chat()
        response = chat.send_message(prompt, tools=_TOOL_DECLARATIONS, tool_config={"function_calling_config": {"mode": "ANY"}})
        tool_calls = []
        for part in response.candidates[0].content.parts:
            if part.function_call:
                fn = part.function_call
                tool_calls.append(fn)

    updated_doc = json.loads(json.dumps(doc_model))
    tool_calls_log = []
    for tc in tool_calls:
        args = tc.args if isinstance(tc.args, dict) else dict(tc.args)
        tool_calls_log.append({"name": tc.name, "args": args})
        updated_doc = apply_tool_call(updated_doc, tc)

    log_res = supabase.table("ai_edit_logs").insert({
        "document_id": document_id,
        "instruction": instruction,
        "tool_calls": tool_calls_log,
        "diff_snapshot": {"before": doc_model["blocks"], "after": updated_doc["blocks"]},
        "status": "pending_review",
    }).execute()

    return {
        "log_id": log_res.data[0]["id"],
        "updated_model": updated_doc,
        "tool_calls": tool_calls_log,
        "diff_snapshot": {"before": doc_model["blocks"], "after": updated_doc["blocks"]},
    }


async def rewrite_block_with_tone(document_id: str, block_id: str, tone: str, user_id: str = "") -> Dict[str, Any]:
    return await execute_ai_instruction(document_id, f"Rewrite block {block_id} with a {tone} tone. Keep meaning intact.", user_id)


async def summarise_document(document_id: str, focus: Optional[str] = None, user_id: str = "") -> Dict[str, Any]:
    clause = f" Focus on: {focus}." if focus else ""
    return await execute_ai_instruction(document_id, "Create a concise executive summary and insert it at the top as heading2 + paragraph." + clause, user_id)


async def suggest_structure(document_id: str, objective: str, user_id: str = "") -> Dict[str, Any]:
    return await execute_ai_instruction(document_id, f"Suggest and apply a clearer section structure for: {objective}. Use heading blocks and short transition paragraphs only where needed.", user_id)


async def expand_block(document_id: str, block_id: str, guidance: Optional[str] = None, user_id: str = "") -> Dict[str, Any]:
    clause = f" Guidance: {guidance}." if guidance else ""
    return await execute_ai_instruction(document_id, f"Expand block {block_id} with useful detail while preserving intent and style." + clause, user_id)


async def continue_chapter(document_id: str, direction: Optional[str] = None, user_id: str = "") -> Dict[str, Any]:
    clause = f" Narrative direction: {direction}." if direction else ""
    return await execute_ai_instruction(document_id, "Continue this chapter from the end with coherent narrative progression. Insert one to three paragraph blocks at the end." + clause, user_id)


async def fill_template(document_id: str, values: Dict[str, str]) -> Dict[str, Any]:
    res = supabase.table("documents").select("*").eq("id", document_id).single().execute()
    document = res.data
    if not document:
        raise ValueError("Document not found")
    doc_model = document.get("document_model", {})
    before_blocks = json.loads(json.dumps(doc_model.get("blocks", [])))
    filled_count = 0
    for block in doc_model.get("blocks", []):
        content = block.get("content")
        if not isinstance(content, str):
            continue
        updated = content
        for key, val in values.items():
            token = "{{" + key + "}}"
            if token in updated:
                updated = updated.replace(token, val)
        if updated != content:
            block["content"] = updated
            filled_count += 1

    supabase.table("documents").update({"document_model": doc_model}).eq("id", document_id).execute()
    after_blocks = doc_model.get("blocks", [])
    log_res = supabase.table("ai_edit_logs").insert({
        "document_id": document_id,
        "instruction": "Fill template placeholders",
        "tool_calls": [{"name": "FillTemplatePlaceholder", "args": values}],
        "diff_snapshot": {"before": before_blocks, "after": after_blocks},
        "status": "accepted",
    }).execute()

    unresolved = sorted(set(re.compile(r"\{\{[A-Z_]+\}\}").findall("".join(b.get("content", "") for b in after_blocks if isinstance(b.get("content"), str)))))

    return {
        "log_id": log_res.data[0]["id"] if log_res.data else None,
        "filled_blocks": filled_count,
        "unresolved_placeholders": unresolved,
        "updated_model": doc_model,
    }


async def check_book_consistency(book_id: str, query: str) -> Dict[str, Any]:
    if not GENAI_API_KEY:
        if os.environ.get("OLPDF_DEV_MODE") == "true":
            return {"analysis": "DEV MODE: Gemini API key not configured.", "inconsistencies": []}
        raise ValueError("GEMINI_API_KEY is not configured.")

    embed_res = genai.embed_content(model="models/text-embedding-004", content=query, task_type="retrieval_query")
    passages = supabase.rpc("match_chapter_embeddings", {"query_embedding": embed_res["embedding"], "book_id": book_id, "match_threshold": 0.75, "match_count": 8}).execute()

    if not passages.data:
        return {"analysis": "No relevant passages found for this query.", "inconsistencies": []}

    passage_map: Dict[str, Dict] = {}
    context_list = []
    for i, p in enumerate(passages.data):
        pid = f"PASSAGE_{i}"
        p["passage_id"] = pid
        passage_map[pid] = p
        context_list.append(f"[{pid}] (Chapter: {p.get('chapter_id')}, Chunk: {p.get('chunk_index', 'N/A')}):\n{p['content']}")

    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = f"""You are a book editor checking for consistency.
Query: {query}
Retrieved passages:\n{chr(10).join(context_list)}
Based ONLY on the passages above, identify any inconsistencies. Cite passage IDs.
Format as JSON with 'analysis' (string) and 'inconsistencies' (list of {{passage_id, content, issue}})."""

    response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
    result = json.loads(response.text)

    ch_titles = {c["id"]: c["title"] for c in supabase.table("book_chapters").select("id, title").eq("book_id", book_id).execute().data}
    final_inconsistencies = []
    for inc in result.get("inconsistencies", []):
        pid = inc.get("passage_id")
        if pid in passage_map:
            cid = passage_map[pid].get("chapter_id")
            final_inconsistencies.append({**inc, "chapter_id": cid, "chapter_title": ch_titles.get(cid, "Unknown"), "chunk_index": passage_map[pid].get("chunk_index")})
        else:
            final_inconsistencies.append(inc)

    return {"analysis": result.get("analysis"), "inconsistencies": final_inconsistencies, "passages_checked": len(passages.data)}


async def chat_with_document(document_id: str, message: str, user_id: str = "") -> Dict[str, Any]:
    res = supabase.table("documents").select("document_model").eq("id", document_id).single().execute()
    document = res.data or {}
    doc_model = document.get("document_model", {})
    blocks = doc_model.get("blocks", [])
    corpus = "\n".join(str(b.get("content", "")) for b in blocks if isinstance(b.get("content"), str))
    if not corpus.strip():
        return {"reply": "I could not find text content in this document yet."}

    prompt = (
        "You are answering questions about a single document. "
        "Use only the provided document text. If missing, say so.\n\n"
        f"Document text:\n{corpus[:50000]}\n\n"
        f"User question: {message}"
    )

    if user_id:
        provider = await get_provider_for_user(user_id)
        text = await provider.generate(prompt)
    elif GENAI_API_KEY:
        model_client = genai.GenerativeModel("gemini-2.5-flash")
        response = model_client.generate_content(prompt)
        text = getattr(response, "text", None) or ""
    else:
        return {"reply": f"DEV MODE fallback. Document excerpt:\n\n{corpus[:700]}"}

    return {"reply": text or "I could not generate a response."}


async def detect_pii(document_id: str) -> Dict[str, Any]:
    res = supabase.table("documents").select("document_model").eq("id", document_id).single().execute()
    document = res.data or {}
    model = document.get("document_model", {})
    blocks = model.get("blocks", [])

    patterns = {
        "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
        "phone": re.compile(r"\+?\d[\d\s().-]{7,}\d"),
        "nin_like": re.compile(r"\b\d{11}\b"),
        "dob_like": re.compile(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b"),
    }

    findings = []
    for block in blocks:
        text = block.get("content")
        if not isinstance(text, str) or not text.strip():
            continue
        hits = []
        for label, rx in patterns.items():
            if rx.search(text):
                hits.append(label)
        if hits:
            findings.append({"block_id": block.get("id"), "pii_types": hits})

    return {"findings": findings, "count": len(findings)}
