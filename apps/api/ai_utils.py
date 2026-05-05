import os
import json
import re
from typing import Dict, Any, Optional
import google.generativeai as genai
from .supabase_client import supabase

# Configure Gemini
GENAI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

def apply_tool_call(document: Dict[str, Any], tool_call: Any) -> Dict[str, Any]:
    """Applies a single Gemini tool call to the document model with strict validation."""
    name = tool_call.name
    args = tool_call.args
    blocks = document.get("blocks", [])
    valid_block_types = {"paragraph", "heading1", "heading2", "heading3", "callout", "table", "list", "divider", "page_break"}

    if name == "RewriteBlock":
        block_id = args.get("block_id")
        new_content = args.get("new_content")
        # Validation: check if block_id exists
        found = False
        for b in blocks:
            if b["id"] == block_id:
                b["content"] = new_content
                found = True
                break
        if not found:
            print(f"Warning: AI attempted to rewrite non-existent block ID: {block_id}")

    elif name == "InsertBlock":
        after_id = args.get("after_block_id")
        block_type = args.get("block_type", "paragraph")
        
        # Validation: check if block_type is valid
        if block_type not in valid_block_types:
            print(f"Warning: AI attempted to insert invalid block type: {block_type}. Defaulting to paragraph.")
            block_type = "paragraph"

        new_block = {
            "id": f"blk_ai_{os.urandom(4).hex()}",
            "type": block_type,
            "content": args.get("content", ""),
            "confidence_score": 1.0,
            "needs_review": False,
            "style_overrides": {}
        }
        
        if after_id == "START":
            blocks.insert(0, new_block)
        else:
            found = False
            for i, b in enumerate(blocks):
                if b["id"] == after_id:
                    blocks.insert(i + 1, new_block)
                    found = True
                    break
            if not found:
                print(f"Warning: AI attempted to insert after non-existent block ID: {after_id}. Appending to end.")
                blocks.append(new_block)

    elif name == "DeleteBlock":
        block_id = args.get("block_id")
        # Validation: check if block_id exists
        initial_count = len(blocks)
        document["blocks"] = [b for b in blocks if b["id"] != block_id]
        if len(document["blocks"]) == initial_count:
             print(f"Warning: AI attempted to delete non-existent block ID: {block_id}")

    elif name == "ReorderBlocks":
        order = args.get("block_ids_in_order", [])
        block_map = {b["id"]: b for b in blocks}
        new_blocks = []
        for bid in order:
            if bid in block_map:
                new_blocks.append(block_map[bid])
            else:
                print(f"Warning: AI included non-existent ID in reorder: {bid}")
        
        # Append any blocks not mentioned in the order (safety)
        mentioned = set(order)
        for b in blocks:
            if b["id"] not in mentioned:
                new_blocks.append(b)
        document["blocks"] = new_blocks

    elif name == "UpdateStyle":
        prop = args.get("property")
        val = args.get("value")
        valid_props = {"font_family","base_font_size","line_height","margin_top","margin_bottom","heading1_color","body_color"}
        if prop not in valid_props:
            print(f"Warning: AI attempted to update invalid style property: {prop}")
            return document
            
        if "styles" not in document:
            document["styles"] = {}
        document["styles"][prop] = val

    return document

async def execute_ai_instruction(document_id: str, instruction: str) -> Dict[str, Any]:
    """Orchestrates the Gemini tool-calling loop for a document."""
    # 1. Fetch current document
    res = supabase.table("documents").select("*").eq("id", document_id).single().execute()
    document = res.data
    doc_model = document["document_model"]
    
    # 2. Build minimal context for Gemini
    doc_context = [
        {
            "id": b["id"],
            "type": b["type"],
            "preview": (b.get("content", "") or "")[:120]
        }
        for b in doc_model.get("blocks", [])
    ]

    # 3. Call Gemini with Tools
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Tool definitions (simplified as Python dicts for google-generativeai)
    tools = [
        {
            "function_declarations": [
                {
                    "name": "RewriteBlock",
                    "description": "Rewrite the content of an existing block.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "block_id": {"type": "STRING"},
                            "new_content": {"type": "STRING"},
                            "reason": {"type": "STRING"}
                        },
                        "required": ["block_id", "new_content", "reason"]
                    }
                },
                {
                    "name": "InsertBlock",
                    "description": "Insert a new block after a specific block ID (use 'START' for the beginning).",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "after_block_id": {"type": "STRING"},
                            "block_type": {"type": "STRING", "enum": ["paragraph", "heading1", "heading2", "heading3", "callout", "table", "list", "divider", "page_break"]},
                            "content": {"type": "STRING"}
                        },
                        "required": ["after_block_id", "block_type", "content"]
                    }
                },
                {
                    "name": "DeleteBlock",
                    "description": "Delete a specific block.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "block_id": {"type": "STRING"}
                        },
                        "required": ["block_id"]
                    }
                },
                {
                    "name": "ReorderBlocks",
                    "description": "Reorder all blocks in the document.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "block_ids_in_order": {"type": "ARRAY", "items": {"type": "STRING"}}
                        },
                        "required": ["block_ids_in_order"]
                    }
                }
            ]
        }
    ]

    chat = model.start_chat()
    prompt = f"""You are a document editor with access to precise editing tools.
Document structure:
{json.dumps(doc_context, indent=2)}

<user_instruction>
{instruction}
</user_instruction>

Use your tools to make the requested changes. Be precise. Only call tools for changes that are clearly needed."""

    response = chat.send_message(
        prompt,
        tools=tools,
        tool_config={"function_calling_config": {"mode": "ANY"}}
    )

    # 4. Apply Tool Calls
    updated_doc = json.loads(json.dumps(doc_model)) # Deep copy
    tool_calls_log = []
    
    for part in response.candidates[0].content.parts:
        if part.function_call:
            fn = part.function_call
            tool_calls_log.append({"name": fn.name, "args": dict(fn.args)})
            updated_doc = apply_tool_call(updated_doc, fn)

    # 5. Write Audit Log
    log_res = supabase.table("ai_edit_logs").insert({
        "document_id": document_id,
        "instruction": instruction,
        "tool_calls": tool_calls_log,
        "diff_snapshot": {
            "before": doc_model["blocks"],
            "after": updated_doc["blocks"]
        },
        "status": "pending_review"
    }).execute()

    return {
        "log_id": log_res.data[0]["id"],
        "updated_model": updated_doc,
        "tool_calls": tool_calls_log,
        "diff_snapshot": {
            "before": doc_model["blocks"],
            "after": updated_doc["blocks"]
        }
    }


async def rewrite_block_with_tone(document_id: str, block_id: str, tone: str) -> Dict[str, Any]:
    instruction = (
        f"Rewrite block {block_id} with a {tone} tone. Keep meaning intact, improve clarity, "
        "and avoid adding unsupported claims."
    )
    return await execute_ai_instruction(document_id, instruction)


async def summarise_document(document_id: str, focus: Optional[str] = None) -> Dict[str, Any]:
    focus_clause = f" Focus on: {focus}." if focus else ""
    instruction = (
        "Create a concise executive summary from this document and insert it at the top as a heading2 "
        "followed by a paragraph." + focus_clause
    )
    return await execute_ai_instruction(document_id, instruction)


async def suggest_structure(document_id: str, objective: str) -> Dict[str, Any]:
    instruction = (
        f"Suggest and apply a clearer section structure for this objective: {objective}. "
        "Use heading blocks and short transition paragraphs only where needed."
    )
    return await execute_ai_instruction(document_id, instruction)


async def expand_block(document_id: str, block_id: str, guidance: Optional[str] = None) -> Dict[str, Any]:
    guidance_clause = f" Guidance: {guidance}." if guidance else ""
    instruction = (
        f"Expand block {block_id} with useful detail while preserving intent and style." + guidance_clause
    )
    return await execute_ai_instruction(document_id, instruction)


async def continue_chapter(document_id: str, direction: Optional[str] = None) -> Dict[str, Any]:
    direction_clause = f" Narrative direction: {direction}." if direction else ""
    instruction = (
        "Continue this chapter from the end with coherent narrative progression. "
        "Insert one to three paragraph blocks at the end." + direction_clause
    )
    return await execute_ai_instruction(document_id, instruction)


async def fill_template(document_id: str, values: Dict[str, str]) -> Dict[str, Any]:
    """Deterministically fill {{PLACEHOLDER}} values and write AI audit log."""
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
    tool_calls_log = [{"name": "FillTemplatePlaceholder", "args": values}]
    log_res = supabase.table("ai_edit_logs").insert({
        "document_id": document_id,
        "instruction": "Fill template placeholders",
        "tool_calls": tool_calls_log,
        "diff_snapshot": {"before": before_blocks, "after": after_blocks},
        "status": "accepted"
    }).execute()

    unresolved = []
    placeholder_re = re.compile(r"\{\{[A-Z_]+\}\}")
    for block in after_blocks:
        content = block.get("content")
        if isinstance(content, str):
            unresolved.extend(placeholder_re.findall(content))

    return {
        "log_id": log_res.data[0]["id"] if log_res.data else None,
        "filled_blocks": filled_count,
        "unresolved_placeholders": sorted(set(unresolved)),
        "updated_model": doc_model,
    }

async def check_book_consistency(book_id: str, query: str) -> Dict[str, Any]:
    """RAG-powered cross-chapter consistency check with provenance mapping."""
    # 1. Generate embedding for query
    if not GENAI_API_KEY:
        if os.environ.get("OLPDF_DEV_MODE") == "true":
            return {"analysis": "DEV MODE: Gemini API key not configured. Returning empty analysis.", "inconsistencies": []}
        raise ValueError("GEMINI_API_KEY is not configured and OLPDF_DEV_MODE is not true.")
        
    embed_res = genai.embed_content(
        model="models/text-embedding-004",
        content=query,
        task_type="retrieval_query"
    )
    query_embedding = embed_res["embedding"]

    # 2. Vector search via Supabase RPC
    # RPC should return chapter_id and potentially chunk_index (content is assumed to be chunked)
    passages = supabase.rpc("match_chapter_embeddings", {
        "query_embedding": query_embedding,
        "book_id": book_id,
        "match_threshold": 0.75,
        "match_count": 8
    }).execute()

    if not passages.data:
        return {"analysis": "No relevant passages found for this query.", "inconsistencies": []}

    # Build context with clear identifiers for provenance
    # passages.data elements should have 'content', 'chapter_id', and 'chunk_index' (added to match_chapter_embeddings)
    context_list = []
    passage_map: Dict[str, Dict[str, Any]] = {}
    for i, p in enumerate(passages.data):
        pid = f"PASSAGE_{i}"
        p["passage_id"] = pid
        passage_map[pid] = p
        context_list.append(f"[{pid}] (Chapter: {p.get('chapter_id')}, Chunk: {p.get('chunk_index', 'N/A')}):\n{p['content']}")
    
    context = "\n\n".join(context_list)

    # 3. Analyze with Gemini
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"""You are a book editor checking for consistency.

Query: {query}

Retrieved passages (semantically relevant):
{context}

Based ONLY on the passages above, identify any inconsistencies. 
For every inconsistency, you MUST cite the passage ID (e.g., PASSAGE_0).
If no inconsistencies, say so clearly.

Format your response as JSON with two keys:
- 'analysis': A detailed string explaining your findings.
- 'inconsistencies': A list of objects with:
    - 'passage_id': The ID of the cited passage.
    - 'content': The relevant text from that passage.
    - 'issue': A description of the inconsistency.
"""

    response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
    result = json.loads(response.text)
    
    # Map back provenance from passage_id
    # Fetch all chapters for this book to get titles
    ch_titles_res = supabase.table("book_chapters").select("id, title").eq("book_id", book_id).execute()
    title_map = {c["id"]: c["title"] for c in ch_titles_res.data}

    final_inconsistencies = []
    for inc in result.get("inconsistencies", []):
        pid = inc.get("passage_id")
        if pid in passage_map:
            cid = passage_map[pid].get("chapter_id")
            final_inconsistencies.append({
                **inc,
                "chapter_id": cid,
                "chapter_title": title_map.get(cid, "Unknown Chapter"),
                "chunk_index": passage_map[pid].get("chunk_index")
            })
        else:
            final_inconsistencies.append(inc)
    
    return {
        "analysis": result.get("analysis"),
        "inconsistencies": final_inconsistencies,
        "passages_checked": len(passages.data)
    }
