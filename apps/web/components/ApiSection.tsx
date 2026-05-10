"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Copy, Check, Terminal } from "lucide-react";

// ── Language catalogue ────────────────────────────────────────────────────────

const LANGUAGES = [
  { id: "curl",   label: "curl",     slug: "gnubash",   colorOverride: "4EAA25", file: "extract.sh"   },
  { id: "python", label: "Python",   slug: "python",    colorOverride: null,     file: "extract.py"   },
  { id: "node",   label: "Node.js",  slug: "nodedotjs", colorOverride: null,     file: "extract.mjs"  },
  { id: "java",   label: "Java",     slug: "openjdk",   colorOverride: null,     file: "Extract.java" },
  { id: "go",     label: "Go",       slug: "go",        colorOverride: null,     file: "main.go"      },
  { id: "rust",   label: "Rust",     slug: "rust",      colorOverride: "CE422B", file: "main.rs"      },
] as const;

type LangId = typeof LANGUAGES[number]["id"];

function iconUrl(slug: string, colorOverride: string | null) {
  return colorOverride
    ? `https://cdn.simpleicons.org/${slug}/${colorOverride}`
    : `https://cdn.simpleicons.org/${slug}`;
}

// ── Code snippets ─────────────────────────────────────────────────────────────

const CODES: Record<LangId, string> = {
  curl:
`curl -X POST https://api.olpdf.xyz/v1/extract \\
  -H "Authorization: Bearer free_beta_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com/invoice.pdf",
    "mode": "semantic"
  }'`,

  python:
`import requests

response = requests.post(
    "https://api.olpdf.xyz/v1/extract",
    headers={
        "Authorization": "Bearer free_beta_key",
        "Content-Type": "application/json",
    },
    json={
        "url": "https://example.com/invoice.pdf",
        "mode": "semantic",
    },
)
doc = response.json()
print(doc["blocks"])`,

  node:
`const res = await fetch("https://api.olpdf.xyz/v1/extract", {
  method: "POST",
  headers: {
    "Authorization": "Bearer free_beta_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://example.com/invoice.pdf",
    mode: "semantic",
  }),
});
const doc = await res.json();
console.log(doc.blocks);`,

  java:
`import java.net.http.*;
import java.net.URI;

var client = HttpClient.newHttpClient();
var body = """
    {"url":"https://example.com/invoice.pdf","mode":"semantic"}
    """;
var request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.olpdf.xyz/v1/extract"))
    .header("Authorization", "Bearer free_beta_key")
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();
var response = client.send(request,
    HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`,

  go:
`package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    payload, _ := json.Marshal(map[string]string{
        "url":  "https://example.com/invoice.pdf",
        "mode": "semantic",
    })
    req, _ := http.NewRequest("POST",
        "https://api.olpdf.xyz/v1/extract",
        bytes.NewBuffer(payload))
    req.Header.Set("Authorization", "Bearer free_beta_key")
    req.Header.Set("Content-Type", "application/json")
    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()
    fmt.Println(resp.Status)
}`,

  rust:
`use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.olpdf.xyz/v1/extract")
        .header(AUTHORIZATION, "Bearer free_beta_key")
        .header(CONTENT_TYPE, "application/json")
        .json(&json!({
            "url": "https://example.com/invoice.pdf",
            "mode": "semantic",
        }))
        .send()
        .await?;
    println!("{}", res.text().await?);
    Ok(())
}`,
};

// ── Syntax highlighter ────────────────────────────────────────────────────────

function highlight(raw: string): string {
  let s = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const strings: string[] = [];
  s = s.replace(/'[^'\n]*'|"[^"\n]*"/g, (m) => { strings.push(m); return `\x00S${strings.length - 1}\x00`; });

  const comments: string[] = [];
  s = s.replace(/\/\/[^\n]*/g, (m) => { comments.push(m); return `\x00C${comments.length - 1}\x00`; });
  s = s.replace(/#[^\n]*/g, (m) => { comments.push(m); return `\x00C${comments.length - 1}\x00`; });

  // Keywords
  s = s.replace(
    /\b(import|export|from|const|let|var|function|return|new|class|extends|async|await|defer|func|package|println|println!|pub|fn|use|let|mut|Ok|Err|main|map|string|true|false|null|nil|void|static|final|var)\b/g,
    '<span style="color:#60a5fa">$1</span>',
  );
  // Rust/Java/Go types
  s = s.replace(/\b(Result|Option|String|Vec|HashMap|HttpClient|HttpRequest|HttpResponse|BodyPublishers|BodyHandlers|Client|Response)\b/g,
    '<span style="color:#34d399">$1</span>');
  // Decorators / attributes
  s = s.replace(/#\[[\w:]+\]/g, (m) => `<span style="color:#c084fc">${m}</span>`);
  // Numbers
  s = s.replace(/\b(\d+)\b/g, '<span style="color:#a78bfa">$1</span>');
  // Restore strings (orange)
  s = s.replace(/\x00S(\d+)\x00/g, (_, i) => `<span style="color:#f97316">${strings[+i]}</span>`);
  // Restore comments (muted)
  s = s.replace(/\x00C(\d+)\x00/g, (_, i) => `<span style="color:#6b7280">${comments[+i]}</span>`);

  return s;
}

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  "Semantic block extraction",
  "AI-powered rewrite endpoint",
  "PDF → EPUB3 conversion",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ApiSection() {
  const [active, setActive] = useState<LangId>("curl");
  const [copied, setCopied] = useState(false);

  const lang = LANGUAGES.find((l) => l.id === active)!;
  const code = CODES[active];

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <section className="py-24 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] animate-reveal opacity-0" style={{ animationDelay: "280ms" }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_1.6fr] gap-16 items-start">

          {/* Left — copy */}
          <div className="lg:sticky lg:top-28">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-strong)] text-[var(--text-secondary)] text-[10px] font-mono font-bold uppercase tracking-widest mb-6">
              <Terminal className="h-3 w-3" /> Public API
            </div>
            <h2 className="text-4xl md:text-5xl font-sans font-black tracking-tight mb-5 text-[var(--text-primary)] leading-none">
              Integrate in<br />Minutes
            </h2>
            <p className="text-base text-[var(--text-secondary)] mb-8 leading-relaxed font-medium max-w-xs">
              Skip the UI entirely. Hook into our public API with a free rate-limited key and parse documents from your own backend.
            </p>
            <ul className="space-y-3 mb-10">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm font-medium text-[var(--text-secondary)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/docs#api-keys"
              className="inline-flex items-center gap-2 text-sm font-mono font-bold text-[var(--text-primary)] hover:text-orange-500 transition-colors group"
            >
              Read Full API Docs
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Right — code block */}
          <div>
            {/* Language tabs */}
            <div className="flex flex-wrap gap-2 mb-3">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActive(l.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all ${
                    active === l.id
                      ? "border-orange-500/60 bg-orange-500/10 text-white"
                      : "border-[#2a2a2e] bg-[#111113] text-[#9ca3af] hover:border-[#3a3a3e] hover:text-white"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={iconUrl(l.slug, l.colorOverride)}
                    alt={l.label}
                    width={13}
                    height={13}
                    className="shrink-0"
                  />
                  {l.label}
                </button>
              ))}
            </div>

            {/* Card */}
            <div className="rounded-xl overflow-hidden border border-[#232325] shadow-[0_32px_64px_rgba(0,0,0,0.4)] bg-[#0a0a0c]">
              {/* Chrome bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0f0f11] border-b border-[#1e1e21]">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                  </div>
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={iconUrl(lang.slug, lang.colorOverride)} alt={lang.label} width={12} height={12} />
                    <span className="text-[11px] font-mono text-gray-500">{lang.file}</span>
                  </div>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-gray-500 hover:text-gray-200 transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className={copied ? "text-emerald-400" : ""}>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>

              {/* Code */}
              <pre
                className="p-6 overflow-x-auto text-[13px] font-mono leading-[1.8] text-gray-300 min-h-[220px]"
                dangerouslySetInnerHTML={{ __html: highlight(code) }}
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
