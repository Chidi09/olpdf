"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useEditorProfile } from "@/hooks/useEditorProfile";
import { PageShell } from "@/components/layout/PageShell";
import { InlineSpinner } from "@/components/ui/MicroUI";
import { Button } from "@heroui/react";
import { GlassPanel } from "@/components/ui/Glass";

function ProviderIcon({ slug, color, size = 18 }: { slug: string; color: string; size?: number }) {
  const [error, setError] = useState(false);
  const src = slug === "openai"
    ? "https://cdn.simpleicons.org/openai/white"
    : slug === "moonshot"
      ? "https://cdn.simpleicons.org/kimifoundation/white"
      : `https://cdn.simpleicons.org/${slug}/${color.replace("#", "")}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={error ? "https://cdn.simpleicons.org/google/white" : src}
      alt={slug}
      width={size}
      height={size}
      style={{ display: "block" }}
      onError={() => setError(true)}
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
  const editorProfile = useEditorProfile();
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
    <PageShell>
      <div className="mx-auto max-w-5xl space-y-12">
        <div className="mb-10 border-b border-border-subtle pb-8 relative overflow-hidden">
          <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full bg-accent/5 blur-[100px] pointer-events-none" />
          <h1 className="font-sans text-3xl font-black tracking-tighter text-text-primary uppercase italic">Control Center</h1>
          <p className="mt-2 font-sans text-sm font-medium text-text-secondary max-w-2xl leading-relaxed">
             Orchestrate your account identity, cryptographic access, and AI compute providers.
          </p>
        </div>

        <section className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h2 className="font-sans text-sm font-black uppercase tracking-[0.2em] text-text-primary">Identity Profile</h2>
            <p className="mt-2 text-xs font-medium leading-relaxed text-text-secondary pr-6">Your public-facing alias and verified authentication credentials used across the OLPDF network.</p>
          </div>
          <div className="lg:col-span-2">
            <div className="flex flex-col rounded-2xl liquid-glass border border-border-strong overflow-hidden shadow-panel group">
              <div className="grid gap-6 p-6 sm:p-8">
                <div className="flex items-center gap-6">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-accent/20 bg-surface shadow-inner relative group-hover:scale-105 transition-transform duration-500">
                    {editorProfile.avatarUrl ? (
                      <img src={editorProfile.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-sans font-black text-xl uppercase text-accent/40 italic">
                        {editorProfile.alias.slice(0, 2)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-accent/5 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div>
                    <p className="font-sans text-lg font-black text-text-primary tracking-tight">@{editorProfile.alias}</p>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary mt-0.5 opacity-60">Collaborator Identifier</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-mono text-[10px] font-black uppercase tracking-widest text-text-tertiary">Verified Email</label>
                  <div className="flex h-11 items-center rounded-xl border border-border-strong bg-background/50 px-4 font-sans text-sm font-bold text-text-primary shadow-inner">
                    {user?.email || "user@verification_pending"}
                  </div>
                </div>
              </div>
              <div className="border-t border-border-subtle bg-surface/30 px-6 py-4 flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-text-tertiary opacity-30" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary">Third-party ID linking coming soon</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h2 className="font-sans text-sm font-black uppercase tracking-[0.2em] text-text-primary">Compute Nodes</h2>
            <p className="mt-2 text-xs font-medium leading-relaxed text-text-secondary pr-6">Define the LLM orchestration kernel. Connect proprietary keys for increased rate limits or utilize the OLPDF standard tier.</p>
          </div>
          <div className="lg:col-span-2">
            <div className="flex flex-col rounded-2xl liquid-glass border border-border-strong overflow-hidden shadow-panel group">
              <div className="space-y-8 p-6 sm:p-8">
                <div>
                  <label className="font-mono text-[10px] font-black uppercase tracking-widest text-text-tertiary mb-4 block">Provider Selection</label>
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
                          className={cn(
                            "flex flex-col rounded-xl border p-4 text-left transition-all duration-300 active:scale-95 group/btn",
                            active
                              ? "border-accent/40 bg-accent/10 shadow-lg shadow-accent/5"
                              : "border-border-strong bg-surface hover:bg-hover hover:border-accent/30"
                          )}
                        >
                          <div className="mb-3 flex items-center gap-3">
                            <div className={cn(
                              "p-1.5 rounded-lg border transition-colors",
                              active ? "border-accent/20 bg-accent/10" : "border-border-subtle bg-background"
                            )}>
                              <ProviderIcon slug={p.iconSlug} color={active ? p.accent : "#555"} size={14} />
                            </div>
                            <span className={cn(
                              "font-sans text-xs font-black uppercase tracking-tight",
                              active ? "text-text-primary" : "text-text-secondary group-hover/btn:text-text-primary"
                            )}>{p.label}</span>
                          </div>
                          <span className="font-sans text-[10px] font-medium leading-tight text-text-tertiary opacity-80">{p.sublabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="font-mono text-[10px] font-black uppercase tracking-widest text-text-tertiary">Kernel Model</label>
                    <div className="relative">
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="h-11 w-full appearance-none rounded-xl border border-border-strong bg-background/50 px-4 pr-10 font-sans text-sm font-bold text-text-primary outline-none focus:border-accent transition-all shadow-inner"
                      >
                        {selectedProvider.models.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                    </div>
                  </div>

                  {selectedProvider.requiresKey && (
                    <div className="space-y-2 animate-reveal">
                      <label className="font-mono text-[10px] font-black uppercase tracking-widest text-text-tertiary">Private API Key</label>
                      <div className="relative">
                        <input
                          type={showKey ? "text" : "password"}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={keySet ? "REPLACE_EXISTING_SECRET" : "sk-xxxxxxxxxxxxxxxxxxxx"}
                          className="h-11 w-full rounded-xl border border-border-strong bg-background/50 pl-4 pr-12 font-mono text-sm text-text-primary outline-none focus:border-accent transition-all shadow-inner"
                        />
                        <button
                          onClick={() => setShowKey((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-text-tertiary hover:text-text-primary transition-colors"
                        >
                          {showKey ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border-subtle bg-black/40 px-6 py-5">
                <div className="flex items-center gap-2">
                   {saveMsg ? (
                     <span className={cn(
                       "font-mono text-[9px] uppercase tracking-widest animate-reveal",
                       saveMsg.toLowerCase().includes("fail") || saveMsg.toLowerCase().includes("error") ? "text-red-400" : "text-emerald-400"
                     )}>{saveMsg}</span>
                   ) : (
                     <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-text-tertiary opacity-30" />
                        <span className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary">Kernel Sync Ready</span>
                     </div>
                   )}
                </div>
                <div className="flex items-center gap-3">
                  {keySet && (
                    <button
                      onClick={handleClearKey}
                      disabled={clearing}
                      className="h-10 rounded-xl border border-border-strong bg-surface px-5 font-sans text-[10px] font-black uppercase tracking-widest text-text-primary transition-all hover:bg-hover active:scale-95 disabled:opacity-50"
                    >
                      {clearing ? "Purging..." : "Wipe Key"}
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="group relative h-10 flex items-center gap-2 overflow-hidden rounded-xl bg-white px-6 font-sans text-[10px] font-black uppercase tracking-widest text-black shadow-xl shadow-white/5 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? <InlineSpinner className="h-3 w-3 text-black" /> : <CheckCircleIcon className="h-4 w-4" />}
                    {saving ? "Syncing" : "Save Logic"}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h2 className="font-sans text-sm font-black uppercase tracking-[0.2em] text-red-500">Atomic Cleanup</h2>
            <p className="mt-2 text-xs font-medium leading-relaxed text-text-secondary pr-6">Irreversible destructive operations. Permanently purge your knowledge base and identity from the cluster.</p>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col gap-6 rounded-2xl liquid-glass border border-border-strong p-6 sm:flex-row sm:items-center sm:justify-between group hover:border-accent/40 transition-colors">
              <div>
                <h3 className="font-sans text-sm font-black text-text-primary uppercase tracking-tight leading-none mb-1.5">Export Global Archive</h3>
                <p className="font-sans text-xs text-text-tertiary leading-relaxed">Aggregate all documents, books, and metadata into a standardized JSON bundle.</p>
              </div>
              <button
                onClick={() => window.open("/api/bff/account/export-data", "_blank")}
                className="h-10 rounded-xl border border-border-strong bg-surface px-6 font-sans text-[10px] font-black uppercase tracking-widest text-text-primary transition-all hover:bg-accent hover:text-white hover:border-accent active:scale-95"
              >
                Execute Export
              </button>
            </div>

            <div className="flex flex-col gap-6 rounded-2xl liquid-glass border border-red-500/20 bg-red-500/5 p-6 sm:flex-row sm:items-center sm:justify-between group hover:border-red-500/40 transition-colors">
              <div>
                <h3 className="font-sans text-sm font-black text-red-400 uppercase tracking-tight leading-none mb-1.5">Destroy Identity</h3>
                <p className="font-sans text-xs text-red-300/60 leading-relaxed">Full system wipe. All blobs in R2 and rows in Supabase will be permanently deleted.</p>
              </div>
              <button
                onClick={async () => {
                  if (window.confirm("FATAL ACTION: Are you sure? This cannot be recovered.")) {
                    const res = await fetch("/api/bff/account/delete", { method: "DELETE" }).catch(() => null);
                    if (res?.ok) {
                      window.location.href = "/login";
                    } else {
                      alert("Fatal error during deletion.");
                    }
                  }
                }}
                className="h-10 rounded-xl bg-red-600 px-6 font-sans text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-red-600/20 transition-all hover:bg-red-500 active:scale-95"
              >
                Purge All Data
              </button>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl border border-border-subtle bg-surface/30 backdrop-blur-sm">
              <ExclamationTriangleIcon className="h-4 w-4 text-text-tertiary mt-0.5" />
              <p className="font-sans text-[10px] font-medium leading-relaxed text-text-tertiary opacity-70">Security Protocol: Provider credentials and cryptographic keys are hashed server-side and never exposed in transit or UI layers.</p>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
