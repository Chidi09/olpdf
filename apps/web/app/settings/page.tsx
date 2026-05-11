"use client";

import { useEffect, useState } from "react";
import {
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/layout/PageShell";

function ProviderIcon({ slug, color, size = 18 }: { slug: string; color: string; size?: number }) {
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

const PROVIDERS = [
  {
    id: "gemini_free",
    label: "OLPDF Free",
    sublabel: "Gemini 2.5 Flash",
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
      });
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
        setSaveMsg("Settings saved successfully.");
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
      <div className="max-w-5xl space-y-10">
        <div className="mb-8 border-b border-[var(--border-subtle)] pb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Manage your account, preferences, and AI integrations.</p>
        </div>

        <section className="grid gap-8 border-b border-[var(--border-subtle)] pb-10 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Account details</h2>
            <p className="pr-4 text-xs leading-relaxed text-[var(--text-secondary)]">Your profile identity and authentication provider details.</p>
          </div>
          <div className="md:col-span-2">
            <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div className="grid flex-1 gap-4 p-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Email Address</label>
                  <div className="flex h-9 items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]">
                    {user?.email || "user@example.com"}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Auth Mode</label>
                  <div className="flex h-9 items-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)]">
                    Backend Session
                  </div>
                </div>
              </div>
              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] px-5 py-3 text-xs text-[var(--text-tertiary)]">
                Identity linking will be available in a future update.
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 border-b border-[var(--border-subtle)] pb-10 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">AI Engine</h2>
            <p className="pr-4 text-xs leading-relaxed text-[var(--text-secondary)]">Choose your AI provider. Bring your own key for any supported model, or use our free tier.</p>
          </div>
          <div className="md:col-span-2">
            <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div className="space-y-6 p-5">
                <div>
                  <label className="mb-2.5 block text-xs font-medium text-[var(--text-primary)]">Select Provider</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {PROVIDERS.map((p) => {
                      const active = provider === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setProvider(p.id);
                            setModel(p.models[0]);
                          }}
                          className={`flex flex-col rounded-md border p-3 text-left transition-all ${
                            active
                              ? "border-[var(--accent)] bg-[var(--bg-elevated)]"
                              : "border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]"
                          }`}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <ProviderIcon slug={p.iconSlug} color={active ? p.accent : "#888888"} size={16} />
                            <span className="text-xs font-semibold text-[var(--text-primary)]">{p.label}</span>
                          </div>
                          <span className="text-[10px] text-[var(--text-tertiary)]">{p.sublabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-primary)]">Model</label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="h-9 w-full appearance-none rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]"
                    >
                      {selectedProvider.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {selectedProvider.requiresKey && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-primary)]">API Key</label>
                      <div className="relative">
                        <input
                          type={showKey ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={keySet ? "Enter new key to replace saved key" : "sk-..."}
                          className="h-9 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] pl-3 pr-10 font-mono text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
                        >
                          {showKey ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] px-5 py-3">
                <span className={`text-xs ${saveMsg?.toLowerCase().includes("fail") || saveMsg?.toLowerCase().includes("error") ? "text-red-400" : "text-[var(--text-tertiary)]"}`}>
                  {saveMsg || "Please use a valid API key when required by provider."}
                </span>
                <div className="flex items-center gap-2">
                  {keySet && (
                    <button
                      onClick={handleClearKey}
                      disabled={clearing}
                      className="h-8 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]"
                    >
                      {clearing ? "Clearing..." : "Clear Key"}
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-8 rounded-md bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-[#e5e5e5]"
                  >
                    {saving ? "Saving..." : "Save Config"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Danger Zone</h2>
            <p className="pr-4 text-xs leading-relaxed text-[var(--text-secondary)]">Export your data archive, or permanently delete your account and all associated data.</p>
          </div>
          <div className="md:col-span-2 space-y-4">
            <div className="flex flex-col gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Export Data Archive</h3>
                <p className="text-xs text-[var(--text-secondary)]">Download your documents, books, and metadata as JSON.</p>
              </div>
              <button
                onClick={() => window.open("/api/bff/account/export-data", "_blank")}
                className="h-9 shrink-0 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)]"
              >
                Request Export
              </button>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-red-500/25 bg-red-500/7 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="mb-1 text-sm font-semibold text-red-400">Delete Account</h3>
                <p className="text-xs text-red-300/80">This action is irreversible and will delete all documents.</p>
              </div>
              <button
                onClick={async () => {
                  if (window.confirm("Are you absolutely sure? This cannot be undone.")) {
                    const res = await fetch("/api/bff/account/delete", { method: "DELETE" }).catch(() => null);
                    if (res?.ok) {
                      alert("Account deleted.");
                      window.location.href = "/login";
                    } else {
                      alert("Failed. Please try again or contact support.");
                    }
                  }
                }}
                className="h-9 shrink-0 rounded-md bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-500"
              >
                Delete Account
              </button>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-3 text-xs text-[var(--text-tertiary)]">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4" />
              <span>Provider credentials are encrypted at rest and never returned in API responses.</span>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
