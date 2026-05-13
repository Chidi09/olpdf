def apikey(key_hash: str) -> str:
    return f"olpdf:apikey:{key_hash}"

def workspace_member(user_id: str, workspace_id: str) -> str:
    return f"olpdf:member:{workspace_id}:{user_id}"

def workspace(workspace_id: str) -> str:
    return f"olpdf:ws:{workspace_id}"

def document(doc_id: str) -> str:
    return f"olpdf:doc:{doc_id}"

def ai_settings(user_id: str) -> str:
    return f"olpdf:aisettings:{user_id}"

def templates_published() -> str:
    return "olpdf:templates:published"

def template(template_id: str) -> str:
    return f"olpdf:template:{template_id}"

def export_status(job_id: str) -> str:
    return f"olpdf:export:{job_id}"
