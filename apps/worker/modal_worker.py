import modal
import os
import io
import json
import httpx
from typing import List, Dict, Any
from PIL import Image as PILImage
import numpy as np
import cv2
from fastapi import Request

# Define the Modal App
app = modal.App("olpdf-ocr-worker")

# Define the image with all dependencies
image = (
    modal.Image.debian_slim()
    .pip_install(
        "surya-ocr",
        "paddlepaddle-gpu",
        "paddleocr",
        "opencv-python-headless",
        "httpx",
        "supabase",
        "pymupdf" # for PDF rendering to images
    )
)

@app.function(
    image=image,
    gpu="T4",
    timeout=600,
    secrets=[
        modal.Secret.from_name("olpdf-secrets") # Should contain SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
    ]
)
async def process_ocr_pages(document_id: str, page_indices: List[int]) -> Dict[str, Any]:
    """GPU worker: OCR + layout reconstruction for scanned pages."""
    from surya.ocr import run_ocr
    from surya.model.detection.segformer import load_model as load_det_model
    from surya.model.recognition.model import load_model as load_rec_model
    import fitz # PyMuPDF
    from supabase import create_client, Client

    # 1. Setup Supabase Client
    sb_url = os.environ.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase: Client = create_client(sb_url, sb_key)

    # 2. Download PDF from Storage
    res = supabase.storage.from_("user-uploads").download(f"{document_id}.pdf")
    doc = fitz.open(stream=res, filetype="pdf")

    # 3. Load Surya Models
    det_model, det_processor = load_det_model(), None
    rec_model, rec_processor = load_rec_model(), None

    all_ocr_blocks = []

    for i, page_idx in enumerate(page_indices):
        if page_idx >= len(doc):
            continue
            
        # Render page to image
        page = doc[page_idx]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # 2x zoom for better OCR
        img_data = pix.tobytes("png")
        
        # Convert to PIL Image
        pil_img = PILImage.open(io.BytesIO(img_data)).convert("RGB")
        
        # Run Surya OCR
        ocr_result = run_ocr([pil_img], [["en"]], det_model, det_processor, rec_model, rec_processor)
        
        # Build blocks from results
        for line in ocr_result[0].text_lines:
            confidence = float(line.confidence)
            all_ocr_blocks.append({
                "id": f"blk_ocr_{page_idx}_{len(all_ocr_blocks)}",
                "type": infer_block_type(line),
                "content": line.text,
                "confidence_score": confidence,
                "needs_review": confidence < 0.8,
                "bounding_box": [float(c) for i, c in enumerate(line.bbox)],
                "style_overrides": {}
            })

        # Update progress in Supabase
        progress = int(((i + 1) / len(page_indices)) * 100)
        supabase.table("documents").update({"import_progress": progress}).eq("id", document_id).execute()

    # 4. Final Merge: Fetch current blocks and append OCR blocks
    doc_res = supabase.table("documents").select("document_model").eq("id", document_id).single().execute()
    current_model = doc_res.data.get("document_model", {"blocks": []})
    current_blocks = current_model.get("blocks", [])
    
    # Sort blocks by page and position (optional, but good for UX)
    final_blocks = current_blocks + all_ocr_blocks
    
    supabase.table("documents").update({
        "document_model": {"blocks": final_blocks},
        "status": "ready",
        "import_progress": 100
    }).eq("id", document_id).execute()

    return {"status": "success", "blocks_added": len(all_ocr_blocks)}

def infer_block_type(line: Any) -> str:
    """Simple heuristic for block type inference from OCR line."""
    text = line.text.strip()
    # bbox is [x0, y0, x1, y1]
    height = line.bbox[3] - line.bbox[1]
    
    if height > 25:
        return "heading1"
    elif height > 18:
        return "heading2"
    elif text.startswith("•") or text.startswith("-"):
        return "list"
    else:
        return "paragraph"

@app.function(image=image)
@modal.web_endpoint(method="POST")
async def process_ocr_webhook(request: Request):
    """Webhook entry point for QStash."""
    payload = await request.json()
    document_id = payload.get("document_id")
    page_indices = payload.get("page_indices", [])
    
    # Spawn the heavy GPU task
    process_ocr_pages.spawn(document_id, page_indices)
    
    return {"status": "accepted"}
