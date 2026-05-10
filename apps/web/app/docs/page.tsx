"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Terminal, Key, Shield, Zap, FileJson, Book, Cpu, Wand2, Database,
  CheckCircle2, LayoutTemplate, ChevronDown, Copy, Check, AlertTriangle,
  ArrowRight, Globe, Lock, Clock, Code2, Webhook, FileText, Layers,
  PenTool, Download, Trash2, RefreshCw
} from "lucide-react";
import BackLink from "@/components/BackLink";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  type?: "header";
  id?: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  sub?: boolean;
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV: NavItem[] = [
  { id: "overview",       label: "Overview",           icon: Globe },
  { id: "quickstart",     label: "Quick Start",        icon: Zap },
  { id: "authentication", label: "Authentication",     icon: Lock },
  { id: "rate-limits",    label: "Rate Limits",        icon: Clock },
  { type: "header",       label: "API Reference" },
  { id: "api-documents",  label: "Documents",          icon: FileJson },
  { id: "api-ai",         label: "AI Operations",      icon: Wand2 },
  { id: "api-pdf",        label: "PDF Toolkit",        icon: Cpu },
  { id: "api-books",      label: "Books",              icon: Book },
  { id: "api-templates",  label: "Templates",          icon: LayoutTemplate },
  { id: "api-annotations",label: "Annotations",        icon: PenTool },
  { id: "api-webhooks",   label: "Webhooks",           icon: Webhook },
  { id: "api-keys",       label: "API Keys",           icon: Key },
  { type: "header",       label: "Guides" },
  { id: "errors",         label: "Error Reference",    icon: AlertTriangle },
  { id: "self-hosting",   label: "Self-Hosting",       icon: Database },
  { type: "header",       label: "Embed SDK" },
  { id: "embed-overview", label: "Overview",           icon: Code2 },
  { id: "embed-install",  label: "Installation",       icon: Download },
  { id: "embed-events",   label: "Events",             icon: Zap },
  { id: "embed-frameworks", label: "Framework Guides", icon: Layers },
];

// ─── Code Block ──────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "json", filename }: { code: string; lang?: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="rounded-xl overflow-hidden border border-[#232325] bg-[#0a0a0c] text-sm font-mono">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f0f11] border-b border-[#1e1e21]">
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{filename ?? lang}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-200 transition-colors font-bold">
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-5 overflow-x-auto text-gray-300 leading-relaxed text-xs">{code}</pre>
    </div>
  );
}

// ─── Method Badge ─────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
    POST:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    PUT:    "bg-amber-500/15 text-amber-400 border-amber-500/30",
    PATCH:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
    DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`text-[10px] font-black px-2.5 py-1 rounded border ${colors[method] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30"} shrink-0 w-16 text-center`}>
      {method}
    </span>
  );
}

// ─── Param Table ─────────────────────────────────────────────────────────────

function ParamTable({ rows }: { rows: { name: string; type: string; required?: boolean; desc: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
            <th className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-[10px]">Field</th>
            <th className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-[10px]">Type</th>
            <th className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-[10px]">Required</th>
            <th className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-[10px]">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
              <td className="px-4 py-3 font-mono text-amber-500 font-bold">{r.name}</td>
              <td className="px-4 py-3 font-mono text-blue-400">{r.type}</td>
              <td className="px-4 py-3">
                {r.required
                  ? <span className="text-red-400 font-bold">required</span>
                  : <span className="text-[var(--text-tertiary)]">optional</span>}
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Endpoint Card ────────────────────────────────────────────────────────────

interface EndpointProps {
  method: string;
  path: string;
  desc: string;
  params?: { name: string; type: string; required?: boolean; desc: string }[];
  request?: string;
  response?: string;
  auth?: boolean;
}

function Endpoint({ method, path, desc, params, request, response, auth = true }: EndpointProps) {
  const [open, setOpen] = useState(false);
  const hasDetail = params || request || response;

  return (
    <div className="border border-[var(--border-subtle)] rounded-2xl overflow-hidden hover:border-[var(--accent)]/40 transition-colors">
      <button
        onClick={() => hasDetail && setOpen(o => !o)}
        className={`w-full flex items-start sm:items-center gap-4 p-5 text-left bg-[var(--bg-surface)] ${hasDetail ? "cursor-pointer hover:bg-[var(--bg-elevated)]" : "cursor-default"} transition-colors`}
      >
        <MethodBadge method={method} />
        <div className="flex-1 min-w-0">
          <code className="font-mono font-black text-sm text-[var(--text-primary)] block truncate">{path}</code>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">{desc}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {auth && <span className="text-[9px] font-bold text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded">AUTH</span>}
          {hasDetail && <ChevronDown className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`} />}
        </div>
      </button>

      {open && hasDetail && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] p-5 space-y-5">
          {params && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Parameters</p>
              <ParamTable rows={params} />
            </div>
          )}
          {request && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Request Body</p>
              <CodeBlock code={request} lang="json" />
            </div>
          )}
          {response && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Response</p>
              <CodeBlock code={response} lang="json" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section Heading ──────────────────────────────────────────────────────────

function SectionHead({ icon: Icon, title, subtitle, color = "text-[var(--accent)]" }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="flex items-start gap-4 mb-8">
      <div className={`h-12 w-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center ${color} shrink-0`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">{title}</h2>
        {subtitle && <p className="text-[var(--text-secondary)] text-sm font-medium mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Callout ─────────────────────────────────────────────────────────────────

function Callout({ type = "info", children }: { type?: "info" | "warn" | "tip"; children: React.ReactNode }) {
  const styles = {
    info: "border-blue-500/30 bg-blue-500/5 text-blue-400",
    warn: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    tip:  "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
  };
  const labels = { info: "Note", warn: "Warning", tip: "Tip" };
  return (
    <div className={`border rounded-xl p-4 ${styles[type]}`}>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1.5">{labels[type]}</p>
      <div className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); }),
      { rootMargin: "-10% 0% -80% 0%", threshold: 0 }
    );
    document.querySelectorAll("section[id]").forEach(s => observer.current?.observe(s));
    return () => observer.current?.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <div className="max-w-8xl mx-auto flex">

        {/* ── Sidebar ── */}
        <aside className="hidden lg:block w-60 xl:w-64 shrink-0 sticky top-0 h-screen overflow-y-auto py-12 pl-6 pr-4 border-r border-[var(--border-subtle)]">
          <Link href="/" className="inline-flex items-baseline mb-8 group">
            <span className="font-sans font-black tracking-tighter text-orange-500 text-lg">O</span>
            <span className="font-serif italic font-light text-[var(--text-primary)] -ml-0.5 mr-0.5 text-lg">L</span>
            <span className="bg-[#e21818] text-white px-1.5 py-0.5 rounded font-mono font-bold text-sm">PDF</span>
            <span className="text-[10px] font-mono text-[var(--text-tertiary)] ml-2">Docs</span>
          </Link>
          <nav>
            {NAV.map((item, i) => {
              if (item.type === "header") return (
                <p key={i} className="text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mt-6 mb-2 px-3">{item.label}</p>
              );
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <Link key={item.id} href={`#${item.id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all mb-0.5 ${
                    active ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  }`}>
                  {Icon && <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "" : "opacity-60"}`} />}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 py-12 px-6 lg:px-12 xl:px-16 space-y-28 max-w-4xl">

          <div className="scroll-mt-24">
            <BackLink href="/" label="Back to home" className="mb-8" />
            <div className="flex items-center gap-3 mb-4">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest">API v1 · Beta</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-6">OLPDF Documentation</h1>
            <p className="text-xl text-[var(--text-secondary)] leading-relaxed max-w-2xl font-medium">
              The complete reference for the OLPDF REST API, Studio editor, PDF toolkit, and self-hosting infrastructure.
            </p>
          </div>

          {/* ─── OVERVIEW ──────────────────────────────────────────── */}
          <section id="overview" className="scroll-mt-24">
            <SectionHead icon={Globe} title="Overview" subtitle="Base URL, versioning, and content type conventions" color="text-blue-400" />

            <div className="space-y-6">
              <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Base URL</p>
                <code className="font-mono font-black text-lg text-[var(--accent)]">https://api.olpdf.xyz</code>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "Protocol",     value: "HTTPS only" },
                  { label: "Format",       value: "JSON (UTF-8)" },
                  { label: "Versioning",   value: "/v1 prefix" },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-1">{label}</p>
                    <p className="font-mono font-bold text-sm text-[var(--text-primary)]">{value}</p>
                  </div>
                ))}
              </div>

              <p className="text-[var(--text-secondary)] font-medium leading-relaxed text-sm">
                All request bodies must be <code className="font-mono text-amber-500">application/json</code>. Binary uploads (PDF ingestion)
                use <code className="font-mono text-amber-500">multipart/form-data</code>. Every response includes
                an <code className="font-mono text-amber-500">X-Request-ID</code> header for distributed tracing.
              </p>
            </div>
          </section>

          {/* ─── QUICK START ───────────────────────────────────────── */}
          <section id="quickstart" className="scroll-mt-24">
            <SectionHead icon={Zap} title="Quick Start" subtitle="Extract and edit your first document in under 3 minutes" color="text-amber-400" />

            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                {["Upload a PDF to extract its semantic model", "Use the AI instruction endpoint to edit it", "Export back to PDF or EPUB3"].map((step, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                    <span className="h-7 w-7 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{step}</p>
                  </div>
                ))}
              </div>

              <CodeBlock filename="quickstart.sh" lang="bash" code={`# 1. Upload + extract
curl -X POST https://api.olpdf.xyz/v1/extract \\
  -H "Authorization: Bearer free_beta_key" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/report.pdf", "mode": "semantic"}'

# Returns: { "document_id": "doc_abc123", "blocks": [...] }

# 2. Issue an AI instruction
curl -X POST https://api.olpdf.xyz/api/ai/documents/doc_abc123/instruction \\
  -H "Authorization: Bearer free_beta_key" \\
  -H "Content-Type: application/json" \\
  -d '{"instruction": "Summarize the executive summary section into 3 bullet points"}'

# 3. Export to PDF
curl -X POST https://api.olpdf.xyz/api/documents/doc_abc123/export/pdf \\
  -H "Authorization: Bearer free_beta_key" \\
  --output result.pdf`} />

              <CodeBlock filename="quickstart.py" lang="python" code={`import requests

BASE = "https://api.olpdf.xyz"
HEADERS = {"Authorization": "Bearer free_beta_key"}

# 1. Extract
doc = requests.post(f"{BASE}/v1/extract", headers=HEADERS, json={
    "url": "https://example.com/report.pdf",
    "mode": "semantic"
}).json()
doc_id = doc["document_id"]

# 2. AI edit
requests.post(f"{BASE}/api/ai/documents/{doc_id}/instruction", headers=HEADERS, json={
    "instruction": "Convert all headers to Title Case"
})

# 3. Export
pdf = requests.post(f"{BASE}/api/documents/{doc_id}/export/pdf", headers=HEADERS)
open("result.pdf", "wb").write(pdf.content)`} />
            </div>
          </section>

          {/* ─── AUTHENTICATION ────────────────────────────────────── */}
          <section id="authentication" className="scroll-mt-24">
            <SectionHead icon={Lock} title="Authentication" subtitle="Bearer JWT tokens and persistent API keys" color="text-purple-400" />

            <div className="space-y-8">
              <p className="text-[var(--text-secondary)] font-medium leading-relaxed text-sm">
                All <code className="font-mono text-amber-500">/api/*</code> endpoints require authentication via one of two mechanisms.
                Worker callback routes (<code className="font-mono text-amber-500">/api/worker/*</code>) use QStash signature verification instead.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-purple-400" />
                    <h4 className="font-black text-sm">Bearer JWT (User Sessions)</h4>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    Issued by Supabase Auth. Short-lived (1 hour), auto-refreshed by the SDK.
                    Use for user-facing integrations.
                  </p>
                  <CodeBlock lang="http" code={`Authorization: Bearer eyJhbGci...`} />
                </div>
                <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-amber-400" />
                    <h4 className="font-black text-sm">API Key (Machine-to-Machine)</h4>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed">
                    Long-lived keys generated in the dashboard. Stored as SHA-256 hashes server-side. Never expire unless rotated.
                  </p>
                  <CodeBlock lang="http" code={`X-API-Key: olpdf_live_xxxxxxxxxxxx`} />
                </div>
              </div>

              <Callout type="warn">
                The <code>free_beta_key</code> is a public testing credential with a 10 req/min limit. Generate a personal API key in your dashboard for production use.
              </Callout>

              <div>
                <h4 className="font-black text-sm mb-4 text-[var(--text-primary)]">Error Responses</h4>
                <CodeBlock lang="json" code={`// 401 — Missing or invalid credential
{
  "error": "api_error",
  "message": "Authentication required (JWT or API Key)"
}

// 403 — Valid credential but insufficient permissions
{
  "error": "api_error",
  "message": "You do not have permission to access this resource"
}`} />
              </div>
            </div>
          </section>

          {/* ─── RATE LIMITS ───────────────────────────────────────── */}
          <section id="rate-limits" className="scroll-mt-24">
            <SectionHead icon={Clock} title="Rate Limits" subtitle="Per-IP burst limits enforced via Redis sliding window" color="text-orange-400" />

            <div className="space-y-6">
              <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                      {["Tier", "Limit", "Window", "Scope"].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {[
                      ["Free (beta key)", "10 requests", "1 minute",  "Per IP address"],
                      ["API Key (personal)", "120 requests", "1 minute", "Per key"],
                      ["PDF Toolkit ops",  "20 requests", "1 minute",  "Per user"],
                      ["AI Instructions",  "30 requests", "1 hour",    "Per document"],
                    ].map(([tier, limit, window, scope]) => (
                      <tr key={tier}>
                        <td className="px-4 py-3 font-mono font-bold text-[var(--text-primary)]">{tier}</td>
                        <td className="px-4 py-3 text-emerald-400 font-bold">{limit}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{window}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{scope}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                When a limit is exceeded the API returns <code className="font-mono text-red-400">429 Too Many Requests</code> with a
                <code className="font-mono text-amber-500"> Retry-After</code> header in seconds.
              </p>
            </div>
          </section>

          {/* ─── DOCUMENTS ─────────────────────────────────────────── */}
          <section id="api-documents" className="scroll-mt-24">
            <SectionHead icon={FileJson} title="Documents" subtitle="Create, read, update, export, and version documents" color="text-blue-400" />

            <div className="space-y-3">
              <Endpoint method="POST" path="/api/documents/create"
                desc="Initialize a new empty document. Returns the document_id used in all subsequent calls."
                params={[
                  { name: "title",  type: "string",  required: true,  desc: "Human-readable document name" },
                  { name: "meta",   type: "object",  required: false, desc: "Arbitrary key-value metadata (author, tags, etc.)" },
                  { name: "source_url", type: "string", required: false, desc: "If provided, the PDF at this URL is fetched and extracted immediately" },
                ]}
                request={`{
  "title": "Q3 2026 Investor Report",
  "meta": { "author": "Finance Team", "department": "ir" },
  "source_url": "https://example.com/q3-report.pdf"
}`}
                response={`{
  "document_id": "doc_7f3a2b91",
  "title": "Q3 2026 Investor Report",
  "status": "extracting",
  "created_at": "2026-05-09T10:23:00Z",
  "blocks_count": 0
}`}
              />
              <Endpoint method="GET" path="/api/documents/{doc_id}"
                desc="Retrieve the full semantic JSON model including all blocks, metadata, and version history."
                response={`{
  "document_id": "doc_7f3a2b91",
  "title": "Q3 2026 Investor Report",
  "status": "ready",
  "blocks": [
    { "id": "blk_001", "type": "heading", "level": 1, "text": "Executive Summary", "page": 1, "bbox": [72, 48, 540, 72] },
    { "id": "blk_002", "type": "paragraph", "text": "Revenue grew 34% YoY...", "page": 1, "bbox": [72, 80, 540, 120] }
  ],
  "page_count": 12,
  "created_at": "2026-05-09T10:23:00Z",
  "updated_at": "2026-05-09T10:24:15Z"
}`}
              />
              <Endpoint method="GET" path="/api/documents/{doc_id}/preview"
                desc="Generate a signed temporary URL for read-only PDF preview. Valid for 15 minutes."
                response={`{
  "preview_url": "https://r2.olpdf.xyz/previews/doc_7f3a2b91.pdf?token=...",
  "expires_at": "2026-05-09T10:38:00Z"
}`}
              />
              <Endpoint method="PUT" path="/api/documents/{doc_id}"
                desc="Replace the block array. Use after making manual edits to the semantic model."
                params={[
                  { name: "blocks", type: "Block[]", required: true, desc: "Full replacement block array" },
                  { name: "title",  type: "string",  required: false, desc: "Update the document title" },
                ]}
                request={`{
  "blocks": [
    { "id": "blk_001", "type": "heading", "level": 1, "text": "Updated Executive Summary" },
    { "id": "blk_002", "type": "paragraph", "text": "Revenue grew 41% YoY after adjustment..." }
  ]
}`}
                response={`{ "document_id": "doc_7f3a2b91", "blocks_count": 2, "updated_at": "2026-05-09T10:30:00Z" }`}
              />
              <Endpoint method="POST" path="/api/documents/{doc_id}/export/{format}"
                desc="Compile the semantic model back to binary. Supported formats: pdf, epub, docx."
                params={[
                  { name: "format",     type: "string",  required: true,  desc: "pdf | epub | docx" },
                  { name: "pdf_standard", type: "string", required: false, desc: "pdf-a (archival) | tagged (accessibility). Defaults to standard PDF." },
                ]}
                response={`// Content-Type: application/pdf (or application/epub+zip)
// Binary stream. Save directly to disk.`}
              />
              <Endpoint method="POST" path="/api/documents/{doc_id}/snapshot"
                desc="Create a named version snapshot. Snapshots are immutable and can be used to roll back."
                request={`{ "version_name": "pre-review-v1.0" }`}
                response={`{
  "snapshot_id": "snap_a1b2c3",
  "version_name": "pre-review-v1.0",
  "blocks_count": 48,
  "created_at": "2026-05-09T11:00:00Z"
}`}
              />
              <Endpoint method="DELETE" path="/api/documents/{doc_id}"
                desc="Permanently delete a document and all associated blobs from R2 storage. Irreversible."
                response={`{ "deleted": true, "document_id": "doc_7f3a2b91" }`}
              />
            </div>
          </section>

          {/* ─── AI OPERATIONS ─────────────────────────────────────── */}
          <section id="api-ai" className="scroll-mt-24">
            <SectionHead icon={Wand2} title="AI Operations" subtitle="Gemini-powered structural editing with full audit trail" color="text-[var(--accent)]" />

            <div className="space-y-6 mb-6">
              <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                AI operations use a <strong>propose → review → accept</strong> flow. The model never directly mutates your document;
                it proposes a diff which you can inspect and accept or discard. Every accepted change is logged with the original instruction,
                the model&apos;s reasoning, and a full before/after diff.
              </p>
              <Callout type="tip">
                Pass <code>auto_accept: true</code> in the instruction body to skip manual review. Useful for batch processing pipelines.
              </Callout>
            </div>

            <div className="space-y-3">
              <Endpoint method="POST" path="/api/ai/documents/{doc_id}/instruction"
                desc="Send a natural language command to Gemini 1.5 Pro. Returns a proposed diff."
                params={[
                  { name: "instruction", type: "string",  required: true,  desc: "Plain-language edit command" },
                  { name: "scope",       type: "string[]", required: false, desc: "Optional block IDs to restrict the edit scope to specific sections" },
                  { name: "auto_accept", type: "boolean", required: false, desc: "If true, immediately applies the diff without manual review" },
                ]}
                request={`{
  "instruction": "Extract all action items into a numbered list at the end of each section",
  "scope": ["blk_010", "blk_011", "blk_012"],
  "auto_accept": false
}`}
                response={`{
  "log_id": "log_x9y8z7",
  "status": "pending_review",
  "instruction": "Extract all action items...",
  "diff": {
    "added": [{ "id": "blk_013", "type": "list", "items": ["Schedule Q4 review", "Approve budget"] }],
    "modified": [],
    "removed": []
  },
  "model": "gemini-1.5-pro",
  "tokens_used": 1240
}`}
              />
              <Endpoint method="GET" path="/api/ai/documents/{doc_id}/logs"
                desc="Full audit trail of all AI operations on this document, including diffs and token usage."
                response={`{
  "logs": [
    {
      "log_id": "log_x9y8z7",
      "instruction": "Extract all action items...",
      "status": "accepted",
      "created_at": "2026-05-09T10:45:00Z",
      "tokens_used": 1240
    }
  ],
  "total": 1
}`}
              />
              <Endpoint method="POST" path="/api/ai/logs/{log_id}/accept"
                desc="Permanently apply the proposed diff to the document. Transitions log status to accepted."
                response={`{ "log_id": "log_x9y8z7", "status": "accepted", "blocks_affected": 3 }`}
              />
              <Endpoint method="DELETE" path="/api/ai/logs/{log_id}"
                desc="Discard a pending diff. No changes are made to the document. Log is marked as discarded."
                response={`{ "log_id": "log_x9y8z7", "status": "discarded" }`}
              />
            </div>
          </section>

          {/* ─── PDF TOOLKIT ───────────────────────────────────────── */}
          <section id="api-pdf" className="scroll-mt-24">
            <SectionHead icon={Cpu} title="PDF Toolkit" subtitle="Low-level binary PDF operations — merge, split, redact, compress" color="text-blue-600" />

            <div className="space-y-3">
              <Endpoint method="POST" path="/api/pdf/merge"
                desc="Combine multiple PDFs into a single output file. Page order follows the document_ids array."
                params={[
                  { name: "document_ids", type: "string[]", required: true, desc: "Ordered list of document IDs to merge" },
                  { name: "output_title", type: "string",   required: false, desc: "Title for the resulting merged document" },
                ]}
                request={`{ "document_ids": ["doc_aaa", "doc_bbb", "doc_ccc"], "output_title": "Combined Report" }`}
                response={`{ "document_id": "doc_merged_001", "page_count": 36, "size_bytes": 1204300 }`}
              />
              <Endpoint method="POST" path="/api/pdf/split"
                desc="Split a PDF into multiple documents by page ranges."
                params={[
                  { name: "document_id", type: "string",     required: true, desc: "Source document to split" },
                  { name: "ranges",      type: "object[]",   required: true, desc: "Array of {start, end} page ranges (1-indexed)" },
                ]}
                request={`{
  "document_id": "doc_7f3a2b91",
  "ranges": [{ "start": 1, "end": 5 }, { "start": 6, "end": 12 }]
}`}
                response={`{ "documents": [{ "document_id": "doc_split_a", "pages": 5 }, { "document_id": "doc_split_b", "pages": 7 }] }`}
              />
              <Endpoint method="POST" path="/api/pdf/compress"
                desc="Reduce file size by downsampling images and removing metadata. Choose from three quality presets."
                params={[
                  { name: "document_id", type: "string", required: true,  desc: "Document to compress" },
                  { name: "quality",     type: "string", required: false, desc: "screen | ebook | printer. Defaults to ebook." },
                ]}
                response={`{ "document_id": "doc_compressed_001", "original_bytes": 8200000, "compressed_bytes": 1940000, "reduction_pct": 76 }`}
              />
              <Endpoint method="POST" path="/api/pdf/rotate"
                desc="Rotate specific pages in a document."
                request={`{ "document_id": "doc_7f3a2b91", "pages": [3, 4], "degrees": 90 }`}
                response={`{ "document_id": "doc_rotated_001", "pages_modified": 2 }`}
              />
              <Endpoint method="POST" path="/api/pdf/watermark"
                desc="Apply a text or image watermark across all pages."
                params={[
                  { name: "document_id", type: "string", required: true,  desc: "Source document" },
                  { name: "text",        type: "string", required: false, desc: "Watermark text (e.g. DRAFT)" },
                  { name: "opacity",     type: "number", required: false, desc: "0.0–1.0. Defaults to 0.3" },
                  { name: "angle",       type: "number", required: false, desc: "Rotation in degrees. Defaults to 45" },
                ]}
                request={`{ "document_id": "doc_7f3a2b91", "text": "CONFIDENTIAL", "opacity": 0.25, "angle": 45 }`}
                response={`{ "document_id": "doc_watermarked_001" }`}
              />
              <Endpoint method="POST" path="/api/pdf/redact"
                desc="Permanently black out coordinate areas across one or more pages. Irreversible vector-level redaction — not just a visual overlay."
                params={[
                  { name: "document_id", type: "string",   required: true, desc: "Source document" },
                  { name: "areas",       type: "object[]", required: true, desc: "Array of {page, x, y, w, h} bounding boxes in PDF points" },
                ]}
                request={`{
  "document_id": "doc_7f3a2b91",
  "areas": [
    { "page": 1, "x": 100, "y": 200, "w": 150, "h": 20 },
    { "page": 2, "x": 72,  "y": 340, "w": 300, "h": 12 }
  ]
}`}
                response={`{ "document_id": "doc_redacted_001", "areas_redacted": 2 }`}
              />
              <Endpoint method="POST" path="/api/pdf/forms/detect"
                desc="Locate and classify all interactive form fields (text, checkbox, radio, dropdown) in a PDF."
                response={`{
  "fields": [
    { "id": "fld_001", "name": "FullName", "type": "text", "page": 1, "bbox": [100, 200, 300, 220] },
    { "id": "fld_002", "name": "Agree",    "type": "checkbox", "page": 3, "bbox": [72, 400, 90, 418] }
  ]
}`}
              />
              <Endpoint method="POST" path="/api/pdf/forms/fill"
                desc="Flatten a PDF form with provided field values. Produces a non-interactive filled PDF."
                request={`{
  "document_id": "doc_7f3a2b91",
  "data": { "FullName": "Jane Doe", "Agree": true, "Date": "2026-05-09" }
}`}
                response={`{ "document_id": "doc_filled_001" }`}
              />
            </div>
          </section>

          {/* ─── BOOKS ─────────────────────────────────────────────── */}
          <section id="api-books" className="scroll-mt-24">
            <SectionHead icon={Book} title="Books" subtitle="Multi-chapter publication workspace with cross-chapter consistency" color="text-purple-400" />

            <div className="space-y-6 mb-6">
              <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                A Book is a container that aggregates individual Documents as ordered chapters. The consistency engine uses RAG across all
                chapter embeddings to detect terminology drift, name mismatches, and font hierarchy violations before export.
              </p>
            </div>

            <div className="space-y-3">
              <Endpoint method="POST" path="/api/books/create"
                desc="Create a new book workspace."
                request={`{ "title": "OLPDF Technical Handbook", "description": "Internal developer documentation" }`}
                response={`{ "book_id": "book_abc123", "title": "OLPDF Technical Handbook", "chapters": [] }`}
              />
              <Endpoint method="POST" path="/api/books/{book_id}/chapters"
                desc="Append an existing document as a chapter. Chapter order is controlled by chapter_number."
                params={[
                  { name: "document_id",    type: "string",  required: true,  desc: "Existing document to attach as a chapter" },
                  { name: "chapter_number", type: "integer", required: true,  desc: "Insertion position (1-indexed)" },
                  { name: "title",          type: "string",  required: false, desc: "Override chapter title (defaults to document title)" },
                ]}
                request={`{ "document_id": "doc_ch1", "chapter_number": 1, "title": "Introduction" }`}
                response={`{ "book_id": "book_abc123", "chapter_id": "ch_001", "chapter_number": 1 }`}
              />
              <Endpoint method="POST" path="/api/books/{book_id}/consistency"
                desc="Run a full cross-chapter consistency analysis using pgvector embeddings. Returns a report of issues."
                response={`{
  "issues": [
    { "type": "terminology", "description": "Chapter 2 uses 'semantic DOM', Chapter 4 uses 'block tree'", "chapters": [2, 4] },
    { "type": "font_hierarchy", "description": "H2 font size inconsistency between chapters 1 and 3", "chapters": [1, 3] }
  ],
  "score": 0.87
}`}
              />
              <Endpoint method="POST" path="/api/books/{book_id}/export/{format}"
                desc="Compile all chapters into a single publication. Formats: epub (EPUB3), pdf."
                response={`// Binary stream — application/epub+zip or application/pdf`}
              />
            </div>
          </section>

          {/* ─── TEMPLATES ─────────────────────────────────────────── */}
          <section id="api-templates" className="scroll-mt-24">
            <SectionHead icon={LayoutTemplate} title="Templates" subtitle="Reusable structural scaffolds for new documents" color="text-emerald-400" />

            <div className="space-y-3">
              <Endpoint method="GET" path="/api/templates"
                desc="List all available templates (system-provided + user-created)."
                response={`{
  "templates": [
    { "template_id": "tmpl_invoice", "name": "Invoice", "category": "finance", "is_system": true },
    { "template_id": "tmpl_mytemplate", "name": "My Template", "category": "custom", "is_system": false }
  ]
}`}
              />
              <Endpoint method="POST" path="/api/templates"
                desc="Save the current block structure of a document as a reusable template."
                request={`{ "source_document_id": "doc_7f3a2b91", "name": "Q3 Report Template", "category": "finance" }`}
                response={`{ "template_id": "tmpl_q3_2026", "name": "Q3 Report Template" }`}
              />
              <Endpoint method="POST" path="/api/templates/{template_id}/apply"
                desc="Create a new document pre-populated with the template's block structure."
                request={`{ "title": "Q4 2026 Investor Report" }`}
                response={`{ "document_id": "doc_new_from_template", "blocks_count": 24 }`}
              />
              <Endpoint method="DELETE" path="/api/templates/{template_id}"
                desc="Delete a user-created template. System templates cannot be deleted."
                response={`{ "deleted": true }`}
              />
            </div>
          </section>

          {/* ─── ANNOTATIONS ───────────────────────────────────────── */}
          <section id="api-annotations" className="scroll-mt-24">
            <SectionHead icon={PenTool} title="Annotations" subtitle="Comments and notes attached to document blocks" color="text-pink-400" />

            <div className="space-y-3">
              <Endpoint method="GET" path="/api/documents/{doc_id}/annotations"
                desc="List all annotations on a document."
                response={`{ "annotations": [{ "annotation_id": "ann_001", "block_id": "blk_005", "text": "Verify this figure", "author": "user@email.com" }] }`}
              />
              <Endpoint method="POST" path="/api/documents/{doc_id}/annotations"
                desc="Add an annotation to a specific block."
                params={[
                  { name: "block_id", type: "string", required: true,  desc: "Block to attach the annotation to" },
                  { name: "text",     type: "string", required: true,  desc: "Annotation content" },
                  { name: "type",     type: "string", required: false, desc: "comment | highlight | todo. Defaults to comment" },
                ]}
              />
              <Endpoint method="DELETE" path="/api/annotations/{annotation_id}"
                desc="Remove an annotation."
                response={`{ "deleted": true }`}
              />
            </div>
          </section>

          {/* ─── WEBHOOKS ──────────────────────────────────────────── */}
          <section id="api-webhooks" className="scroll-mt-24">
            <SectionHead icon={Webhook} title="Webhooks" subtitle="Real-time event push to your own HTTPS endpoints" color="text-cyan-400" />

            <div className="space-y-6">
              <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                Webhooks are signed with HMAC-SHA256 using your webhook secret. Always verify the
                <code className="font-mono text-amber-500"> X-OLPDF-Signature</code> header before processing events.
              </p>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Available Events</p>
                <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                        {["Event", "Description"].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-[10px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {[
                        ["document.created",    "A new document was created"],
                        ["document.ready",      "PDF extraction completed successfully"],
                        ["document.failed",     "Extraction or OCR job failed"],
                        ["ai.instruction.accepted", "An AI diff was accepted"],
                        ["export.completed",    "An export job finished — download URL included"],
                        ["book.consistency_report", "Cross-chapter analysis complete"],
                      ].map(([event, desc]) => (
                        <tr key={event}>
                          <td className="px-4 py-3 font-mono text-cyan-400 font-bold">{event}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3">
                <Endpoint method="POST" path="/api/webhooks"
                  desc="Register a new webhook endpoint."
                  request={`{ "url": "https://yourapp.com/webhooks/olpdf", "events": ["document.ready", "export.completed"] }`}
                  response={`{ "webhook_id": "wh_001", "secret": "whsec_xxxxxxxxxxxx" }`}
                />
                <Endpoint method="GET" path="/api/webhooks"
                  desc="List all registered webhooks for your account."
                />
                <Endpoint method="DELETE" path="/api/webhooks/{webhook_id}"
                  desc="Delete a webhook registration."
                  response={`{ "deleted": true }`}
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Payload Example — document.ready</p>
                <CodeBlock lang="json" code={`{
  "event": "document.ready",
  "timestamp": "2026-05-09T10:24:15Z",
  "data": {
    "document_id": "doc_7f3a2b91",
    "blocks_extracted": 48,
    "page_count": 12
  }
}`} />
              </div>

              <Callout type="info">
                Webhooks are retried up to 5 times with exponential backoff on non-2xx responses. Check your endpoint returns 200 quickly — offload heavy processing to a queue.
              </Callout>
            </div>
          </section>

          {/* ─── API KEYS ──────────────────────────────────────────── */}
          <section id="api-keys" className="scroll-mt-24">
            <SectionHead icon={Key} title="API Keys" subtitle="Create and manage persistent machine-to-machine credentials" color="text-amber-400" />

            <div className="space-y-3">
              <Endpoint method="GET" path="/api/api-keys"
                desc="List all API keys for your account. Secret values are never returned after creation."
                response={`{ "keys": [{ "key_id": "key_001", "name": "CI Pipeline", "prefix": "olpdf_live_xxxx", "created_at": "2026-05-01" }] }`}
              />
              <Endpoint method="POST" path="/api/api-keys"
                desc="Generate a new API key. The full key is returned only once — store it immediately."
                request={`{ "name": "Production Backend" }`}
                response={`{
  "key_id": "key_002",
  "name": "Production Backend",
  "key": "olpdf_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "created_at": "2026-05-09T10:00:00Z"
}`}
              />
              <Callout type="warn">The <code>key</code> value is shown exactly once. OLPDF stores only the SHA-256 hash. Copy it now.</Callout>
              <Endpoint method="DELETE" path="/api/api-keys/{key_id}"
                desc="Revoke an API key immediately. Any requests using this key will return 401."
                response={`{ "deleted": true }`}
              />
            </div>
          </section>

          {/* ─── ERRORS ────────────────────────────────────────────── */}
          <section id="errors" className="scroll-mt-24">
            <SectionHead icon={AlertTriangle} title="Error Reference" subtitle="Standard error envelope and HTTP status codes" color="text-red-400" />

            <div className="space-y-6">
              <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                All errors follow a consistent envelope format:
              </p>
              <CodeBlock lang="json" code={`{
  "error": "api_error",
  "message": "Human-readable description of what went wrong",
  "code": "DOCUMENT_NOT_FOUND"  // optional machine-readable code
}`} />

              <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                      {["HTTP Status", "Meaning", "Common Cause"].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {[
                      ["400", "Bad Request",           "Malformed JSON, missing required field"],
                      ["401", "Unauthorized",          "Missing or invalid JWT / API key"],
                      ["403", "Forbidden",             "Accessing another user's resource"],
                      ["404", "Not Found",             "Document or resource doesn't exist"],
                      ["409", "Conflict",              "Version snapshot name already exists"],
                      ["413", "Payload Too Large",     "Upload exceeds 10 MB limit"],
                      ["422", "Unprocessable Entity",  "File is not a valid PDF or is password-protected"],
                      ["429", "Too Many Requests",     "Rate limit exceeded — check Retry-After header"],
                      ["500", "Internal Server Error", "Unexpected error — include X-Request-ID in support tickets"],
                      ["503", "Service Unavailable",   "Database or AI model temporarily unavailable"],
                    ].map(([code, meaning, cause]) => (
                      <tr key={code}>
                        <td className="px-4 py-3 font-mono font-bold text-red-400">{code}</td>
                        <td className="px-4 py-3 font-bold text-[var(--text-primary)]">{meaning}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{cause}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ─── SELF HOSTING ──────────────────────────────────────── */}
          <section id="self-hosting" className="scroll-mt-24">
            <SectionHead icon={Database} title="Self-Hosting" subtitle="Deploy your own OLPDF instance on Fly.io or Docker" color="text-emerald-400" />

            <div className="space-y-8">
              <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                OLPDF is fully open-source under the MIT license. The stack comprises a Next.js frontend (Vercel or self-hosted),
                a FastAPI backend (Fly.io or Docker), and a Modal GPU worker for OCR. This guide covers Fly.io deployment.
              </p>

              <div>
                <h4 className="font-black text-sm mb-3 text-[var(--text-primary)]">Prerequisites</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  {["Supabase project (PostgreSQL + Auth + Storage)", "Cloudflare R2 bucket", "Google Gemini API key", "Upstash QStash (job queue)", "Upstash Redis (rate limiting)", "Modal Labs account (OCR worker)"].map(p => (
                    <div key={p} className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-black text-sm mb-3 text-[var(--text-primary)]">1. Clone and install</h4>
                <CodeBlock filename="terminal" code={`git clone https://github.com/chidi09/olpdf.git
cd olpdf
pnpm install`} />
              </div>

              <div>
                <h4 className="font-black text-sm mb-3 text-[var(--text-primary)]">2. Deploy Redis on Fly.io</h4>
                <CodeBlock filename="terminal" code={`fly redis create --name olpdf-redis --region ams --no-replicas
# Copy the redis:// URL printed — you'll need it below`} />
              </div>

              <div>
                <h4 className="font-black text-sm mb-3 text-[var(--text-primary)]">3. Deploy the FastAPI backend</h4>
                <CodeBlock filename="terminal" code={`# Launch the app (reads apps/api/fly.toml)
cd apps/api
fly launch --no-deploy

# Set required secrets
fly secrets set \\
  SUPABASE_URL="https://xxx.supabase.co" \\
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \\
  SUPABASE_JWT_SECRET="your-jwt-secret" \\
  GEMINI_API_KEY="AIza..." \\
  R2_ACCESS_KEY_ID="..." \\
  R2_SECRET_ACCESS_KEY="..." \\
  R2_ENDPOINT="https://xxx.r2.cloudflarestorage.com" \\
  R2_BUCKET_NAME="olpdf-documents" \\
  QSTASH_TOKEN="..." \\
  QSTASH_CURRENT_SIGNING_KEY="..." \\
  MODAL_WORKER_URL="https://..." \\
  WORKER_SECRET="your-shared-secret" \\
  REDIS_URL="rediss://default:xxx@in-koala-xxx.upstash.io:6379" \\
  ALLOWED_ORIGINS="https://yourdomain.com"

# Deploy
fly deploy`} />
              </div>

              <div>
                <h4 className="font-black text-sm mb-3 text-[var(--text-primary)]">4. Deploy the Next.js frontend to Vercel</h4>
                <CodeBlock filename="terminal" code={`vercel --prod
# Add these environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# NEXT_PUBLIC_API_URL=https://olpdf.fly.dev`} />
              </div>

              <div>
                <h4 className="font-black text-sm mb-3 text-[var(--text-primary)]">5. Run Supabase migrations</h4>
                <CodeBlock filename="terminal" code={`supabase db push
# Or apply manually:
psql $SUPABASE_DB_URL < supabase/migrations/*.sql`} />
              </div>

              <div>
                <h4 className="font-black text-sm mb-3 text-[var(--text-primary)]">6. Deploy the Modal OCR worker</h4>
                <CodeBlock filename="terminal" code={`cd apps/worker
pip install modal
modal deploy modal_worker.py
# Note the deployed function URL — set it as MODAL_WORKER_URL`} />
              </div>

              <Callout type="tip">
                Run <code>fly logs -a olpdf</code> to tail live logs. The <code>/health</code> endpoint probes the database and returns
                <code> 200 healthy</code> or <code>503 degraded</code> — use it as your uptime monitor target.
              </Callout>

              <div>
                <h4 className="font-black text-sm mb-3 text-[var(--text-primary)]">Fly.io machine configuration (fly.toml)</h4>
                <CodeBlock filename="apps/api/fly.toml" code={`app = 'olpdf'
primary_region = 'ams'

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true

  [[http_service.checks]]
    path = '/health'
    interval = '30s'
    timeout = '5s'

[[vm]]
  memory = '2gb'
  cpu_kind = 'shared'
  cpus = 2`} />
              </div>
            </div>
          </section>

          {/* ── Embed SDK ──────────────────────────────────────────────── */}
          <section id="embed-overview" className="scroll-mt-24">
            <h2 className="text-2xl font-black mb-3 text-[var(--text-primary)]">Embed SDK — Overview</h2>
            <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">The <code className="font-mono text-amber-500 text-sm">@olpdf/embed</code> package lets you embed the full OLPDF editor inside any web application via a lightweight postMessage bridge. The host page renders an iframe pointing at your OLPDF instance; the SDK handles all communication transparently.</p>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: "Zero dependencies", desc: "No React, Vue, or Angular required in the host app." },
                { label: "postMessage bridge", desc: "Secure cross-origin communication with origin validation." },
                { label: "Full AST events", desc: "Receive the complete DocumentModel on every edit." },
              ].map(({ label, desc }) => (
                <div key={label} className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <div className="text-xs font-black text-orange-500 uppercase tracking-widest mb-1">{label}</div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="embed-install" className="scroll-mt-24 mt-12">
            <h2 className="text-2xl font-black mb-3 text-[var(--text-primary)]">Installation</h2>
            <div className="bg-[#111113] rounded-xl border border-[#2a2a2e] px-5 py-4 font-mono text-sm mb-4">
              <span className="text-[#6b7280]">$</span> <span className="text-white">npm install </span><span className="text-orange-400">@olpdf/embed</span>
            </div>
            <p className="text-[var(--text-secondary)] text-sm mb-3">Or load from CDN (no bundler required):</p>
            <div className="bg-[#111113] rounded-xl border border-[#2a2a2e] px-5 py-4 font-mono text-sm mb-6">
              <span className="text-[#60a5fa]">import</span> <span className="text-white">{"{ OlPDFEmbed }"}</span> <span className="text-[#60a5fa]">from</span> <span className="text-orange-400">&apos;https://cdn.jsdelivr.net/npm/@olpdf/embed&apos;</span><span className="text-[#6b7280]">;</span>
            </div>
          </section>

          <section id="embed-events" className="scroll-mt-24 mt-12">
            <h2 className="text-2xl font-black mb-3 text-[var(--text-primary)]">Events</h2>
            <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">Subscribe to events using <code className="font-mono text-amber-500 text-sm">editor.on(event, handler)</code>. Each call returns an unsubscribe function.</p>
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                  <tr>
                    {["Event", "Payload", "Description"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {[
                    { event: "READY", payload: "—", desc: "Editor mounted and ready to accept commands." },
                    { event: "MODEL_UPDATE", payload: "{ documentId, documentModel }", desc: "Full AST after any edit. Replaces deprecated BLOCK_CHANGE." },
                    { event: "PAGE_ADDED", payload: "{ pageIndex, width, height }", desc: "Layout engine added an overflow page." },
                    { event: "PAGE_REMOVED", payload: "{ pageIndex }", desc: "Layout engine removed an overflow page." },
                    { event: "SAVE", payload: "{ documentId, blockCount, pageCount }", desc: "Document saved." },
                    { event: "EXPORT_COMPLETE", payload: "{ url }", desc: "Export finished; download URL (24h TTL)." },
                  ].map(({ event, payload, desc }) => (
                    <tr key={event} className="hover:bg-[var(--bg-elevated)]/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-orange-400 whitespace-nowrap">{event}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">{payload}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="embed-frameworks" className="scroll-mt-24 mt-12">
            <h2 className="text-2xl font-black mb-3 text-[var(--text-primary)]">Framework Guides</h2>
            <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">The SDK is framework-agnostic. Call <code className="font-mono text-amber-500 text-sm">new OlPDFEmbed(container, options)</code> once your container element is in the DOM, and call <code className="font-mono text-amber-500 text-sm">editor.destroy()</code> on unmount.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { fw: "Next.js", hint: "Use useEffect + useRef. Pass 'use client' directive. Call destroy() in the cleanup return." },
                { fw: "Svelte", hint: "Use onMount / onDestroy. Bind container with bind:this." },
                { fw: "Nuxt / Vue", hint: "Use onMounted. Access ref.value as the container element." },
                { fw: "Astro", hint: "Place script inside the .astro file. getElementById after the div." },
                { fw: "Analog (Angular)", hint: "Implement AfterViewInit. Use @ViewChild to get the native element." },
                { fw: "Wix (Velo)", hint: "Use $w.onReady. Call $w('#element').getEl() for the container." },
                { fw: "WordPress", hint: "Enqueue via wp_enqueue_script and add usage via wp_add_inline_script." },
              ].map(({ fw, hint }) => (
                <div key={fw} className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <div className="text-sm font-black text-[var(--text-primary)] mb-1">{fw}</div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{hint}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-[var(--text-secondary)]">
              See the full interactive examples on the <a href="/#embed" className="text-orange-500 hover:text-orange-400 font-semibold transition-colors">landing page embed section</a>.
            </p>
          </section>

          <div className="py-12 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="font-black text-sm text-[var(--text-primary)] mb-1">Something missing?</p>
              <p className="text-xs text-[var(--text-secondary)] font-medium">Open an issue or submit a PR on GitHub.</p>
            </div>
            <div className="flex gap-3">
              <Link href="https://github.com/chidi09/olpdf/issues" target="_blank"
                className="inline-flex items-center gap-2 px-5 h-10 rounded-xl border border-[var(--border-strong)] text-xs font-black uppercase tracking-widest hover:bg-[var(--bg-surface)] transition-colors">
                Open Issue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="https://github.com/chidi09/olpdf" target="_blank"
                className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-[var(--text-primary)] text-[var(--bg-base)] text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity">
                GitHub <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
