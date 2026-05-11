"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Key, Webhook, Code2, Plus, Trash2, Copy, CheckCircle2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ApiKey = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null };
type WebhookModel = { id: string; url: string; events: string[]; is_active: boolean; created_at: string };

export default function DeveloperSettingsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookModel[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  
  const [copied, setCopied] = useState(false);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/bff/api-keys").then(r => r.ok ? r.json() : []),
      fetch("/api/bff/webhooks").then(r => r.ok ? r.json() : [])
    ]).then(([k, w]) => {
      setKeys(k);
      setWebhooks(w);
      setLoading(false);
    });
  }, []);

  const createApiKey = async () => {
    if (!newKeyName) return;
    const res = await fetch("/api/bff/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName })
    });
    if (res.ok) {
      const data = await res.json();
      setGeneratedKey(data.key);
      setKeys([data.api_key, ...keys]);
      setNewKeyName("");
    }
  };

  const deleteApiKey = async (id: string) => {
    if (!confirm("Revoke this API key? Any applications using it will instantly fail.")) return;
    const res = await fetch(`/api/bff/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeys(keys.filter(k => k.id !== id));
    }
  };

  const createWebhook = async () => {
    if (!newWebhookUrl) return;
    const res = await fetch("/api/bff/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newWebhookUrl, events: ["document.status_changed", "book.created"] })
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
      setWebhooks(webhooks.filter(w => w.id !== id));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <PageShell title="Developer Settings">
        <div className="animate-pulse space-y-8">
          <div className="h-32 bg-elevated rounded-2xl" />
          <div className="h-32 bg-elevated rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Developer Settings">
      <div className="space-y-16">
        
        {/* API Keys */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                <Key className="h-5 w-5 text-accent" /> API Keys
              </h2>
              <p className="text-sm text-text-secondary">Manage programmatic access to your account and workspaces.</p>
            </div>
          </div>
          
          <div className="bg-elevated border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
            {/* Generate New Key */}
            <div className="p-6 border-b border-border-subtle bg-surface/50">
              <h3 className="font-bold mb-4 text-sm uppercase tracking-widest text-text-tertiary">Generate New Key</h3>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  placeholder="Key name (e.g. Production Backend)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1 bg-base border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-accent transition-all"
                />
                <Button onClick={createApiKey} disabled={!newKeyName} className="bg-accent text-white px-6 rounded-xl font-bold">
                  <Plus className="h-4 w-4 mr-2" /> Generate
                </Button>
              </div>
              
              {generatedKey && (
                <div className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-4">
                  <AlertCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-emerald-700 mb-1">Key generated successfully!</p>
                    <p className="text-xs text-emerald-600 mb-3">Copy this key now. You will not be able to see it again.</p>
                    <div className="flex items-center gap-2">
                      <code className="bg-base border border-emerald-500/20 px-3 py-2 rounded text-emerald-800 font-mono text-sm flex-1">
                        {generatedKey}
                      </code>
                      <Button onClick={() => copyToClipboard(generatedKey)} variant="outline" className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20">
                        {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Keys List */}
            <div className="p-0">
              {keys.length === 0 ? (
                <div className="p-8 text-center text-text-secondary text-sm">No API keys generated yet.</div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {keys.map(key => (
                    <div key={key.id} className="p-6 flex items-center justify-between hover:bg-surface/30 transition-colors">
                      <div>
                        <div className="font-bold flex items-center gap-3">
                          {key.name}
                          <span className="text-xs font-mono bg-surface border border-border-strong px-2 py-0.5 rounded text-text-tertiary">
                            {key.prefix}...
                          </span>
                        </div>
                        <div className="text-xs text-text-tertiary mt-2">
                          Created {new Date(key.created_at).toLocaleDateString()} • Last used {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => deleteApiKey(key.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Webhooks */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                <Webhook className="h-5 w-5 text-blue-500" /> Webhooks
              </h2>
              <p className="text-sm text-text-secondary">Receive real-time HTTP POST payloads when events happen.</p>
            </div>
          </div>
          
          <div className="bg-elevated border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border-subtle bg-surface/50">
              <h3 className="font-bold mb-4 text-sm uppercase tracking-widest text-text-tertiary">Add Endpoint</h3>
              <div className="flex gap-4">
                <input 
                  type="url" 
                  placeholder="https://your-domain.com/webhooks"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  className="flex-1 bg-base border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition-all"
                />
                <Button onClick={createWebhook} disabled={!newWebhookUrl} className="bg-blue-500 text-white px-6 rounded-xl font-bold hover:bg-blue-600">
                  <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
              </div>
            </div>

            <div className="p-0">
              {webhooks.length === 0 ? (
                <div className="p-8 text-center text-text-secondary text-sm">No webhooks configured.</div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {webhooks.map(webhook => (
                    <div key={webhook.id} className="p-6 flex items-center justify-between hover:bg-surface/30 transition-colors">
                      <div>
                        <div className="font-mono text-sm text-blue-400 font-medium bg-blue-500/10 px-3 py-1 rounded inline-block mb-2">
                          {webhook.url}
                        </div>
                        <div className="flex gap-2">
                          {webhook.events.map(ev => (
                            <span key={ev} className="text-[10px] font-bold text-text-tertiary uppercase border border-border-subtle rounded px-2 py-0.5 bg-base">
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" onClick={() => deleteWebhook(webhook.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Integration Snippets */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
              <Code2 className="h-5 w-5 text-purple-500" /> Integration
            </h2>
            <p className="text-sm text-text-secondary">Quick start examples using your API keys.</p>
          </div>
          
          <div className="bg-elevated border border-border-subtle rounded-2xl p-6 shadow-sm">
            <div className="bg-base border border-border-strong rounded-xl p-4 overflow-x-auto relative group">
              <Button 
                variant="ghost" 
                className="absolute top-2 right-2 h-8 w-8 p-0 border border-border-subtle bg-surface"
                onClick={() => copyToClipboard('curl -X POST "https://api.olpdf.xyz/api/documents/create" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"title": "My Document"}\'')}
              >
                <Copy className="h-4 w-4 text-text-tertiary" />
              </Button>
              <pre className="text-sm font-mono text-text-primary">
<span className="text-purple-400">curl</span> -X POST <span className="text-amber-400">"https://api.olpdf.xyz/api/documents/create"</span> \
  -H <span className="text-amber-400">"Authorization: Bearer YOUR_API_KEY"</span> \
  -H <span className="text-amber-400">"Content-Type: application/json"</span> \
  -d <span className="text-emerald-400">'&#123;"title": "My Document"&#125;'</span>
              </pre>
            </div>
          </div>
        </section>

      </div>
    </PageShell>
  );
}
