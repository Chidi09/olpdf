import httpx
from typing import Any, Dict, Optional


class OlpdfClient:
    """Synchronous OLPDF API client."""

    def __init__(self, api_key: str, base_url: str = "https://api.olpdf.xyz"):
        self._base = base_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        resp = httpx.post(f"{self._base}{path}", headers=self._headers, json=body)
        resp.raise_for_status()
        return resp.json()

    def extract(self, url: str, mode: str = "semantic") -> Dict[str, Any]:
        """Extract semantic blocks from a PDF URL."""
        return self._post("/v1/extract", {"url": url, "mode": mode})

    def rewrite(self, document_id: str, instruction: str) -> Dict[str, Any]:
        """Run an AI instruction against a document."""
        return self._post(
            f"/api/ai/documents/{document_id}/instruction",
            {"instruction": instruction},
        )

    def export(self, document_id: str, fmt: str = "pdf") -> bytes:
        """Export a document. fmt: 'pdf' | 'epub' | 'pdf_a'."""
        resp = httpx.post(
            f"{self._base}/api/documents/{document_id}/export/{fmt}",
            headers=self._headers,
        )
        resp.raise_for_status()
        return resp.content
