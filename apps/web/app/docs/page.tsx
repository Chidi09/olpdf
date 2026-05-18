"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  CommandLineIcon,
  KeyIcon,
  ShieldCheckIcon,
  BoltIcon,
  DocumentTextIcon,
  BookOpenIcon,
  CpuChipIcon,
  SparklesIcon,
  CircleStackIcon,
  CheckCircleIcon,
  Squares2X2Icon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  GlobeAltIcon,
  LockClosedIcon,
  ClockIcon,
  CodeBracketIcon,
  LinkIcon,
  PencilSquareIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import BackLink from "@/components/BackLink";
import { AmbientBackground } from "@/components/ui/Glass";

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
  { id: "overview",       label: "Overview",           icon: GlobeAltIcon },
  { id: "quickstart",     label: "Quick Start",        icon: BoltIcon },
  { id: "code-examples",  label: "Code Examples",      icon: CommandLineIcon },
  { id: "authentication", label: "Authentication",     icon: LockClosedIcon },
  { id: "rate-limits",    label: "Rate Limits",        icon: ClockIcon },
  { type: "header",       label: "API Reference" },
  { id: "api-documents",  label: "Documents",          icon: DocumentTextIcon },
  { id: "api-ai",         label: "AI Operations",      icon: SparklesIcon },
  { id: "api-pdf",        label: "PDF Toolkit",        icon: CpuChipIcon },
  { id: "api-books",      label: "Books",              icon: BookOpenIcon },
  { id: "api-templates",  label: "Templates",          icon: Squares2X2Icon },
  { id: "api-annotations",label: "Annotations",        icon: PencilSquareIcon },
  { id: "api-webhooks",   label: "Webhooks",           icon: LinkIcon },
  { id: "api-keys",       label: "API Keys",           icon: KeyIcon },
  { type: "header",       label: "Guides" },
  { id: "errors",         label: "Error Reference",    icon: ExclamationTriangleIcon },
  { id: "self-hosting",   label: "Self-Hosting",       icon: CircleStackIcon },
  { type: "header",       label: "Embed SDK" },
  { id: "embed-overview", label: "Overview",           icon: CodeBracketIcon },
  { id: "embed-install",  label: "Installation",       icon: ArrowDownTrayIcon },
  { id: "embed-events",   label: "Events",             icon: BoltIcon },
  { id: "embed-frameworks", label: "Framework Guides", icon: Squares2X2Icon },
];

// ─── Syntax highlighter ──────────────────────────────────────────────────────

function highlight(raw: string): string {
  let s = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const strings: string[] = [];
  s = s.replace(/'[^'\n]*'|"[^"\n]*"/g, (m) => { strings.push(m); return `\x00S${strings.length - 1}\x00`; });

  const comments: string[] = [];
  s = s.replace(/\/\/[^\n]*/g, (m) => { comments.push(m); return `\x00C${comments.length - 1}\x00`; });
  s = s.replace(/#[^\n]*/g, (m) => { comments.push(m); return `\x00C${comments.length - 1}\x00`; });

  s = s.replace(
    /\b(import|export|from|const|let|var|function|return|new|class|extends|implements|interface|type|async|await|default|true|false|null|undefined|void|public|private|static|readonly|if|else|for|while|do|in|of|try|catch|finally|throw|yield|super|this|curl|bash|echo)\b/g,
    '<span style="color:#60a5fa">$1</span>',
  );
  s = s.replace(/@\w+/g, (m) => `<span style="color:#c084fc">${m}</span>`);
  s = s.replace(/&lt;\?php/g, '<span style="color:#c084fc">&lt;?php</span>');
  s = s.replace(/^---$/gm, '<span style="color:#4b5563">---</span>');
  s = s.replace(/\x00S(\d+)\x00/g, (_, i) => `<span style="color:#f97316">${strings[+i]}</span>`);
  s = s.replace(/\x00C(\d+)\x00/g, (_, i) => `<span style="color:#6b7280">${comments[+i]}</span>`);

  // JSON keys
  s = s.replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span style="color:#34d399">$1</span>$2');
  // HTTP methods standalone
  s = s.replace(/\b(GET|POST|PUT|DELETE|PATCH)\b/g, '<span style="color:#f97316;font-weight:700">$1</span>');
  // Numbers
  s = s.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#a78bfa">$1</span>');

  return s;
}

// ─── Highlighted pre (no copy button — used for framework guides) ─────────────

function HCode({ code, py = "py-5" }: { code: string; py?: string }) {
  return (
    <pre
      className={`border border-[#222] bg-black rounded-md px-4 ${py} text-[12.5px] font-mono leading-relaxed overflow-x-auto`}
      dangerouslySetInnerHTML={{ __html: highlight(code) }}
    />
  );
}

// ─── Code Examples tab block (curl/Python/Node/Java/Go/Rust) ────────────────

const EXAMPLE_LANGS = [
  { id: "curl",   label: "curl",    slug: "gnubash",   color: "4EAA25", file: "extract.sh"   },
  { id: "python", label: "Python",  slug: "python",    color: null,     file: "extract.py"   },
  { id: "node",   label: "Node.js", slug: "nodedotjs", color: null,     file: "extract.mjs"  },
  { id: "java",   label: "Java",    slug: "openjdk",   color: "ED8B00", file: "Extract.java" },
  { id: "go",     label: "Go",      slug: "go",        color: null,     file: "main.go"      },
  { id: "rust",   label: "Rust",    slug: "rust",      color: "CE422B", file: "main.rs"      },
] as const;

const EXAMPLE_CODES: Record<string, string> = {
  curl: `curl -X POST https://api.olpdf.xyz/v1/extract \\\n  -H "Authorization: Bearer <your_key>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://example.com/invoice.pdf","mode":"semantic"}'`,
  python: `import requests\n\nresp = requests.post(\n    "https://api.olpdf.xyz/v1/extract",\n    headers={"Authorization": "Bearer <your_key>"},\n    json={"url": "https://example.com/invoice.pdf", "mode": "semantic"},\n)\nprint(resp.json()["blocks"])`,
  node: `const res = await fetch("https://api.olpdf.xyz/v1/extract", {\n  method: "POST",\n  headers: { "Authorization": "Bearer <your_key>", "Content-Type": "application/json" },\n  body: JSON.stringify({ url: "https://example.com/invoice.pdf", mode: "semantic" }),\n});\nconst { blocks } = await res.json();`,
  java: `import java.net.http.*;\nimport java.net.URI;\n\nvar client = HttpClient.newHttpClient();\nvar body = "{\\"url\\":\\"https://example.com/invoice.pdf\\",\\"mode\\":\\"semantic\\"}";\nvar req = HttpRequest.newBuilder()\n    .uri(URI.create("https://api.olpdf.xyz/v1/extract"))\n    .header("Authorization", "Bearer <your_key>")\n    .header("Content-Type", "application/json")\n    .POST(HttpRequest.BodyPublishers.ofString(body))\n    .build();\nSystem.out.println(client.send(req, HttpResponse.BodyHandlers.ofString()).body());`,
  go: `package main\n\nimport (\n    "bytes"; "encoding/json"; "fmt"; "net/http"\n)\n\nfunc main() {\n    payload, _ := json.Marshal(map[string]string{\n        "url": "https://example.com/invoice.pdf", "mode": "semantic",\n    })\n    req, _ := http.NewRequest("POST", "https://api.olpdf.xyz/v1/extract", bytes.NewBuffer(payload))\n    req.Header.Set("Authorization", "Bearer <your_key>")\n    req.Header.Set("Content-Type", "application/json")\n    resp, _ := http.DefaultClient.Do(req)\n    defer resp.Body.Close()\n    fmt.Println(resp.Status)\n}`,
  rust: `use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};\nuse serde_json::json;\n\n#[tokio::main]\nasync fn main() -> Result<(), reqwest::Error> {\n    let res = reqwest::Client::new()\n        .post("https://api.olpdf.xyz/v1/extract")\n        .header(AUTHORIZATION, "Bearer <your_key>")\n        .header(CONTENT_TYPE, "application/json")\n        .json(&json!({"url":"https://example.com/invoice.pdf","mode":"semantic"}))\n        .send().await?;\n    println!("{}", res.text().await?);\n    Ok(())\n}`,
};

function CodeExamplesBlock() {
  const [active, setActive] = useState("curl");
  const [copied, setCopied] = useState(false);
  const lang = EXAMPLE_LANGS.find((l) => l.id === active)!;
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(EXAMPLE_CODES[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [active]);
  const iconSrc = (l: typeof EXAMPLE_LANGS[number]) =>
    l.color ? `https://cdn.simpleicons.org/${l.slug}/${l.color}` : `https://cdn.simpleicons.org/${l.slug}`;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between border-b border-[#222] px-1">
        <div className="flex items-center gap-1">
        {EXAMPLE_LANGS.map((l) => (
          <button key={l.id} onClick={() => setActive(l.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all ${
              active === l.id
                ? "border-white text-white"
                : "border-transparent text-[#888] hover:text-[#ededed]"
            }`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc(l)} alt={l.label} width={14} height={14} className="shrink-0" />
            {l.label}
          </button>
        ))}
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 px-2 text-xs text-[#888] hover:text-white transition-colors font-medium">
          {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <DocumentDuplicateIcon className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="rounded-md overflow-hidden border border-[#222] bg-black">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0A0A0A] border-b border-[#222]">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc(lang)} alt={lang.label} width={12} height={12} />
            <span className="text-xs font-mono text-[#666]">{lang.file}</span>
          </div>
        </div>
        <pre className="p-4 overflow-x-auto leading-relaxed text-[13px] font-mono text-[#ededed] min-h-[180px]"
          dangerouslySetInnerHTML={{ __html: highlight(EXAMPLE_CODES[active]) }} />
      </div>
    </div>
  );
}

// ─── API Key Examples tab block ──────────────────────────────────────────────

const API_KEY_CODES: Record<string, string> = {
  curl: `# Step 1 — create an API key (one time)
curl -X POST https://api.olpdf.xyz/api/api-keys \\
  -H "Authorization: Bearer <supabase_jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Production Backend"}'
# => { "key": "olpdf_live_xxxx..." }  ← save this, shown once

# Step 2 — use the key in any request
curl -X POST https://api.olpdf.xyz/v1/extract \\
  -H "Authorization: Bearer olpdf_live_xxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com/doc.pdf","mode":"semantic"}'`,

  python: `import requests

API_KEY = "olpdf_live_xxxx..."  # from your dashboard
BASE    = "https://api.olpdf.xyz"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

# Extract a document
resp = requests.post(
    f"{BASE}/v1/extract",
    headers=HEADERS,
    json={"url": "https://example.com/doc.pdf", "mode": "semantic"},
)
blocks = resp.json()["blocks"]
print(f"Extracted {len(blocks)} blocks")`,

  node: `const API_KEY = process.env.OLPDF_API_KEY; // "olpdf_live_xxxx..."
const BASE    = "https://api.olpdf.xyz";

async function extract(url: string) {
  const res = await fetch(\`\${BASE}/v1/extract\`, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, mode: "semantic" }),
  });
  if (!res.ok) throw new Error(\`OLPDF error: \${res.status}\`);
  const { blocks } = await res.json();
  return blocks;
}`,

  java: `import java.net.http.*;
import java.net.URI;

public class OlpdfClient {
    private static final String BASE    = "https://api.olpdf.xyz";
    private static final String API_KEY = System.getenv("OLPDF_API_KEY");
    private final HttpClient client     = HttpClient.newHttpClient();

    public String extract(String docUrl) throws Exception {
        var body = String.format(
            "{\\"url\\":\\"%s\\",\\"mode\\":\\"semantic\\"}", docUrl);
        var req = HttpRequest.newBuilder()
            .uri(URI.create(BASE + "/v1/extract"))
            .header("Authorization", "Bearer " + API_KEY)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        return client.send(req, HttpResponse.BodyHandlers.ofString()).body();
    }
}`,

  go: `package olpdf

import (
    "bytes"; "encoding/json"; "fmt"
    "net/http"; "os"
)

var (
    apiKey = os.Getenv("OLPDF_API_KEY")
    base   = "https://api.olpdf.xyz"
)

func Extract(docURL string) (*http.Response, error) {
    payload, _ := json.Marshal(map[string]string{
        "url": docURL, "mode": "semantic",
    })
    req, _ := http.NewRequest("POST",
        fmt.Sprintf("%s/v1/extract", base),
        bytes.NewBuffer(payload))
    req.Header.Set("Authorization", "Bearer "+apiKey)
    req.Header.Set("Content-Type", "application/json")
    return http.DefaultClient.Do(req)
}`,

  rust: `use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;
use std::env;

pub struct OlpdfClient {
    api_key: String,
    client: reqwest::Client,
}

impl OlpdfClient {
    pub fn new() -> Self {
        Self {
            api_key: env::var("OLPDF_API_KEY").expect("OLPDF_API_KEY not set"),
            client: reqwest::Client::new(),
        }
    }

    pub async fn extract(&self, url: &str) -> reqwest::Result<serde_json::Value> {
        self.client
            .post("https://api.olpdf.xyz/v1/extract")
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(CONTENT_TYPE, "application/json")
            .json(&json!({"url": url, "mode": "semantic"}))
            .send().await?
            .json().await
    }
}`,
};

function ApiKeyExamplesBlock() {
  const [active, setActive] = useState("curl");
  const [copied, setCopied] = useState(false);
  const lang = EXAMPLE_LANGS.find((l) => l.id === active)!;
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(API_KEY_CODES[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [active]);
  const iconSrc = (l: typeof EXAMPLE_LANGS[number]) =>
    l.color ? `https://cdn.simpleicons.org/${l.slug}/${l.color}` : `https://cdn.simpleicons.org/${l.slug}`;
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Usage examples</p>
      <div className="mb-3 flex items-center justify-between border-b border-[#222] px-1">
        <div className="flex items-center gap-1">
        {EXAMPLE_LANGS.map((l) => (
          <button key={l.id} onClick={() => setActive(l.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all ${
              active === l.id
                ? "border-white text-white"
                : "border-transparent text-[#888] hover:text-[#ededed]"
            }`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc(l)} alt={l.label} width={14} height={14} className="shrink-0" />
            {l.label}
          </button>
        ))}
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 px-2 text-xs text-[#888] hover:text-white transition-colors font-medium">
          {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <DocumentDuplicateIcon className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="rounded-md overflow-hidden border border-[#222] bg-black">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0A0A0A] border-b border-[#222]">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc(lang)} alt={lang.label} width={12} height={12} />
            <span className="text-xs font-mono text-[#666]">{lang.file}</span>
          </div>
        </div>
        <pre className="p-4 overflow-x-auto leading-relaxed text-[13px] font-mono text-[#ededed] min-h-[200px]"
          dangerouslySetInnerHTML={{ __html: highlight(API_KEY_CODES[active]) }} />
      </div>
    </div>
  );
}
// ─── Code Block ──────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "json", filename }: { code: string; lang?: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="rounded-md overflow-hidden border border-[#222] bg-black">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0A0A0A] border-b border-[#222]">
        <span className="text-xs font-mono text-[#666] uppercase tracking-widest">{filename ?? lang}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white transition-colors font-medium">
          {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <DocumentDuplicateIcon className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="p-4 overflow-x-auto leading-relaxed text-[13px] font-mono text-[#ededed]"
        dangerouslySetInnerHTML={{ __html: highlight(code) }}
      />
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
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono uppercase tracking-wider ${colors[method] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30"} shrink-0`}>
      {method}
    </span>
  );
}

// ─── Param Table ─────────────────────────────────────────────────────────────

function ParamTable({ rows }: { rows: { name: string; type: string; required?: boolean; desc: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#333] text-[#666]">
            <th className="pb-2 font-medium w-1/3">Parameter</th>
            <th className="pb-2 font-medium w-2/3">Description</th>
          </tr>
        </thead>
        <tbody className="text-[#ededed]">
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[#222] last:border-0 align-top">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-[13px] text-orange-400">{r.name}</code>
                  {r.required && <span className="text-[10px] text-red-500 font-medium">Required</span>}
                </div>
                <div className="text-xs font-mono text-[#666] mt-1">{r.type}</div>
              </td>
              <td className="py-3 text-[#888] text-sm leading-relaxed">{r.desc}</td>
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
  const hasDetail = !!(params || request || response);

  return (
    <div className="mb-10 pb-6 border-b border-[#222]">
      <div className="flex items-start sm:items-center gap-3 font-mono text-sm mb-3">
        <MethodBadge method={method} />
        <span className="text-white break-all">{path}</span>
        {auth && <span className="text-[10px] text-[#666] border border-[#333] rounded px-1.5 py-0.5">auth</span>}
      </div>
      <p className="text-sm text-[#888] leading-relaxed max-w-2xl">{desc}</p>

      {hasDetail && (
        <div className="space-y-5 mt-5">
          {params && (
            <div>
              <p className="text-sm font-semibold text-white mb-3">Parameters</p>
              <ParamTable rows={params} />
            </div>
          )}
          {request && (
            <div>
              <p className="text-sm font-semibold text-white mb-3">Request Body</p>
              <CodeBlock code={request} lang="json" />
            </div>
          )}
          {response && (
            <div>
              <p className="text-sm font-semibold text-white mb-3">Response</p>
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
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>}
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
      <p className="text-sm font-black uppercase tracking-widest mb-1.5">{labels[type]}</p>
      <div className="text-base text-[var(--text-secondary)] font-medium leading-relaxed">{children}</div>
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
    <main className="relative min-h-screen overflow-x-hidden bg-black text-text-primary selection:bg-accent/30 transition-colors duration-500">
      <AmbientBackground />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto flex">

        {/* ── Sidebar ── */}
        <aside className="hidden lg:block w-72 shrink-0 self-start sticky top-0 max-h-screen overflow-y-auto py-12 pl-8 pr-6 border-r liquid-glass liquid-glass-noise z-30 custom-scrollbar">
          <Link href="/" className="inline-flex items-center mb-10 group active:scale-95 transition-all">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl border border-accent/20 bg-accent/5 shadow-inner mr-3 group-hover:rotate-6 transition-transform">
               <span className="font-sans font-black tracking-tighter text-accent text-xl italic">O</span>
            </div>
            <div className="flex flex-col">
               <span className="font-sans font-black tracking-tighter text-text-primary text-base leading-none">OLPDF <span className="text-accent italic">DOCS</span></span>
               <span className="font-mono text-[8px] uppercase tracking-widest text-text-tertiary mt-0.5 opacity-60">Kernel_v1.02_STABLE</span>
            </div>
          </Link>

          <nav className="space-y-8">
            {NAV.map((item, i) => {
              if (item.type === "header") return (
                <div key={i} className="flex items-center gap-2 mt-8 mb-4">
                   <div className="h-px flex-1 bg-border-subtle" />
                   <p className="font-mono text-[9px] font-black text-text-tertiary uppercase tracking-[0.2em]">{item.label}</p>
                </div>
              );
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <Link key={item.id} href={`#${item.id}`}
                  className={cn(
                    "flex items-center gap-3 pl-4 py-2 text-xs font-bold uppercase tracking-widest border-l-2 transition-all group",
                    active
                      ? "text-accent border-accent bg-accent/5 shadow-[inset_4px_0_12px_-2px_rgba(217,119,6,0.05)]"
                      : "text-text-tertiary border-transparent hover:text-text-primary hover:border-border-strong hover:bg-white/5"
                  )}>
                  {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110", active ? "text-accent" : "opacity-40")} />}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 py-12 px-8 lg:px-12 xl:px-16 space-y-32 max-w-5xl">

          <div className="scroll-mt-24 relative">
            <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-accent/5 blur-[120px] pointer-events-none" />

            <BackLink href="/" label="Exit Workspace" className="mb-12 opacity-60 hover:opacity-100 transition-opacity font-mono text-[10px] uppercase tracking-widest" />

            <div className="flex items-center gap-3 mb-6 animate-reveal">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="font-mono text-[10px] font-black text-text-tertiary uppercase tracking-[0.3em]">Runtime: API_V1_STABLE_BETA</span>
            </div>

            <h1 className="mb-6 text-5xl md:text-7xl font-sans font-black tracking-tighter text-text-primary uppercase italic animate-reveal" style={{ animationDelay: '0.1s' }}>
               Core Technical<br />Documentation
            </h1>

            <p className="max-w-2xl text-lg font-sans font-medium text-text-secondary leading-relaxed animate-reveal" style={{ animationDelay: '0.2s' }}>
              The definitive architecture reference for the OLPDF REST API, Studio orchestration loop, and high-fidelity PDF manipulation kernel.
            </p>
          </div>

          {/* ─── OVERVIEW ──────────────────────────────────────────── */}
          <section id="overview" className="scroll-mt-24 animate-reveal" style={{ animationDelay: '0.3s' }}>
            <SectionHead icon={GlobeAltIcon} title="Architecture Overview" subtitle="System entry points, versioning protocol, and content schemas" color="text-blue-400" />

            <div className="space-y-8">
              <div className="p-8 rounded-2xl liquid-glass-strong border border-border-strong shadow-panel group overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                   <GlobeAltIcon className="h-24 w-24" />
                </div>
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary mb-4 opacity-70">Internal API Gateway</p>
                <code className="font-sans font-black text-2xl md:text-3xl text-accent break-all tracking-tighter">https://api.olpdf.xyz</code>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "Security",     value: "Strict TLS 1.3" },
                  { label: "Payload",       value: "UTF-8 Binary JSON" },
                  { label: "Route ID",   value: "V1 Prefix Enforced" },
                ].map(({ label, value }) => (
                  <div key={label} className="p-5 rounded-xl liquid-glass border border-border-subtle hover:border-accent/30 transition-colors group">
                    <p className="font-mono text-[9px] font-black uppercase tracking-widest text-text-tertiary mb-2 group-hover:text-accent transition-colors">{label}</p>
                    <p className="font-sans font-black text-sm text-text-primary uppercase tracking-tight">{value}</p>
                  </div>
                ))}
              </div>

              <p className="text-text-secondary font-sans font-medium leading-relaxed text-base max-w-3xl">
                All high-level orchestration requests must use <code className="font-mono text-accent bg-accent/5 px-1.5 py-0.5 rounded border border-accent/20">application/json</code>.
                Large-scale binary stream ingestion (PDF reconstruction) utilizes optimized <code className="font-mono text-accent bg-accent/5 px-1.5 py-0.5 rounded border border-accent/20">multipart/form-data</code> pipelines.
              </p>
            </div>
          </section>

          {/* ─── QUICK START ───────────────────────────────────────── */}
          <section id="quickstart" className="scroll-mt-24">
            <SectionHead icon={BoltIcon} title="Rapid Deployment" subtitle="Synthesize and manipulate documents in under 180 seconds" color="text-amber-400" />

            <div className="space-y-10">
              <div className="grid gap-4 sm:grid-cols-3">
                {["Ingest PDF for semantic kernel extraction", "Issue Agentic instructions for transformation", "Commit and export to binary archive"].map((step, i) => (
                  <div key={i} className="flex flex-col gap-4 p-6 rounded-2xl liquid-glass border border-border-subtle relative overflow-hidden group hover:border-accent/40 transition-all">
                    <div className="absolute -right-4 -bottom-4 h-16 w-16 flex items-center justify-center font-sans font-black text-6xl text-text-tertiary opacity-5 group-hover:opacity-10 transition-opacity italic">
                       {i + 1}
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-surface border border-border-strong flex items-center justify-center font-mono text-[10px] font-black text-text-tertiary">
                       MOD_0{i + 1}
                    </div>
                    <p className="text-sm font-sans font-black uppercase tracking-tight text-text-primary leading-tight relative z-10">{step}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                 <CodeBlock filename="kernel_init.sh" lang="bash" code={`# 1. Ingest + Map Structure
curl -X POST https://api.olpdf.xyz/v1/extract \\
  -H "Authorization: Bearer beta_key_v1" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://cdn.xyz/src.pdf", "mode": "fidelity"}'

# Response: { "document_id": "kernel_7f3", "blocks": [...] }`} />

                 <CodeBlock filename="agent_commit.py" lang="python" code={`import requests

# 2. Agentic Transformation Loop
requests.post("https://api.olpdf.xyz/api/ai/instruction",
    headers={"X-API-Key": "live_key_99"},
    json={"instruction": "Standardize all H1 nodes to obsidian-italic"}
)`} />
              </div>
            </div>
          </section>


          {/* ─── CODE EXAMPLES ─────────────────────────────────────────── */}
          <section id="code-examples" className="scroll-mt-24">
            <SectionHead icon={CommandLineIcon} title="Code Examples" subtitle="Extract and edit a PDF in curl, Python, Node, Java, Go, and Rust" color="text-orange-400" />
            <CodeExamplesBlock />
          </section>
{/* ─── AUTHENTICATION ────────────────────────────────────── */}
          <section id="authentication" className="scroll-mt-24">
            <SectionHead icon={LockClosedIcon} title="Authentication" subtitle="Bearer JWT tokens and persistent API keys" color="text-purple-400" />

            <div className="space-y-8">
              <p className="text-[var(--text-secondary)] font-medium leading-relaxed text-base">
                All <code className="font-mono text-amber-500">/api/*</code> endpoints require authentication via one of two mechanisms.
                Worker callback routes (<code className="font-mono text-amber-500">/api/worker/*</code>) use QStash signature verification instead.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
                  <div className="flex items-center gap-2">
                    <LockClosedIcon className="h-4 w-4 text-purple-400" />
                    <h4 className="font-black text-base">Bearer JWT (User Sessions)</h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                    Issued by Supabase Auth. Short-lived (1 hour), auto-refreshed by the SDK.
                    Use for user-facing integrations.
                  </p>
                  <CodeBlock lang="http" code={`Authorization: Bearer eyJhbGci...`} />
                </div>
                <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyIcon className="h-4 w-4 text-amber-400" />
                    <h4 className="font-black text-base">API Key (Machine-to-Machine)</h4>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
                    Long-lived keys generated in the dashboard. Stored as SHA-256 hashes server-side. Never expire unless rotated.
                  </p>
                  <CodeBlock lang="http" code={`X-API-Key: olpdf_live_xxxxxxxxxxxx`} />
                </div>
              </div>

              <Callout type="warn">
                The <code>free_beta_key</code> is a public testing credential with a 10 req/min limit. Generate a personal API key in your dashboard for production use.
              </Callout>

              <div>
                <h4 className="font-black text-base mb-4 text-[var(--text-primary)]">Error Responses</h4>
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
            <SectionHead icon={ClockIcon} title="Rate Limits" subtitle="Per-IP burst limits enforced via Redis sliding window" color="text-orange-400" />

            <div className="space-y-6">
              <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                      {["Tier", "Limit", "Window", "Scope"].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-sm">{h}</th>
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
              <p className="text-sm text-[var(--text-secondary)] font-medium">
                When a limit is exceeded the API returns <code className="font-mono text-red-400">429 Too Many Requests</code> with a
                <code className="font-mono text-amber-500"> Retry-After</code> header in seconds.
              </p>
            </div>
          </section>

          {/* ─── DOCUMENTS ─────────────────────────────────────────── */}
          <section id="api-documents" className="scroll-mt-24">
            <SectionHead icon={DocumentTextIcon} title="Documents" subtitle="Create, read, update, export, and version documents" color="text-blue-400" />

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
            <SectionHead icon={SparklesIcon} title="AI Operations" subtitle="Gemini-powered structural editing with full audit trail" color="text-[var(--accent)]" />

            <div className="space-y-6 mb-6">
              <p className="text-base text-[var(--text-secondary)] font-medium leading-relaxed">
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
            <SectionHead icon={CpuChipIcon} title="PDF Toolkit" subtitle="Low-level binary PDF operations — merge, split, redact, compress" color="text-blue-600" />

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
            <SectionHead icon={BookOpenIcon} title="Books" subtitle="Multi-chapter publication workspace with cross-chapter consistency" color="text-purple-400" />

            <div className="space-y-6 mb-6">
              <p className="text-base text-[var(--text-secondary)] font-medium leading-relaxed">
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
            <SectionHead icon={Squares2X2Icon} title="Templates" subtitle="Reusable structural scaffolds for new documents" color="text-emerald-400" />

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
            <SectionHead icon={PencilSquareIcon} title="Annotations" subtitle="Comments and notes attached to document blocks" color="text-pink-400" />

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
            <SectionHead icon={LinkIcon} title="Webhooks" subtitle="Real-time event push to your own HTTPS endpoints" color="text-cyan-400" />

            <div className="space-y-6">
              <p className="text-base text-[var(--text-secondary)] font-medium leading-relaxed">
                Webhooks are signed with HMAC-SHA256 using your webhook secret. Always verify the
                <code className="font-mono text-amber-500"> X-OLPDF-Signature</code> header before processing events.
              </p>

              <div>
                <p className="text-sm font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Available Events</p>
                <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                        {["Event", "Description"].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-sm">{h}</th>
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
                <p className="text-sm font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Payload Example — document.ready</p>
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
            <SectionHead icon={KeyIcon} title="API Keys" subtitle="Create and manage persistent machine-to-machine credentials" color="text-amber-400" />

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
              <ApiKeyExamplesBlock />
              <Endpoint method="DELETE" path="/api/api-keys/{key_id}"
                desc="Revoke an API key immediately. Any requests using this key will return 401."
                response={`{ "deleted": true }`}
              />
            </div>
          </section>

          {/* ─── ERRORS ────────────────────────────────────────────── */}
          <section id="errors" className="scroll-mt-24">
            <SectionHead icon={ExclamationTriangleIcon} title="Error Reference" subtitle="Standard error envelope and HTTP status codes" color="text-red-400" />

            <div className="space-y-6">
              <p className="text-base text-[var(--text-secondary)] font-medium leading-relaxed">
                All errors follow a consistent envelope format:
              </p>
              <CodeBlock lang="json" code={`{
  "error": "api_error",
  "message": "Human-readable description of what went wrong",
  "code": "DOCUMENT_NOT_FOUND"  // optional machine-readable code
}`} />

              <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                      {["HTTP Status", "Meaning", "Common Cause"].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-black text-[var(--text-secondary)] uppercase tracking-widest text-sm">{h}</th>
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
            <SectionHead icon={CircleStackIcon} title="Self-Hosting" subtitle="Deploy your own OLPDF instance on Fly.io or Docker" color="text-emerald-400" />

            <div className="space-y-8">
              <p className="text-base text-[var(--text-secondary)] font-medium leading-relaxed">
                OLPDF is fully open-source under the MIT license. The stack comprises a Next.js frontend (Vercel or self-hosted),
                a FastAPI backend (Fly.io or Docker), and a Modal GPU worker for OCR. This guide covers Fly.io deployment.
              </p>

              <div>
                <h4 className="font-black text-base mb-3 text-[var(--text-primary)]">Prerequisites</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  {["Supabase project (PostgreSQL + Auth + Storage)", "Cloudflare R2 bucket", "Google Gemini API key", "Upstash QStash (job queue)", "Upstash Redis (rate limiting)", "Modal Labs account (OCR worker)"].map(p => (
                    <div key={p} className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-black text-base mb-3 text-[var(--text-primary)]">1. Clone and install</h4>
                <CodeBlock filename="terminal" code={`git clone https://github.com/chidi09/olpdf.git
cd olpdf
pnpm install`} />
              </div>

              <div>
                <h4 className="font-black text-base mb-3 text-[var(--text-primary)]">2. Deploy Redis on Fly.io</h4>
                <CodeBlock filename="terminal" code={`fly redis create --name olpdf-redis --region ams --no-replicas
# Copy the redis:// URL printed — you'll need it below`} />
              </div>

              <div>
                <h4 className="font-black text-base mb-3 text-[var(--text-primary)]">3. Deploy the FastAPI backend</h4>
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
                <h4 className="font-black text-base mb-3 text-[var(--text-primary)]">4. Deploy the Next.js frontend to Vercel</h4>
                <CodeBlock filename="terminal" code={`vercel --prod
# Add these environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# NEXT_PUBLIC_API_URL=https://olpdf.fly.dev`} />
              </div>

              <div>
                <h4 className="font-black text-base mb-3 text-[var(--text-primary)]">5. Run Supabase migrations</h4>
                <CodeBlock filename="terminal" code={`supabase db push
# Or apply manually:
psql $SUPABASE_DB_URL < supabase/migrations/*.sql`} />
              </div>

              <div>
                <h4 className="font-black text-base mb-3 text-[var(--text-primary)]">6. Deploy the Modal OCR worker</h4>
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
                <h4 className="font-black text-base mb-3 text-[var(--text-primary)]">Fly.io machine configuration (fly.toml)</h4>
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
            <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">The <code className="font-mono text-amber-500 text-base">@olpdf/embed</code> package lets you embed the full OLPDF editor inside any web application via a lightweight postMessage bridge. The host page renders an iframe pointing at your OLPDF instance; the SDK handles all communication transparently.</p>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: "Zero dependencies", desc: "No React, Vue, or Angular required in the host app." },
                { label: "postMessage bridge", desc: "Secure cross-origin communication with origin validation." },
                { label: "Full AST events", desc: "Receive the complete DocumentModel on every edit." },
              ].map(({ label, desc }) => (
                <div key={label} className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <div className="text-sm font-black text-orange-500 uppercase tracking-widest mb-1">{label}</div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="embed-install" className="scroll-mt-24 mt-12">
            <h2 className="text-2xl font-black mb-3 text-[var(--text-primary)]">Installation</h2>
            <div className="bg-[#111113] rounded-xl border border-[#2a2a2e] px-5 py-4 font-mono text-base mb-4">
              <span className="text-[#6b7280]">$</span> <span className="text-white">npm install </span><span className="text-orange-400">@olpdf/embed</span>
            </div>
            <p className="text-[var(--text-secondary)] text-base mb-3">Or load from CDN (no bundler required):</p>
            <div className="bg-[#111113] rounded-xl border border-[#2a2a2e] px-5 py-4 font-mono text-base mb-6">
              <span className="text-[#60a5fa]">import</span> <span className="text-white">{"{ OlPDFEmbed }"}</span> <span className="text-[#60a5fa]">from</span> <span className="text-orange-400">&apos;https://cdn.jsdelivr.net/npm/@olpdf/embed&apos;</span><span className="text-[#6b7280]">;</span>
            </div>
          </section>

          <section id="embed-events" className="scroll-mt-24 mt-12">
            <h2 className="text-2xl font-black mb-3 text-[var(--text-primary)]">Events</h2>
            <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">Subscribe to events using <code className="font-mono text-amber-500 text-base">editor.on(event, handler)</code>. Each call returns an unsubscribe function.</p>
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-base">
                <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                  <tr>
                    {["Event", "Payload", "Description"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-sm font-black uppercase tracking-widest text-[var(--text-tertiary)]">{h}</th>
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
                      <td className="px-4 py-3 font-mono text-sm text-orange-400 whitespace-nowrap">{event}</td>
                      <td className="px-4 py-3 font-mono text-sm text-[var(--text-secondary)] whitespace-nowrap">{payload}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="embed-frameworks" className="scroll-mt-24 mt-12">
            <h2 className="text-2xl font-black mb-2 text-[var(--text-primary)]">Framework Guides</h2>
            <p className="text-[var(--text-secondary)] mb-10 leading-relaxed">
              The SDK is framework-agnostic — it only needs a mounted DOM element as a container.
              The golden rule: call <code className="font-mono text-amber-500 text-base">new OlPDFEmbed(el, opts)</code> <strong className="text-[var(--text-primary)]">after</strong> the element is in the DOM,
              and always call <code className="font-mono text-amber-500 text-base">editor.destroy()</code> when the component unmounts to avoid iframe leaks.
            </p>

            {/* ── Next.js ── */}
            <div className="mb-12 pb-12 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.simpleicons.org/nextdotjs/ffffff" alt="Next.js" width={22} height={22} />
                <h3 className="text-lg font-black text-[var(--text-primary)]">Next.js</h3>
              </div>
              <p className="text-base text-[var(--text-secondary)] mb-4 leading-relaxed">
                Because OlPDFEmbed interacts with the DOM directly, you must mark the file with <code className="font-mono text-amber-500 text-sm">&apos;use client&apos;</code>.
                Use <code className="font-mono text-amber-500 text-sm">useRef</code> to get a stable reference to the container div, and <code className="font-mono text-amber-500 text-sm">useEffect</code> to
                instantiate the editor after the component mounts. Return <code className="font-mono text-amber-500 text-sm">editor.destroy()</code> from the effect cleanup
                so React Hot Reload and strict-mode double-invocation don&apos;t leak iframes.
              </p>
              <HCode code={`'use client';
import { useEffect, useRef } from 'react';
import { OlPDFEmbed } from '@olpdf/embed';

interface PDFEditorProps {
  documentId: string;
  token: string;
  onSave?: (model: object) => void;
}

export default function PDFEditor({ documentId, token, onSave }: PDFEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = new OlPDFEmbed(containerRef.current, {
      host: 'https://olpdf.xyz',
      documentId,
      token,
    });

    // READY fires when the iframe is mounted and the editor is initialised
    editor.on('READY', () => console.log('OLPDF editor ready'));

    // MODEL_UPDATE carries the full AST after every edit
    editor.on('MODEL_UPDATE', ({ documentModel }) => {
      onSave?.(documentModel);
    });

    // PAGE_ADDED / PAGE_REMOVED fire when layout reflows overflow pages
    editor.on('PAGE_ADDED', ({ pageIndex, width, height }) => {
      console.log(\`Page \${pageIndex + 1} added (\${width}×\${height}pt)\`);
    });

    // Always destroy on unmount to remove the iframe and event listeners
    return () => editor.destroy();
  }, [documentId, token, onSave]);

  return (
    <div
      ref={containerRef}
      className="w-full h-screen"
      // Prevent parent scroll from interfering with the editor
      style={{ overflow: 'hidden' }}
    />
  );
}`} />
              <div className="mt-4 flex flex-col gap-2">
                {[
                  "documentId and token are effect dependencies — a new editor mounts automatically if they change.",
                  "For App Router, this component can be imported into any Server Component page without extra config.",
                  "If you use React Strict Mode the effect runs twice in development — destroy() handles cleanup correctly.",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-orange-500 mt-0.5 shrink-0">→</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Svelte ── */}
            <div className="mb-12 pb-12 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.simpleicons.org/svelte" alt="Svelte" width={22} height={22} />
                <h3 className="text-lg font-black text-[var(--text-primary)]">Svelte</h3>
              </div>
              <p className="text-base text-[var(--text-secondary)] mb-4 leading-relaxed">
                Use <code className="font-mono text-amber-500 text-sm">bind:this</code> to obtain the DOM element, then
                instantiate inside <code className="font-mono text-amber-500 text-sm">onMount</code>. Svelte guarantees the element exists by the time <code className="font-mono text-amber-500 text-sm">onMount</code> fires.
                Destroy in <code className="font-mono text-amber-500 text-sm">onDestroy</code>.
              </p>
              <HCode code={`<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { OlPDFEmbed } from '@olpdf/embed';

  export let documentId: string;
  export let token: string;

  let container: HTMLDivElement;
  let editor: OlPDFEmbed;

  onMount(() => {
    editor = new OlPDFEmbed(container, {
      host: 'https://olpdf.xyz',
      documentId,
      token,
    });

    editor.on('READY', () => console.log('Editor ready'));

    editor.on('MODEL_UPDATE', ({ documentModel }) => {
      // Persist or sync the full AST model
      console.log('Model updated', documentModel);
    });

    editor.on('EXPORT_COMPLETE', ({ url }) => {
      // url is a 24-hour signed download link
      window.open(url, '_blank');
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });
</script>

<div bind:this={container} class="w-full h-screen overflow-hidden" />`} />
              <div className="mt-4 flex flex-col gap-2">
                {[
                  "Use $: reactive statements to re-initialise if documentId or token change at runtime.",
                  "SSR is disabled by default for the embed — no special config needed in SvelteKit.",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-orange-500 mt-0.5 shrink-0">→</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Nuxt / Vue ── */}
            <div className="mb-12 pb-12 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.simpleicons.org/nuxt" alt="Nuxt" width={22} height={22} />
                <h3 className="text-lg font-black text-[var(--text-primary)]">Nuxt / Vue 3</h3>
              </div>
              <p className="text-base text-[var(--text-secondary)] mb-4 leading-relaxed">
                Use the Composition API with <code className="font-mono text-amber-500 text-sm">ref()</code> for the container element and <code className="font-mono text-amber-500 text-sm">onMounted</code> for instantiation.
                In Nuxt, wrap in <code className="font-mono text-amber-500 text-sm">&lt;ClientOnly&gt;</code> or add <code className="font-mono text-amber-500 text-sm">process.client</code> guard to avoid SSR errors since the SDK requires a browser DOM.
              </p>
              <HCode code={`<!-- components/PDFEditor.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { OlPDFEmbed } from '@olpdf/embed';

const props = defineProps<{
  documentId: string;
  token: string;
}>();

const emit = defineEmits<{
  modelUpdate: [model: object];
}>();

const container = ref<HTMLDivElement | null>(null);
let editor: OlPDFEmbed | null = null;

function initEditor() {
  if (!container.value) return;
  editor?.destroy();

  editor = new OlPDFEmbed(container.value, {
    host: 'https://olpdf.xyz',
    documentId: props.documentId,
    token: props.token,
  });

  editor.on('MODEL_UPDATE', ({ documentModel }) => {
    emit('modelUpdate', documentModel);
  });
}

onMounted(initEditor);

// Re-init when props change
watch(() => [props.documentId, props.token], initEditor);

onUnmounted(() => editor?.destroy());
</script>

<template>
  <div ref="container" class="w-full h-screen overflow-hidden" />
</template>`} />
              <div className="mt-4 flex flex-col gap-2">
                {[
                  "In Nuxt, wrap the component in <ClientOnly> in your page to skip SSR entirely.",
                  "The watch() call ensures a fresh editor if the documentId or token prop changes.",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-orange-500 mt-0.5 shrink-0">→</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Astro ── */}
            <div className="mb-12 pb-12 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.simpleicons.org/astro" alt="Astro" width={22} height={22} />
                <h3 className="text-lg font-black text-[var(--text-primary)]">Astro</h3>
              </div>
              <p className="text-base text-[var(--text-secondary)] mb-4 leading-relaxed">
                Astro is server-first. Place the <code className="font-mono text-amber-500 text-sm">&lt;script&gt;</code> tag inside the <code className="font-mono text-amber-500 text-sm">.astro</code> file
                (not the frontmatter fence). Astro bundles and defers client-side scripts automatically.
                No <code className="font-mono text-amber-500 text-sm">client:*</code> directive is needed since this is vanilla JS, not a framework component.
              </p>
              <HCode code={`---
// src/pages/editor/[id].astro
import Layout from '../layouts/Layout.astro';

const { id } = Astro.params;
// Fetch a short-lived embed token from your API
const token = await getEmbedToken(id);
---

<Layout>
  <div id="olpdf-container" class="w-full h-screen overflow-hidden"></div>
</Layout>

<script define:vars={{ documentId: id, token }}>
  // This script runs in the browser after hydration
  import { OlPDFEmbed } from '@olpdf/embed';

  const container = document.getElementById('olpdf-container');

  const editor = new OlPDFEmbed(container, {
    host: 'https://olpdf.xyz',
    documentId,
    token,
  });

  editor.on('READY', () => {
    console.log('OLPDF editor ready');
  });

  editor.on('MODEL_UPDATE', ({ documentModel }) => {
    // Send back to your server or store locally
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, documentModel }),
    });
  });
</script>`} />
              <div className="mt-4 flex flex-col gap-2">
                {[
                  "define:vars passes server-side variables into the client script safely.",
                  "For View Transitions (Astro 3+), re-init the editor on astro:page-load and destroy on astro:before-swap.",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-orange-500 mt-0.5 shrink-0">→</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Analog (Angular) ── */}
            <div className="mb-12 pb-12 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.simpleicons.org/angular/DD0031" alt="Analog" width={22} height={22} />
                <h3 className="text-lg font-black text-[var(--text-primary)]">Analog (Angular)</h3>
              </div>
              <p className="text-base text-[var(--text-secondary)] mb-4 leading-relaxed">
                Analog is the meta-framework built on Angular. Use <code className="font-mono text-amber-500 text-sm">@ViewChild</code> to obtain the native DOM element
                and <code className="font-mono text-amber-500 text-sm">ngAfterViewInit</code> to instantiate the editor — this lifecycle hook guarantees the view is fully rendered.
                Implement <code className="font-mono text-amber-500 text-sm">OnDestroy</code> to clean up.
              </p>
              <HCode code={`// pdf-editor.component.ts
import {
  Component, Input, Output, EventEmitter,
  AfterViewInit, OnDestroy,
  ViewChild, ElementRef
} from '@angular/core';
import { OlPDFEmbed } from '@olpdf/embed';

@Component({
  selector: 'app-pdf-editor',
  standalone: true,
  template: \`
    <div #container class="w-full h-screen overflow-hidden"></div>
  \`,
})
export class PDFEditorComponent implements AfterViewInit, OnDestroy {
  @Input() documentId!: string;
  @Input() token!: string;
  @Output() modelUpdate = new EventEmitter<object>();

  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  private editor?: OlPDFEmbed;

  ngAfterViewInit(): void {
    this.editor = new OlPDFEmbed(this.containerRef.nativeElement, {
      host: 'https://olpdf.xyz',
      documentId: this.documentId,
      token: this.token,
    });

    this.editor.on('READY', () => {
      console.log('OLPDF ready');
    });

    this.editor.on('MODEL_UPDATE', ({ documentModel }) => {
      this.modelUpdate.emit(documentModel);
    });

    this.editor.on('EXPORT_COMPLETE', ({ url }) => {
      window.open(url, '_blank');
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }
}`} />
              <div className="mt-4 flex flex-col gap-2">
                {[
                  "Mark the component standalone: true to use it without NgModule declarations.",
                  "If documentId changes at runtime, call destroy() and re-init in ngOnChanges().",
                  "Use Angular's HttpClient in the MODEL_UPDATE callback instead of raw fetch for interceptor support.",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-orange-500 mt-0.5 shrink-0">→</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Wix ── */}
            <div className="mb-12 pb-12 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.simpleicons.org/wix" alt="Wix" width={22} height={22} />
                <h3 className="text-lg font-black text-[var(--text-primary)]">Wix (Velo)</h3>
              </div>
              <p className="text-base text-[var(--text-secondary)] mb-4 leading-relaxed">
                In Wix Velo, all custom code runs in the <strong className="text-[var(--text-primary)]">Page Code panel</strong> (not a file you upload).
                Add an HTML Component element to your page, give it an ID (e.g. <code className="font-mono text-amber-500 text-sm">#editorBox</code>),
                then call <code className="font-mono text-amber-500 text-sm">$w(&apos;#editorBox&apos;).getEl()</code> inside <code className="font-mono text-amber-500 text-sm">$w.onReady</code> to get the underlying DOM element.
                Use the Wix NPM Packages panel to install <code className="font-mono text-amber-500 text-sm">@olpdf/embed</code>.
              </p>
              <HCode code={`// Page Code panel (Wix Velo)
import wixData from 'wix-data';
import wixUsers from 'wix-users';
import { OlPDFEmbed } from '@olpdf/embed';

$w.onReady(async () => {
  // Get the current user's session token for the embed
  const token = await wixUsers.currentUser.getToken();

  // #editorBox is an HTML Component element on your Wix page
  const containerEl = $w('#editorBox').getEl();

  const editor = new OlPDFEmbed(containerEl, {
    host: 'https://olpdf.xyz',
    documentId: $w('#documentIdInput').value,  // e.g. from a text input
    token,
  });

  editor.on('READY', () => {
    $w('#statusText').text = 'Editor loaded';
  });

  editor.on('MODEL_UPDATE', async ({ documentModel }) => {
    // Save the updated document model to Wix Data
    await wixData.save('Documents', {
      _id: $w('#documentIdInput').value,
      model: JSON.stringify(documentModel),
    });
    $w('#statusText').text = 'Saved ✓';
  });

  editor.on('EXPORT_COMPLETE', ({ url }) => {
    $w('#downloadButton').link = url;
    $w('#downloadButton').show();
  });
});`} />
              <div className="mt-4 flex flex-col gap-2">
                {[
                  "Install @olpdf/embed via Wix Editor → Packages & Apps → npm Packages.",
                  "The HTML Component must have Allow Scrolling enabled in its settings panel.",
                  "wixUsers.currentUser.getToken() returns a Wix session token — pass this to your backend to exchange for an OLPDF embed token.",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-orange-500 mt-0.5 shrink-0">→</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── WordPress ── */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.simpleicons.org/wordpress" alt="WordPress" width={22} height={22} />
                <h3 className="text-lg font-black text-[var(--text-primary)]">WordPress</h3>
              </div>
              <p className="text-base text-[var(--text-secondary)] mb-4 leading-relaxed">
                WordPress has no npm build pipeline by default, so load the SDK from a CDN via <code className="font-mono text-amber-500 text-sm">wp_enqueue_script</code>
                and wire up the editor with <code className="font-mono text-amber-500 text-sm">wp_add_inline_script</code>. For block-based themes, create a
                custom block or use a Classic Widget with the HTML widget.
              </p>
              <HCode code={`<?php
// functions.php — enqueue the SDK and initialise the editor

add_action('wp_enqueue_scripts', function () {
    // Only load on the document editor page template
    if (!is_page_template('page-pdf-editor.php')) return;

    wp_enqueue_script(
        'olpdf-embed',
        'https://cdn.jsdelivr.net/npm/@olpdf/embed/dist/index.js',
        [],      // no dependencies
        '1.0',
        true     // load in footer, after DOM is ready
    );

    // Pass server-side data to the script safely
    $document_id = get_query_var('document_id');
    $embed_token = olpdf_generate_embed_token($document_id); // your helper

    wp_add_inline_script('olpdf-embed', sprintf('
        (function() {
            var container = document.getElementById("olpdf-editor");
            if (!container) return;

            var editor = new OlPDFEmbed(container, {
                host:       "https://olpdf.xyz",
                documentId: %s,
                token:      %s,
            });

            editor.on("READY", function () {
                console.log("OLPDF ready");
            });

            editor.on("MODEL_UPDATE", function (payload) {
                fetch(ajaxurl, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        action:      "olpdf_save",
                        document_id: %s,
                        model:       JSON.stringify(payload.documentModel),
                        nonce:       "%s",
                    }),
                });
            });
        })();
    ',
        wp_json_encode($document_id),
        wp_json_encode($embed_token),
        wp_json_encode($document_id),
        wp_create_nonce('olpdf_save')
    ));
});

// Add the AJAX handler for saving
add_action('wp_ajax_olpdf_save', function () {
    check_ajax_referer('olpdf_save', 'nonce');
    $document_id = sanitize_text_field($_POST['document_id']);
    $model       = wp_unslash($_POST['model']);
    update_post_meta($document_id, '_olpdf_model', $model);
    wp_send_json_success();
});`} />
              <p className="text-base text-[var(--text-secondary)] mt-4 mb-3">
                Add the container div to your page template (<code className="font-mono text-amber-500 text-sm">page-pdf-editor.php</code>):
              </p>
              <HCode py="py-4" code={`<!-- page-pdf-editor.php -->
<?php get_header(); ?>
<main>
  <div id="olpdf-editor" style="width:100%; height:90vh; overflow:hidden;"></div>
</main>
<?php get_footer(); ?>`} />
              <div className="mt-4 flex flex-col gap-2">
                {[
                  "Always use wp_json_encode() to pass PHP values to JavaScript — never echo raw strings.",
                  "wp_create_nonce() + check_ajax_referer() protect the save endpoint from CSRF.",
                  "For Gutenberg blocks, use @wordpress/scripts and import the SDK normally via npm in your block's edit.js.",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-orange-500 mt-0.5 shrink-0">→</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── .NET / Windows ── */}
            <div className="mt-12 pt-12 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://cdn.simpleicons.org/dotnet/512BD4" alt=".NET" width={22} height={22} />
                <h3 className="text-lg font-black text-[var(--text-primary)]">.NET — WinForms / WPF / MAUI</h3>
              </div>
              <p className="text-base text-[var(--text-secondary)] mb-4 leading-relaxed">
                Embed OLPDF into any Windows desktop app using <strong className="text-[var(--text-primary)]">WebView2</strong> — Microsoft&apos;s
                Chromium-based webview. Install the <code className="font-mono text-amber-500 text-sm">Olpdf</code> NuGet package for the API client
                and <code className="font-mono text-amber-500 text-sm">Microsoft.Web.WebView2</code> to host the editor iframe natively.
              </p>
              <div className="bg-[#111113] rounded-xl border border-[#2a2a2e] px-5 py-3 font-mono text-sm mb-5 text-[#e5e7eb]">
                <span className="text-[#6b7280]">$</span> <span className="text-white">dotnet add package </span><span className="text-[#c084fc]">Olpdf</span>
                <br />
                <span className="text-[#6b7280]">$</span> <span className="text-white">dotnet add package </span><span className="text-[#c084fc]">Microsoft.Web.WebView2</span>
              </div>
              <HCode code={`// OlpdfWindow.cs — WinForms example
using Microsoft.Web.WebView2.WinForms;
using Olpdf;
using System.Text.Json;

public partial class OlpdfWindow : Form
{
    private readonly WebView2 _view   = new() { Dock = DockStyle.Fill };
    private readonly OlpdfClient _api;

    public OlpdfWindow(string apiKey, string documentId, string embedToken)
    {
        _api = new OlpdfClient(apiKey);
        Controls.Add(_view);
        Text = "OLPDF Editor";
        ClientSize = new Size(1280, 800);
        _ = InitAsync(documentId, embedToken);
    }

    private async Task InitAsync(string documentId, string embedToken)
    {
        // Boot WebView2 runtime
        await _view.EnsureCoreWebView2Async();

        // Load the embed URL — OLPDF renders inside the webview
        _view.Source = new Uri(
            $"https://olpdf.xyz/embed/{documentId}?token={embedToken}");

        // Receive postMessage events from the iframe
        _view.CoreWebView2.WebMessageReceived += async (_, e) =>
        {
            var msg = JsonSerializer.Deserialize<OlpdfMessage>(e.WebMessageAsJson);
            if (msg?.Type == "MODEL_UPDATE" && msg.Data is not null)
            {
                // Persist the updated AST via the REST API
                await _api.SaveDocumentAsync(documentId, msg.Data);
            }
            if (msg?.Type == "EXPORT_COMPLETE")
            {
                System.Diagnostics.Process.Start(new ProcessStartInfo
                {
                    FileName = msg.Url, UseShellExecute = true
                });
            }
        };
    }
}

// OlpdfMessage.cs
public record OlpdfMessage(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("data")] DocumentModel? Data,
    [property: JsonPropertyName("url")]  string? Url
);`} />
              <div className="mt-4 flex flex-col gap-2">
                {[
                  "WebView2 runtime ships with Windows 11 and Edge — no installer needed on modern systems.",
                  "For WPF use Microsoft.Web.WebView2.Wpf; for MAUI use a BlazorWebView or WebView.",
                  "Generate a short-lived embed token server-side (POST /api/embed-token) and pass it to the client — never expose your API key in the desktop app.",
                  "Call _api.ExportAsync(documentId, 'pdf') from a toolbar button to download the finished PDF directly via the REST API.",
                ].map((note) => (
                  <div key={note} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <span className="text-orange-500 mt-0.5 shrink-0">→</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="py-12 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="font-black text-base text-[var(--text-primary)] mb-1">Something missing?</p>
              <p className="text-sm text-[var(--text-secondary)] font-medium">Open an issue or submit a PR on GitHub.</p>
            </div>
            <div className="flex gap-3">
              <Link href="https://github.com/chidi09/olpdf/issues" target="_blank"
                className="inline-flex items-center gap-2 px-5 h-10 rounded-xl border border-[var(--border-strong)] text-sm font-black uppercase tracking-widest hover:bg-[var(--bg-surface)] transition-colors">
                Open Issue <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
              <Link href="https://github.com/chidi09/olpdf" target="_blank"
                className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-[var(--text-primary)] text-[var(--bg-base)] text-sm font-black uppercase tracking-widest hover:opacity-90 transition-opacity">
                GitHub <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
