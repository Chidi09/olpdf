"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  User,
  FileText,
  Sparkles,
  Shield,
  Trash2,
  Database,
  Check,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BackLink from "@/components/BackLink";

// ── Brand-accurate provider icons ────────────────────────────────────────────

function GeminiIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="gem-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#9B72CB" />
        </linearGradient>
      </defs>
      <path
        d="M14 2C14 2 16.5 10 22 14C16.5 18 14 26 14 26C14 26 11.5 18 6 14C11.5 10 14 2 14 2Z"
        fill="url(#gem-a)"
      />
    </svg>
  );
}

function AnthropicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#D97706" />
      <path
        d="M13.8 6h-1.8L8 18h2l.9-2.5h4.2l.9 2.5h2L13.8 6Zm-2.3 7.5 1.5-4.2 1.5 4.2h-3Z"
        fill="white"
      />
    </svg>
  );
}

function OpenAIIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#10A37F" />
      <path
        d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64A9 9 0 0 0 3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.36-2.64A9 9 0 0 0 21 12Zm-9 6.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z"
        fill="white"
        opacity="0.3"
      />
      <path
        d="M14.83 8.28a3.45 3.45 0 0 0-4.24-.54l-2.5 1.44a3.44 3.44 0 0 0-1.72 2.99v.83a3.44 3.44 0 0 0 1.72 2.99l2.5 1.44a3.45 3.45 0 0 0 4.24-.54 3.44 3.44 0 0 0 .86-3.45l-.5-1.44.5-1.44a3.44 3.44 0 0 0-.86-3.28Z"
        fill="white"
      />
    </svg>
  );
}

function DeepSeekIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#1A56E8" />
      <path
        d="M6 17c1.5-2 4-5.5 4-5.5s-1-2.5 1-4c1.5-1.1 3.5-.5 4.5.5s1.5 2.5.5 4l-1 1.5L17 17"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="15.5" cy="8.5" r="1" fill="#7DD3FC" />
    </svg>
  );
}

function KimiIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#111827" />
      <path
        d="M17 7a6 6 0 0 1 0 10M7 7a6 6 0 0 0 0 10"
        stroke="#60A5FA"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="12" cy="12" r="2.5" fill="white" />
    </svg>
  );
}

// ── Provider catalogue (mirrors backend PROVIDER_CONFIGS) ────────────────────

const PROVIDERS = [
  {
    id: "gemini_free",
    label: "OLPDF Free",
    sublabel: "Gemini 1.5 Flash — no key needed",
    requiresKey: false,
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
    icon: GeminiIcon,
    accent: "#4285F4",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    sublabel: "Claude Haiku · Sonnet · Opus",
    requiresKey: true,
    models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"],
    icon: AnthropicIcon,
    accent: "#D97706",
  },
  {
    id: "openai",
    label: "OpenAI",
    sublabel: "GPT-4o · o1 · o3",
    requiresKey: true,
    models: ["gpt-4o-mini", "gpt-4o", "o1-mini", "o3-mini"],
    icon: OpenAIIcon,
    accent: "#10A37F",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    sublabel: "deepseek-chat · deepseek-reasoner",
    requiresKey: true,
    models: ["deepseek-chat", "deepseek-reasoner"],
    icon: DeepSeekIcon,
    accent: "#1A56E8",
  },
  {
    id: "kimi",
    label: "Kimi",
    sublabel: "Moonshot AI",
    requiresKey: true,
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    icon: KimiIcon,
    accent: "#3B82F6",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    sublabel: "Custom key — higher limits",
    requiresKey: true,
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-pro-preview-05-06"],
    icon: GeminiIcon,
    accent: "#9B72CB",
  },
] as const;

type ProviderId = typeof PROVIDERS[number]["id"];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [provider, setProvider] = useState<ProviderId>("gemini_free");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const selectedProvider = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  useEffect(() => {
    fetch("/api/bff/ai-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.provider) setProvider(data.provider as ProviderId);
        if (data.model) setModel(data.model);
        setKeySet(!!data.key_set);
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, []);

  // Reset model when provider changes
  useEffect(() => {
    const cfg = PROVIDERS.find((p) => p.id === provider);
    if (cfg) setModel(cfg.models[0]);
  }, [provider]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const body: Record<string, string> = { provider, model };
      if (apiKey) body.api_key = apiKey;
      const res = await fetch("/api/bff/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSaveMsg(err.detail || "Failed to save.");
      } else {
        setSaveMsg("Saved!");
        setKeySet(apiKey ? true : keySet);
        setApiKey("");
      }
    } catch {
      setSaveMsg("Network error.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const handleClearKey = async () => {
    setClearing(true);
    await fetch("/api/bff/ai-settings", { method: "DELETE" }).catch(() => {});
    setKeySet(false);
    setApiKey("");
    setProvider("gemini_free");
    setModel(PROVIDERS[0].models[0]);
    setClearing(false);
    setSaveMsg("Reverted to free tier.");
    setTimeout(() => setSaveMsg(null), 3000);
  };

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24 transition-colors duration-300">
      {/* Header */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] pt-16 pb-12 px-6">
        <div className="mx-auto max-w-4xl">
          <BackLink href="/dashboard" label="Back to workspace" className="mb-8" />
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 flex items-center gap-4">
            <Settings className="h-10 w-10 text-[var(--accent)]" /> Settings
          </h1>
          <p className="max-w-2xl text-[var(--text-secondary)] text-lg leading-relaxed font-medium">
            Configure your document operating system, AI provider, and security defaults.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16 space-y-16">

        {/* Account Section */}
        <section className="grid md:grid-cols-3 gap-8">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 mb-2">
              <User className="h-5 w-5 text-blue-500" /> Account
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] font-medium leading-relaxed">
              Your profile identity and authentication provider details.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-sm space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">Display Name</label>
                <input type="text" defaultValue="Guest User" className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--accent)] transition-all" />
              </div>
              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold mb-0.5">Auth Provider</div>
                  <div className="text-[10px] font-medium text-emerald-500 flex items-center gap-1">
                    <div className="h-1 w-1 rounded-full bg-emerald-500" /> Local Guest Mode
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-full px-4 text-[10px] font-black uppercase border-[var(--border-strong)]">Link Provider</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Document Defaults */}
        <section className="grid md:grid-cols-3 gap-8">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-purple-500" /> Documents
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] font-medium leading-relaxed">
              Global defaults for every new project.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">Standard Page Size</label>
                  <select className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--accent)] appearance-none transition-all">
                    <option>ISO A4 (210 × 297 mm)</option>
                    <option>US Letter (8.5 × 11 in)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">Export Standard</label>
                  <select className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--accent)] appearance-none transition-all">
                    <option>PDF/A-2b Archival</option>
                    <option>Tagged PDF (UA)</option>
                    <option>EPUB 3.0</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Engine */}
        <section className="grid md:grid-cols-3 gap-8">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-amber-500" /> AI Engine
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] font-medium leading-relaxed">
              Choose your AI provider. Bring your own key for any supported model, or use our free Gemini tier.
            </p>
          </div>
          <div className="md:col-span-2 space-y-5">

            {/* Provider picker */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3 block">Provider</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PROVIDERS.map((p) => {
                  const Icon = p.icon;
                  const active = provider === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`relative flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-all ${
                        active
                          ? "border-transparent ring-2 bg-[var(--bg-surface)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"
                      }`}
                      style={active ? { ringColor: p.accent, boxShadow: `0 0 0 2px ${p.accent}` } : {}}
                    >
                      <Icon size={22} />
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate">{p.label}</div>
                        {!p.requiresKey && (
                          <div className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Free</div>
                        )}
                      </div>
                      {active && (
                        <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full flex items-center justify-center" style={{ background: p.accent }}>
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedProvider && (
                <p className="text-[11px] text-[var(--text-tertiary)] mt-2 font-medium">{selectedProvider.sublabel}</p>
              )}
            </div>

            {/* Model picker */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--accent)] appearance-none transition-all"
              >
                {selectedProvider?.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* API Key input — only shown when provider requires key */}
            {selectedProvider?.requiresKey && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">
                  API Key
                  {keySet && provider !== "gemini_free" && (
                    <span className="ml-2 text-emerald-500 normal-case font-bold">● Saved</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={keySet ? "Enter new key to replace saved key" : "sk-... or your provider key"}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 pr-20 text-sm font-mono focus:outline-none focus:border-[var(--accent)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 font-medium">
                  Keys are encrypted at rest and never exposed in responses.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handleSave}
                disabled={saving || loadingSettings}
                className="rounded-full px-6 font-black text-sm bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              {keySet && (
                <Button
                  variant="ghost"
                  onClick={handleClearKey}
                  disabled={clearing}
                  className="rounded-full px-4 text-xs font-bold text-[var(--text-tertiary)] hover:text-[var(--status-error)] flex items-center gap-1.5 transition-colors"
                >
                  <X className="h-3 w-3" /> {clearing ? "Clearing…" : "Clear key & revert to free"}
                </Button>
              )}
              {saveMsg && (
                <span className={`text-xs font-bold ${saveMsg === "Saved!" || saveMsg.includes("free") ? "text-emerald-500" : "text-red-500"}`}>
                  {saveMsg}
                </span>
              )}
            </div>

          </div>
        </section>

        {/* Data & Privacy */}
        <section className="grid md:grid-cols-3 gap-8 pt-8 border-t border-[var(--border-subtle)]">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-red-500" /> Data & Safety
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] font-medium leading-relaxed">
              Manage retention, export your data, or delete your account.
            </p>
          </div>
          <div className="md:col-span-2">
            <div className="bg-[var(--bg-elevated)] p-8 rounded-3xl border border-[var(--border-subtle)] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="font-bold mb-1">Export Data Archive</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-sm">
                    Download a machine-readable JSON archive of all your documents, books, and metadata.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => window.open("/api/bff/account/export-data", "_blank")}
                  className="border-[var(--border-strong)] font-black rounded-full px-6 transition-all shrink-0"
                >
                  <Database className="h-4 w-4 mr-2 text-blue-500" /> Request Export
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h3 className="font-bold mb-1 text-red-500">Delete Account</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-sm">
                    Permanently deletes your account, local data, and all cloud artifacts. Irreversible.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    if (window.confirm("Are you absolutely sure? This cannot be undone.")) {
                      const res = await fetch("/api/bff/account/delete", { method: "DELETE" }).catch(() => null);
                      if (res?.ok) { alert("Account deleted."); window.location.href = "/login"; }
                      else alert("Failed. Please try again or contact support.");
                    }
                  }}
                  className="bg-red-500 text-white font-black rounded-full px-6 hover:bg-red-600 transition-all shrink-0"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Account
                </Button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
