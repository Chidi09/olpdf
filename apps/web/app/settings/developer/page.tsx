"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import {
  KeyIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@heroui/react";
import { GlassPanel } from "@/components/ui/Glass";
import { CopyButton } from "@/components/ui/CopyButton";
import { InlineConfirmButton } from "@/components/ui/InlineConfirmButton";

type ApiKey = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null };
type WebhookModel = { id: string; url: string; events: string[]; is_active: boolean; created_at: string };

function normalizeApiKey(value: unknown): ApiKey | null {
  if (!value || typeof value !== "object") return null;
  const key = value as Partial<ApiKey>;
  if (!key.id || !key.name || !key.prefix) return null;
  return {
    id: String(key.id),
    name: String(key.name),
    prefix: String(key.prefix),
    created_at: key.created_at ? String(key.created_at) : new Date().toISOString(),
    last_used_at: key.last_used_at ? String(key.last_used_at) : null,
  };
}

export default function DeveloperSettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [revealGenerated, setRevealGenerated] = useState(false);
  const [integrationTab, setIntegrationTab] = useState<"curl" | "javascript" | "python" | "go">("curl");

  useEffect(() => {
    Promise.all([
      fetch("/api/bff/api-keys").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/bff/webhooks").then((r) => (r.ok ? r.json() : [])),
    ]).then(([k, w]) => {
      setKeys(Array.isArray(k) ? k.map(normalizeApiKey).filter((key): key is ApiKey => Boolean(key)) : []);
      setWebhooks(w);
      setLoading(false);
    });
  }, []);

  const createApiKey = async () => {
    if (!newKeyName) return;
    const res = await fetch("/api/bff/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    if (res.ok) {
      const data = await res.json();
      setGeneratedKey(data.key);
      const createdKey = normalizeApiKey(data.api_key ?? data);
      if (createdKey) setKeys([createdKey, ...keys]);
      setNewKeyName("");
    }
  };

  const deleteApiKey = async (id: string) => {
    if (!confirm("Revoke this API key? Any applications using it will instantly fail.")) return;
    const res = await fetch(`/api/bff/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeys(keys.filter((k) => k.id !== id));
    }
  };

  const createWebhook = async () => {
    if (!newWebhookUrl) return;
    const res = await fetch("/api/bff/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newWebhookUrl, events: ["document.status_changed", "book.created"] }),
    });
    if (res.ok) {
      const data = await res.json();
      setWebhooks([data, ...webhooks]);
      setNewWebhookUrl("");
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook endpoint?")) return;
    const res = await fetch(`/api/bff/webhooks/${id}`, { method: "DELETE" });
    if (res.ok) {
      setWebhooks(webhooks.filter((w) => w.id !== id));
    }
  };

  const maskKey = (value: string) => {
    if (value.length <= 5) return `${value.slice(0, 3)}...`;
    return `${value.slice(0, 3)}...${value.slice(-2)}`;
  };

  if (loading) {
    return (
      <PageShell>
        <div className="max-w-5xl animate-pulse space-y-10">
          <div className="h-20 rounded-lg border border-[#222] bg-[#111]" />
          <div className="h-64 rounded-lg border border-[#222] bg-[#111]" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="max-w-5xl space-y-10">
        <div className="mb-8 flex items-center justify-between border-b border-[#222] pb-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Developer Settings</h1>
            <p className="mt-1 text-sm text-[#888]">Manage API keys, webhooks, and integrations.</p>
          </div>
        </div>

        <section className="grid gap-8 border-b border-[#222] pb-10 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
              <KeyIcon className="h-4 w-4 text-orange-500" /> API Keys
            </h2>
            <p className="pr-4 text-xs leading-relaxed text-[#888]">
              Manage programmatic access to your account and workspaces. Never share your secret keys.
            </p>
          </div>

          <div className="md:col-span-2">
            <GlassPanel className="flex flex-col">
              <div className="border-b border-[#222] bg-[#050505] p-5">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#666]">Generate New Key</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Key name (e.g. Production Backend)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="h-9 flex-1 rounded-md border border-[#333] bg-[#111] px-3 text-sm text-[#ededed] placeholder-[#666] outline-none transition-all focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
                  />
                  <Button
                    onClick={createApiKey}
                    isDisabled={!newKeyName}
                    size="sm"
                    className="flex h-9 items-center gap-1.5 bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-[#e5e5e5] disabled:opacity-50"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Generate
                  </Button>
                </div>

                {generatedKey && (
                  <div className="mt-4 flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <ExclamationCircleIcon className="h-5 w-5 shrink-0 text-emerald-500" />
                    <div className="flex-1">
                      <p className="mb-1 text-sm font-medium text-emerald-500">Key generated successfully</p>
                      <p className="mb-3 text-xs text-emerald-500/80">Copy this key now. You will not be able to see it again.</p>
                      <div className="flex items-center gap-2">
                        <code className={`flex-1 rounded border border-emerald-500/30 bg-black px-3 py-1.5 font-mono text-xs text-emerald-400 transition-all ${revealGenerated ? "blur-0" : "blur-sm"}`}>
                          {revealGenerated ? generatedKey : maskKey(generatedKey)}
                        </code>
                        <button
                          onClick={() => setRevealGenerated((v) => !v)}
                          className="rounded-md border border-emerald-500/30 p-1.5 text-emerald-500 transition-colors hover:bg-emerald-500/20"
                        >
                          {revealGenerated ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                        </button>
                        <CopyButton textToCopy={generatedKey} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="divide-y divide-[#222]">
                {keys.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#666]">No API keys generated yet.</div>
                ) : (
                  keys.map((key) => (
                    <div key={key.id} className="group flex items-center justify-between p-4 transition-colors hover:bg-[#111]">
                      <div>
                        <div className="mb-1 flex items-center gap-3">
                          <span className="text-sm font-medium text-[#ededed]">{key.name}</span>
                          <code className="rounded border border-[#333] bg-[#1A1A1A] px-1.5 py-0.5 font-mono text-[10px] text-[#888]">
                            {maskKey(key.prefix)}
                          </code>
                        </div>
                        <div className="text-[11px] text-[#666]">
                          Created {new Date(key.created_at).toLocaleDateString()} • Last used {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                        </div>
                      </div>
                      <div className="opacity-0 transition-opacity group-hover:opacity-100">
                        <InlineConfirmButton idleLabel="Revoke" confirmLabel="Click to confirm" onConfirm={() => deleteApiKey(key.id)} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassPanel>
          </div>
        </section>

        <section className="grid gap-8 border-b border-[#222] pb-10 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
              <GlobeAltIcon className="h-4 w-4 text-blue-500" /> Webhooks
            </h2>
            <p className="pr-4 text-xs leading-relaxed text-[#888]">
              Receive real-time HTTP POST payloads to your external servers when events happen.
            </p>
          </div>

          <div className="md:col-span-2">
            <GlassPanel className="flex flex-col">
              <div className="border-b border-[#222] bg-[#050505] p-5">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[#666]">Add Endpoint</label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    placeholder="https://api.yourdomain.com/webhooks"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    className="h-9 flex-1 rounded-md border border-[#333] bg-[#111] px-3 text-sm text-[#ededed] placeholder-[#666] outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                  />
                  <Button
                    onClick={createWebhook}
                    isDisabled={!newWebhookUrl}
                    size="sm"
                    variant="outline"
                    className="flex h-9 items-center gap-1.5 border-[#333] bg-[#111] px-4 text-xs font-semibold text-[#ededed] transition-colors hover:bg-[#1A1A1A] disabled:opacity-50"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>

              <div className="divide-y divide-[#222]">
                {webhooks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#666]">No webhooks configured.</div>
                ) : (
                  webhooks.map((webhook) => (
                    <div key={webhook.id} className="group flex items-center justify-between p-4 transition-colors hover:bg-[#111]">
                      <div>
                        <code className="mb-1.5 block font-mono text-xs text-[#ededed]">{webhook.url}</code>
                        <div className="mt-2 flex gap-1.5">
                          {webhook.events.map((ev) => (
                            <span key={ev} className="rounded border border-[#333] bg-[#111] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="opacity-0 transition-opacity group-hover:opacity-100">
                        <InlineConfirmButton idleLabel="Delete" confirmLabel="Click to confirm" onConfirm={() => deleteWebhook(webhook.id)} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassPanel>
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
              <CodeBracketIcon className="h-4 w-4 text-purple-500" /> Integration
            </h2>
            <p className="pr-4 text-xs leading-relaxed text-[#888]">
              Quick start examples using your API keys to interface with OLPDF.
            </p>
          </div>

          <div className="md:col-span-2">
            <div className="group relative overflow-hidden rounded-lg border border-[#222] bg-black">
              <div className="flex items-center justify-between border-b border-[#222] bg-[#0A0A0A] px-3 py-2">
                <div className="flex gap-1">
                  {(["curl", "javascript", "python", "go"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setIntegrationTab(tab)}
                      className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        integrationTab === tab ? "bg-white/10 text-white" : "text-[#666] hover:text-[#888]"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <CopyButton textToCopy={integrationTab === "curl" ? `curl -X POST "https://api.olpdf.xyz/api/documents/create" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title": "My Document"}'` : integrationTab === "javascript" ? `const response = await fetch("https://api.olpdf.xyz/api/documents/create", {\n  method: "POST",\n  headers: {\n    Authorization: "Bearer YOUR_API_KEY",\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({ title: "My Document" }),\n});` : integrationTab === "python" ? `import requests\n\nresponse = requests.post(\n    "https://api.olpdf.xyz/api/documents/create",\n    headers={"Authorization": "Bearer YOUR_API_KEY"},\n    json={"title": "My Document"},\n)` : `package main\n\nimport (\n    "bytes"\n    "encoding/json"\n    "net/http"\n)\n\nfunc main() {\n    body, _ := json.Marshal(map[string]string{"title": "My Document"})\n    req, _ := http.NewRequest("POST", "https://api.olpdf.xyz/api/documents/create", bytes.NewBuffer(body))\n    req.Header.Set("Authorization", "Bearer YOUR_API_KEY")\n    req.Header.Set("Content-Type", "application/json")\n    http.DefaultClient.Do(req)\n}`} />
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[#ededed]">
{integrationTab === "curl" ? `<span className="text-purple-400">curl</span> -X POST <span className="text-amber-300">"https://api.olpdf.xyz/api/documents/create"</span> \\
  -H <span className="text-amber-300">"Authorization: Bearer YOUR_API_KEY"</span> \\
  -H <span className="text-amber-300">"Content-Type: application/json"</span> \\
  -d <span className="text-emerald-400">'{"title": "My Document"}'</span>` : integrationTab === "javascript" ? `<span className="text-blue-400">const</span> response <span className="text-purple-400">=</span> <span className="text-amber-300">await</span> fetch(<span className="text-emerald-400">"https://api.olpdf.xyz/api/documents/create"</span>, {
  <span className="text-blue-400">method</span>: <span className="text-emerald-400">"POST"</span>,
  <span className="text-blue-400">headers</span>: {
    <span className="text-purple-400">Authorization</span>: <span className="text-emerald-400">"Bearer YOUR_API_KEY"</span>,
    <span className="text-purple-400">"Content-Type"</span>: <span className="text-emerald-400">"application/json"</span>,
  },
  <span className="text-blue-400">body</span>: <span className="text-purple-400">JSON</span>.<span className="text-amber-300">stringify</span>({ <span className="text-blue-400">title</span>: <span className="text-emerald-400">"My Document"</span> }),
});` : integrationTab === "python" ? `<span className="text-blue-400">import</span> <span className="text-amber-300">requests</span>

response <span className="text-purple-400">=</span> <span className="text-amber-300">requests</span>.<span className="text-blue-400">post</span>(
    <span className="text-emerald-400">"https://api.olpdf.xyz/api/documents/create"</span>,
    <span className="text-blue-400">headers</span>={<span className="text-emerald-400">"Authorization"</span>: <span className="text-emerald-400">"Bearer YOUR_API_KEY"</span>},
    <span className="text-blue-400">json</span>={<span className="text-emerald-400">"title"</span>: <span className="text-emerald-400">"My Document"</span>},
)` : `<span className="text-blue-400">package</span> <span className="text-amber-300">main</span>

<span className="text-blue-400">import</span> (
    <span className="text-emerald-400">"bytes"</span>
    <span className="text-emerald-400">"encoding/json"</span>
    <span className="text-emerald-400">"net/http"</span>
)

<span className="text-blue-400">func</span> <span className="text-purple-400">main</span>() {
    body, _ <span className="text-purple-400">:=</span> <span className="text-amber-300">json</span>.<span className="text-blue-400">Marshal</span>(<span className="text-blue-400">map</span>[<span className="text-blue-400">string</span>]<span className="text-blue-400">string</span>{<span className="text-emerald-400">"title"</span>: <span className="text-emerald-400">"My Document"</span>})
    req, _ <span className="text-purple-400">:=</span> <span className="text-amber-300">http</span>.<span className="text-blue-400">NewRequest</span>(<span className="text-emerald-400">"POST"</span>, <span className="text-emerald-400">"https://api.olpdf.xyz/api/documents/create"</span>, <span className="text-amber-300">bytes</span>.<span className="text-blue-400">NewBuffer</span>(body))
    req.<span className="text-blue-400">Header</span>.<span className="text-amber-300">Set</span>(<span className="text-emerald-400">"Authorization"</span>, <span className="text-emerald-400">"Bearer YOUR_API_KEY"</span>)
    req.<span className="text-blue-400">Header</span>.<span className="text-amber-300">Set</span>(<span className="text-emerald-400">"Content-Type"</span>, <span className="text-emerald-400">"application/json"</span>)
    <span className="text-amber-300">http</span>.<span className="text-blue-400">DefaultClient</span>.<span className="text-purple-400">Do</span>(req)
}`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
