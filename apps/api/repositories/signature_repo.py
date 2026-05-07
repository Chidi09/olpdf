from typing import Any, Dict, List, Optional
from ..core.supabase_client import supabase


class SignatureRepository:
    @staticmethod
    def get_request(request_id: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("signature_requests").select("*, signature_fields(*)").eq("id", request_id).single().execute()
        return res.data

    @staticmethod
    def create_request(document_id: str, requester_id: str) -> Dict[str, Any]:
        return supabase.table("signature_requests").insert({"document_id": document_id, "requester_id": requester_id, "status": "pending"}).execute().data[0]

    @staticmethod
    def create_field(request_id: str, signer_email: str, token: str) -> Dict[str, Any]:
        return supabase.table("signature_fields").insert({"request_id": request_id, "signer_email": signer_email, "token": token}).execute().data[0]

    @staticmethod
    def get_field_by_token(token: str) -> Optional[Dict[str, Any]]:
        res = supabase.table("signature_fields").select("*, signature_requests(*)").eq("token", token).single().execute()
        return res.data

    @staticmethod
    def sign_field(field_id: str, signature_data: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> None:
        from datetime import datetime
        supabase.table("signature_fields").update({"signed_at": datetime.utcnow().isoformat(), "signature_data": signature_data, "ip_address": ip_address, "user_agent": user_agent}).eq("id", field_id).execute()

    @staticmethod
    def complete_request(request_id: str) -> None:
        from datetime import datetime
        supabase.table("signature_requests").update({"status": "completed", "completed_at": datetime.utcnow().isoformat()}).eq("id", request_id).execute()

    @staticmethod
    def all_fields_signed(request_id: str) -> bool:
        fields = supabase.table("signature_fields").select("signed_at").eq("request_id", request_id).execute().data
        return bool(fields) and all(f.get("signed_at") for f in fields)
