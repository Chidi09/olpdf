"""
Provider abstraction layer — resolves the right AI backend per user and normalises
tool-call responses so ai_service.py is provider-agnostic.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import google.generativeai as genai

from ..core.supabase_client import supabase
from ..config import get_settings


# ── Provider catalogue ───────────────────────────────────────────────────────

PROVIDER_CONFIGS: Dict[str, Dict[str, Any]] = {
    "gemini_free": {
        "label": "OLPDF Free",
        "sublabel": "Gemini 2.5 Flash",
        "requires_key": False,
        "models": ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"],
        "default_model": "gemini-2.5-flash",
    },
    "gemini": {
        "label": "Google Gemini",
        "sublabel": "Custom Key",
        "requires_key": True,
        "models": ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
        "default_model": "gemini-2.5-pro",
    },
    "anthropic": {
        "label": "Anthropic",
        "sublabel": "Claude",
        "requires_key": True,
        "models": ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
        "default_model": "claude-sonnet-4-6",
    },
    "openai": {
        "label": "OpenAI",
        "sublabel": "GPT",
        "requires_key": True,
        "models": ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o4-mini", "o3", "o3-mini", "o1", "o1-mini"],
        "default_model": "gpt-4o",
        "base_url": "https://api.openai.com/v1",
    },
    "deepseek": {
        "label": "DeepSeek",
        "sublabel": "deepseek-chat · deepseek-reasoner",
        "requires_key": True,
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "default_model": "deepseek-chat",
        "base_url": "https://api.deepseek.com/v1",
    },
    "kimi": {
        "label": "Kimi",
        "sublabel": "Moonshot AI",
        "requires_key": True,
        "models": ["moonshot-v1-auto", "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k", "kimi-k2-0711-preview", "kimi-k2-turbo-preview"],
        "default_model": "moonshot-v1-auto",
        "base_url": "https://api.moonshot.cn/v1",
    },
}


# ── Normalised tool call ─────────────────────────────────────────────────────

@dataclass
class ToolCall:
    name: str
    args: Dict[str, Any]


# ── Key encryption helpers ───────────────────────────────────────────────────

def _fernet():
    from cryptography.fernet import Fernet
    settings = get_settings()
    raw = hashlib.sha256(settings.supabase_jwt_secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_key(raw: str) -> str:
    return _fernet().encrypt(raw.encode()).decode()


def decrypt_key(enc: str) -> str:
    return _fernet().decrypt(enc.encode()).decode()


# ── Schema converters ────────────────────────────────────────────────────────

def _lower_types(schema: Any) -> Any:
    """Recursively lowercase Gemini-style type strings for OpenAI/Anthropic."""
    if isinstance(schema, dict):
        out = {}
        for k, v in schema.items():
            if k == "type" and isinstance(v, str):
                out[k] = v.lower()
            else:
                out[k] = _lower_types(v)
        return out
    if isinstance(schema, list):
        return [_lower_types(i) for i in schema]
    return schema


def _to_anthropic_tools(gemini_tools: List[dict]) -> List[dict]:
    out = []
    for fn in gemini_tools[0]["function_declarations"]:
        params = _lower_types(fn["parameters"])
        out.append({
            "name": fn["name"],
            "description": fn.get("description", ""),
            "input_schema": params,
        })
    return out


def _to_openai_tools(gemini_tools: List[dict]) -> List[dict]:
    out = []
    for fn in gemini_tools[0]["function_declarations"]:
        params = _lower_types(fn["parameters"])
        out.append({
            "type": "function",
            "function": {
                "name": fn["name"],
                "description": fn.get("description", ""),
                "parameters": params,
            },
        })
    return out


# ── Provider implementations ─────────────────────────────────────────────────

class GeminiProvider:
    def __init__(self, api_key: str, model: str):
        genai.configure(api_key=api_key)
        self._model = model

    async def run_with_tools(self, prompt: str, tools: List[dict]) -> List[ToolCall]:
        model = genai.GenerativeModel(self._model)
        chat = model.start_chat()
        response = chat.send_message(
            prompt,
            tools=tools,
            tool_config={"function_calling_config": {"mode": "ANY"}},
        )
        calls = []
        for part in response.candidates[0].content.parts:
            if part.function_call:
                fn = part.function_call
                calls.append(ToolCall(name=fn.name, args=dict(fn.args)))
        return calls

    async def generate(self, prompt: str) -> str:
        model = genai.GenerativeModel(self._model)
        response = model.generate_content(prompt)
        return getattr(response, "text", "") or ""

    async def generate_json(self, prompt: str) -> dict:
        model = genai.GenerativeModel(self._model)
        response = model.generate_content(
            prompt, generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)


class AnthropicProvider:
    def __init__(self, api_key: str, model: str):
        import anthropic as _anthropic
        self._client = _anthropic.Anthropic(api_key=api_key)
        self._model = model

    async def run_with_tools(self, prompt: str, tools: List[dict]) -> List[ToolCall]:
        anthropic_tools = _to_anthropic_tools(tools)
        response = self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            tools=anthropic_tools,
            tool_choice={"type": "any"},
            messages=[{"role": "user", "content": prompt}],
        )
        calls = []
        for block in response.content:
            if block.type == "tool_use":
                calls.append(ToolCall(name=block.name, args=block.input))
        return calls

    async def generate(self, prompt: str) -> str:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text if response.content else ""

    async def generate_json(self, prompt: str) -> dict:
        text = await self.generate(prompt + "\n\nRespond with valid JSON only.")
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])


class OpenAICompatibleProvider:
    def __init__(self, api_key: str, model: str, base_url: str):
        from openai import OpenAI
        self._client = OpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    async def run_with_tools(self, prompt: str, tools: List[dict]) -> List[ToolCall]:
        openai_tools = _to_openai_tools(tools)
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            tools=openai_tools,
            tool_choice="required",
        )
        calls = []
        for tc in (response.choices[0].message.tool_calls or []):
            calls.append(ToolCall(
                name=tc.function.name,
                args=json.loads(tc.function.arguments),
            ))
        return calls

    async def generate(self, prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""

    async def generate_json(self, prompt: str) -> dict:
        text = await self.generate(prompt + "\n\nRespond with valid JSON only.")
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])


# ── Provider factory ─────────────────────────────────────────────────────────

def _build_provider(provider: str, model: Optional[str], api_key: Optional[str]):
    cfg = PROVIDER_CONFIGS.get(provider, PROVIDER_CONFIGS["gemini_free"])
    resolved_model = model or cfg["default_model"]

    if provider == "gemini_free":
        env_key = get_settings().gemini_api_key
        return GeminiProvider(api_key=env_key, model=resolved_model)

    if provider == "gemini":
        return GeminiProvider(api_key=api_key or "", model=resolved_model)

    if provider == "anthropic":
        return AnthropicProvider(api_key=api_key or "", model=resolved_model)

    if provider in ("openai", "deepseek", "kimi"):
        base_url = cfg.get("base_url", "https://api.openai.com/v1")
        return OpenAICompatibleProvider(api_key=api_key or "", model=resolved_model, base_url=base_url)

    # Fallback — free Gemini
    return GeminiProvider(api_key=get_settings().gemini_api_key, model="gemini-1.5-flash")


async def get_provider_for_user(user_id: str):
    """Load the user's preferred provider from DB, decrypt their key, return a ready provider."""
    try:
        row = (
            supabase.table("user_ai_settings")
            .select("provider, model, encrypted_api_key")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        data = row.data
    except Exception:
        data = None

    if not data:
        return _build_provider("gemini_free", None, None)

    provider = data.get("provider", "gemini_free")
    model = data.get("model")
    enc_key = data.get("encrypted_api_key")
    api_key = decrypt_key(enc_key) if enc_key else None

    return _build_provider(provider, model, api_key)
