"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Copy, Check, Terminal } from "lucide-react";

const SNIPPETS: Record<string, { filename: string; lines: { text: string; color: string }[][] }> = {
  curl: {
    filename: "extract.sh",
    lines: [
      [{ text: "curl", color: "text-pink-400" }, { text: " -X POST https://api.olpdf.xyz/v1/extract \\", color: "text-blue-300/90" }],
      [{ text: "  -H ", color: "text-blue-300/90" }, { text: '"Authorization: Bearer free_beta_key"', color: "text-amber-300/90" }, { text: " \\", color: "text-blue-300/90" }],
      [{ text: "  -H ", color: "text-blue-300/90" }, { text: '"Content-Type: application/json"', color: "text-amber-300/90" }, { text: " \\", color: "text-blue-300/90" }],
      [{ text: "  -d ", color: "text-blue-300/90" }, { text: "'{ ", color: "text-amber-300/90" }],
      [{ text: '       "url": ', color: "text-amber-300/90" }, { text: '"https://example.com/invoice.pdf"', color: "text-emerald-300/90" }, { text: ",", color: "text-amber-300/90" }],
      [{ text: '       "mode": ', color: "text-amber-300/90" }, { text: '"semantic"', color: "text-emerald-300/90" }],
      [{ text: "     }'", color: "text-amber-300/90" }],
    ],
  },
  python: {
    filename: "extract.py",
    lines: [
      [{ text: "import", color: "text-purple-400" }, { text: " requests", color: "text-gray-300" }],
      [{ text: "", color: "" }],
      [{ text: "response", color: "text-blue-400" }, { text: " = requests.", color: "text-gray-300" }, { text: "post", color: "text-yellow-400" }, { text: "(", color: "text-gray-400" }],
      [{ text: '    "https://api.olpdf.xyz/v1/extract"', color: "text-amber-300/90" }, { text: ",", color: "text-gray-400" }],
      [{ text: "    headers", color: "text-blue-300/90" }, { text: "={", color: "text-gray-400" }, { text: '"Authorization"', color: "text-amber-300/90" }, { text: ": ", color: "text-gray-400" }, { text: '"Bearer free_beta_key"', color: "text-emerald-300/90" }, { text: "},", color: "text-gray-400" }],
      [{ text: "    json", color: "text-blue-300/90" }, { text: "={", color: "text-gray-400" }, { text: '"url"', color: "text-amber-300/90" }, { text: ": ", color: "text-gray-400" }, { text: '"https://example.com/invoice.pdf"', color: "text-emerald-300/90" }, { text: ",", color: "text-gray-400" }],
      [{ text: '          "mode"', color: "text-amber-300/90" }, { text: ": ", color: "text-gray-400" }, { text: '"semantic"', color: "text-emerald-300/90" }, { text: "}", color: "text-gray-400" }],
      [{ text: ")", color: "text-gray-400" }],
    ],
  },
  node: {
    filename: "extract.mjs",
    lines: [
      [{ text: "const", color: "text-purple-400" }, { text: " res ", color: "text-gray-300" }, { text: "=", color: "text-pink-400" }, { text: " await ", color: "text-purple-400" }, { text: "fetch", color: "text-yellow-400" }, { text: "(", color: "text-gray-400" }],
      [{ text: '  "https://api.olpdf.xyz/v1/extract"', color: "text-amber-300/90" }, { text: ",", color: "text-gray-400" }],
      [{ text: "  {", color: "text-gray-400" }],
      [{ text: "    method", color: "text-blue-300/90" }, { text: ': ', color: "text-gray-400" }, { text: '"POST"', color: "text-emerald-300/90" }, { text: ",", color: "text-gray-400" }],
      [{ text: "    headers", color: "text-blue-300/90" }, { text: ": { ", color: "text-gray-400" }, { text: '"Authorization"', color: "text-amber-300/90" }, { text: ": ", color: "text-gray-400" }, { text: '"Bearer free_beta_key"', color: "text-emerald-300/90" }, { text: " },", color: "text-gray-400" }],
      [{ text: "    body", color: "text-blue-300/90" }, { text: ": ", color: "text-gray-400" }, { text: "JSON", color: "text-yellow-400" }, { text: ".", color: "text-gray-400" }, { text: "stringify", color: "text-yellow-400" }, { text: "({", color: "text-gray-400" }],
      [{ text: '      url', color: "text-blue-300/90" }, { text: ": ", color: "text-gray-400" }, { text: '"https://example.com/invoice.pdf"', color: "text-emerald-300/90" }, { text: ", mode: ", color: "text-gray-400" }, { text: '"semantic"', color: "text-emerald-300/90" }],
      [{ text: "    })", color: "text-gray-400" }],
      [{ text: "  }", color: "text-gray-400" }],
      [{ text: ");", color: "text-gray-400" }],
    ],
  },
};

const RAW_COPY: Record<string, string> = {
  curl: `curl -X POST https://api.olpdf.xyz/v1/extract \\
  -H "Authorization: Bearer free_beta_key" \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://example.com/invoice.pdf", "mode": "semantic" }'`,
  python: `import requests\n\nresponse = requests.post(\n    "https://api.olpdf.xyz/v1/extract",\n    headers={"Authorization": "Bearer free_beta_key"},\n    json={"url": "https://example.com/invoice.pdf", "mode": "semantic"}\n)`,
  node: `const res = await fetch("https://api.olpdf.xyz/v1/extract", {\n  method: "POST",\n  headers: { "Authorization": "Bearer free_beta_key" },\n  body: JSON.stringify({ url: "https://example.com/invoice.pdf", mode: "semantic" })\n});`,
};

const TABS = [
  { key: "curl", label: "curl" },
  { key: "python", label: "Python" },
  { key: "node", label: "Node.js" },
];

const FEATURES = [
  "Semantic block extraction",
  "AI-powered rewrite endpoint",
  "PDF → EPUB3 conversion",
];

export default function ApiSection() {
  const [active, setActive] = useState("curl");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(RAW_COPY[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [active]);

  const snippet = SNIPPETS[active];

  return (
    <section className="py-24 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] animate-reveal opacity-0" style={{ animationDelay: "280ms" }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-16 items-center">

          {/* Left — copy */}
          <div>
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
              href="/docs"
              className="inline-flex items-center gap-2 text-sm font-mono font-bold text-[var(--text-primary)] hover:text-orange-500 transition-colors group"
            >
              Read Full API Docs
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Right — code block */}
          <div className="rounded-xl overflow-hidden border border-[#232325] shadow-[0_32px_64px_rgba(0,0,0,0.4)] bg-[#0a0a0c]">

            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#0f0f11] border-b border-[#1e1e21]">
              {/* Traffic lights */}
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>

              {/* Language tabs */}
              <div className="flex items-center gap-0.5">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActive(key)}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                      active === key
                        ? "bg-[#1e1e22] text-white"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-gray-500 hover:text-gray-200 transition-colors"
              >
                {copied
                  ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                  : <Copy className="h-3.5 w-3.5" />}
                <span className={copied ? "text-emerald-400" : ""}>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>

            {/* Filename bar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-[#0d0d0f] border-b border-[#1a1a1d]">
              <div className="w-1 h-3 rounded-full bg-orange-500/60" />
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{snippet.filename}</span>
            </div>

            {/* Code */}
            <div className="p-6 overflow-x-auto min-h-[220px] flex items-start">
              <pre className="text-sm font-mono leading-[1.8]">
                {snippet.lines.map((line, i) => (
                  <div key={i}>
                    {line.map((token, j) => (
                      <span key={j} className={token.color}>{token.text}</span>
                    ))}
                  </div>
                ))}
              </pre>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
