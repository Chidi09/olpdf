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
import { useAuth } from "@/hooks/useAuth";

// ── Provider icon via Simple Icons CDN ───────────────────────────────────────
// cdn.simpleicons.org/{slug}/{hex-color} returns a coloured SVG at runtime.

function ProviderIcon({ slug, color, size = 22 }: { slug: string; color: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://cdn.simpleicons.org/${slug}/${color.replace("#", "")}`}
      alt={slug}
      width={size}
      height={size}
      style={{ display: "block" }}
    />
  );
}

// ── Provider catalogue (mirrors backend PROVIDER_CONFIGS) ────────────────────

const PROVIDERS = [
  {
    id: "gemini_free",
    label: "OLPDF Free",
    sublabel: "Gemini 2.5 Flash — no key needed",
    requiresKey: false,
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"],
    iconSlug: "googlegemini",
    accent: "#4285F4",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    sublabel: "Claude Opus · Sonnet · Haiku",
    requiresKey: true,
    models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    iconSlug: "anthropic",
    accent: "#D97706",
  },
  {
    id: "openai",
    label: "OpenAI",
    sublabel: "GPT-4.1 · GPT-4o · o4-mini · o3",
    requiresKey: true,
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o4-mini", "o3", "o3-mini", "o1", "o1-mini"],
    iconSlug: "openai",
    accent: "#10A37F",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    sublabel: "V3 (chat) · R1 (reasoner)",
    requiresKey: true,
    models: ["deepseek-chat", "deepseek-reasoner"],
    iconSlug: "deepseek",
    accent: "#4D6BFE",
  },
  {
    id: "kimi",
    label: "Kimi",
    sublabel: "Moonshot AI — long context",
    requiresKey: true,
    models: ["moonshot-v1-auto", "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k", "kimi-k2-0711-preview", "kimi-k2-turbo-preview"],
    iconSlug: "moonshot",
    accent: "#3B82F6",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    sublabel: "Custom key — higher limits",
    requiresKey: true,
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
    iconSlug: "googlegemini",
    accent: "#9B72CB",
  },
] as const;

type ProviderId = typeof PROVIDERS[number]["id"];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
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
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then((data) => {
        if (data.provider) setProvider(data.provider as ProviderId);
        if (data.model) setModel(data.model);
        else if (data.provider) {
          const p = PROVIDERS.find((x) => x.id === data.provider);
          if (p) setModel(p.models[0]);
        }
        setKeySet(!!data.key_set);
      })
      .catch(() => {
        setSaveMsg("Failed to load settings.");
      })
      .finally(() => setLoadingSettings(false));
  }, []);


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
    <PageShell title="Settings">
      <div className="space-y-16">

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
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">Email</p>
                  <p className="mt-1 text-sm font-bold break-all">{user?.email || "Not available"}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">Auth Mode</p>
                  <p className="mt-1 text-sm font-bold">Backend Session</p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Identity linking and profile editing will be added in a dedicated account panel.</p>
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
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">Default Page Size</p>
                  <p className="mt-1 text-sm font-bold">A4</p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">Default Export</p>
                  <p className="mt-1 text-sm font-bold">PDF/A</p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-4">Document defaults are currently set globally by the platform and will become user-configurable soon.</p>
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
                  const active = provider === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setProvider(p.id); setModel(p.models[0]); }}
                      className={`relative flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-all ${
                        active
                          ? "border-transparent bg-[var(--bg-surface)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"
                      }`}
                      style={active ? { boxShadow: `0 0 0 2px ${p.accent}` } : {}}
                    >
                      <ProviderIcon slug={p.iconSlug} color={p.accent} size={22} />
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
    </PageShell>
  );
}
