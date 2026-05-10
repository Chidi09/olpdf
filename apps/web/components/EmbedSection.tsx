"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, Copy, Check, Code2 } from "lucide-react";

const SNIPPETS: Record<string, { filename: string; lines: { text: string; color: string }[][] }> = {
  react: {
    filename: "DocumentEditor.tsx",
    lines: [
      [{ text: "import", color: "text-purple-400" }, { text: " { useEffect, useRef } ", color: "text-gray-300" }, { text: "from", color: "text-purple-400" }, { text: ' "react"', color: "text-amber-300/90" }, { text: ";", color: "text-gray-400" }],
      [{ text: "import", color: "text-purple-400" }, { text: " { OlPDFEmbed } ", color: "text-gray-300" }, { text: "from", color: "text-purple-400" }, { text: ' "@olpdf/embed"', color: "text-amber-300/90" }, { text: ";", color: "text-gray-400" }],
      [{ text: "", color: "" }],
      [{ text: "export", color: "text-purple-400" }, { text: " function ", color: "text-pink-400" }, { text: "Editor", color: "text-yellow-400" }, { text: "({ id, token }) {", color: "text-gray-400" }],
      [{ text: "  const", color: "text-purple-400" }, { text: " containerRef = ", color: "text-gray-300" }, { text: "useRef", color: "text-yellow-400" }, { text: "(", color: "text-gray-400" }, { text: "null", color: "text-pink-400" }, { text: ");", color: "text-gray-400" }],
      [{ text: "", color: "" }],
      [{ text: "  useEffect", color: "text-yellow-400" }, { text: "(() => {", color: "text-gray-400" }],
      [{ text: "    const", color: "text-purple-400" }, { text: " editor = ", color: "text-gray-300" }, { text: "new", color: "text-pink-400" }, { text: " OlPDFEmbed", color: "text-yellow-400" }, { text: "(containerRef.", color: "text-gray-400" }, { text: "current", color: "text-blue-300/90" }, { text: ", {", color: "text-gray-400" }],
      [{ text: "      host", color: "text-blue-300/90" }, { text: ": ", color: "text-gray-400" }, { text: '"https://olpdf.xyz"', color: "text-emerald-300/90" }, { text: ",", color: "text-gray-400" }],
      [{ text: "      documentId", color: "text-blue-300/90" }, { text: ": id,", color: "text-gray-400" }],
      [{ text: "      token", color: "text-blue-300/90" }, { text: ": token", color: "text-gray-400" }],
      [{ text: "    });", color: "text-gray-400" }],
      [{ text: "", color: "" }],
      [{ text: "    editor.", color: "text-gray-300" }, { text: "on", color: "text-yellow-400" }, { text: "(", color: "text-gray-400" }, { text: '"MODEL_UPDATE"', color: "text-amber-300/90" }, { text: ", ({ documentModel }) => {", color: "text-gray-400" }],
      [{ text: "      console", color: "text-gray-300" }, { text: ".", color: "text-gray-400" }, { text: "log", color: "text-yellow-400" }, { text: "(", color: "text-gray-400" }, { text: '"AST Updated!"', color: "text-emerald-300/90" }, { text: ");", color: "text-gray-400" }],
      [{ text: "    });", color: "text-gray-400" }],
      [{ text: "", color: "" }],
      [{ text: "    return", color: "text-purple-400" }, { text: " () => editor.", color: "text-gray-300" }, { text: "destroy", color: "text-yellow-400" }, { text: "();", color: "text-gray-400" }],
      [{ text: "  }, [id, token]);", color: "text-gray-400" }],
      [{ text: "", color: "" }],
      [{ text: "  return", color: "text-purple-400" }, { text: " <", color: "text-gray-400" }, { text: "div", color: "text-pink-400" }, { text: " ref", color: "text-blue-300/90" }, { text: "={containerRef} ", color: "text-gray-400" }, { text: "className", color: "text-blue-300/90" }, { text: "=", color: "text-gray-400" }, { text: '"w-full h-[800px]"', color: "text-emerald-300/90" }, { text: " />;", color: "text-gray-400" }],
      [{ text: "}", color: "text-gray-400" }],
    ],
  },
  vanilla: {
    filename: "index.html",
    lines: [
      [{ text: "<", color: "text-gray-400" }, { text: "script", color: "text-pink-400" }, { text: " type", color: "text-blue-300/90" }, { text: "=", color: "text-gray-400" }, { text: '"module"', color: "text-emerald-300/90" }, { text: ">", color: "text-gray-400" }],
      [{ text: "  import", color: "text-purple-400" }, { text: " { OlPDFEmbed } ", color: "text-gray-300" }, { text: "from", color: "text-purple-400" }, { text: ' "https://cdn.olpdf.xyz/embed.js"', color: "text-amber-300/90" }, { text: ";", color: "text-gray-400" }],
      [{ text: "", color: "" }],
      [{ text: "  const", color: "text-purple-400" }, { text: " editor = ", color: "text-gray-300" }, { text: "new", color: "text-pink-400" }, { text: " OlPDFEmbed", color: "text-yellow-400" }, { text: "(", color: "text-gray-400" }],
      [{ text: "    document.", color: "text-gray-300" }, { text: "getElementById", color: "text-yellow-400" }, { text: "(", color: "text-gray-400" }, { text: '"editor"', color: "text-amber-300/90" }, { text: "), {", color: "text-gray-400" }],
      [{ text: "      host", color: "text-blue-300/90" }, { text: ": ", color: "text-gray-400" }, { text: '"https://olpdf.xyz"', color: "text-emerald-300/90" }, { text: ",", color: "text-gray-400" }],
      [{ text: "      documentId", color: "text-blue-300/90" }, { text: ": ", color: "text-gray-400" }, { text: '"doc_123"', color: "text-emerald-300/90" }, { text: ",", color: "text-gray-400" }],
      [{ text: "      token", color: "text-blue-300/90" }, { text: ": ", color: "text-gray-400" }, { text: '"eyJhbGci..."', color: "text-emerald-300/90" }],
      [{ text: "  });", color: "text-gray-400" }],
      [{ text: "", color: "" }],
      [{ text: "  editor.", color: "text-gray-300" }, { text: "on", color: "text-yellow-400" }, { text: "(", color: "text-gray-400" }, { text: '"READY"', color: "text-amber-300/90" }, { text: ", () => console.", color: "text-gray-400" }, { text: "log", color: "text-yellow-400" }, { text: "(", color: "text-gray-400" }, { text: '"Ready!"', color: "text-emerald-300/90" }, { text: "));", color: "text-gray-400" }],
      [{ text: "<", color: "text-gray-400" }, { text: "/script", color: "text-pink-400" }, { text: ">", color: "text-gray-400" }],
      [{ text: "", color: "" }],
      [{ text: "<", color: "text-gray-400" }, { text: "div", color: "text-pink-400" }, { text: " id", color: "text-blue-300/90" }, { text: "=", color: "text-gray-400" }, { text: '"editor"', color: "text-emerald-300/90" }, { text: " style", color: "text-blue-300/90" }, { text: "=", color: "text-gray-400" }, { text: '"width:100%; height:80vh;"', color: "text-emerald-300/90" }, { text: "><", color: "text-gray-400" }, { text: "/div", color: "text-pink-400" }, { text: ">", color: "text-gray-400" }],
    ],
  },
};

const RAW_COPY: Record<string, string> = {
  react: `import { useEffect, useRef } from "react";\nimport { OlPDFEmbed } from "@olpdf/embed";\n\nexport function Editor({ id, token }) {\n  const containerRef = useRef(null);\n\n  useEffect(() => {\n    const editor = new OlPDFEmbed(containerRef.current, {\n      host: "https://olpdf.xyz",\n      documentId: id,\n      token: token\n    });\n\n    editor.on("MODEL_UPDATE", ({ documentModel }) => {\n      console.log("AST Updated!");\n    });\n\n    return () => editor.destroy();\n  }, [id, token]);\n\n  return <div ref={containerRef} className="w-full h-[800px]" />;\n}`,
  vanilla: `<script type="module">\n  import { OlPDFEmbed } from "https://cdn.olpdf.xyz/embed.js";\n\n  const editor = new OlPDFEmbed(document.getElementById("editor"), {\n    host: "https://olpdf.xyz",\n    documentId: "doc_123",\n    token: "eyJhbGci..."\n  });\n\n  editor.on("READY", () => console.log("Ready!"));\n</script>\n\n<div id="editor" style="width:100%; height:80vh;"></div>`,
};

const TABS = [
  { key: "react", label: "React" },
  { key: "vanilla", label: "Vanilla JS" },
];

const FEATURES = [
  "Zero-config Iframe Rendering",
  "Real-time AST Model Updates",
  "Complete PostMessage SDK",
];

export default function EmbedSection() {
  const [active, setActive] = useState("react");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(RAW_COPY[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [active]);

  const snippet = SNIPPETS[active];

  return (
    <section className="py-24 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] animate-reveal opacity-0" style={{ animationDelay: "260ms" }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-16 items-center">

          {/* Left — code block */}
          <div className="rounded-xl overflow-hidden border border-[#232325] shadow-[0_32px_64px_rgba(0,0,0,0.4)] bg-[#0a0a0c] order-2 lg:order-1">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#0f0f11] border-b border-[#1e1e21]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>

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

            <div className="flex items-center gap-2 px-4 py-2 bg-[#0d0d0f] border-b border-[#1a1a1d]">
              <div className="w-1 h-3 rounded-full bg-blue-500/60" />
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{snippet.filename}</span>
            </div>

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

          {/* Right — description */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-strong)] text-[var(--text-secondary)] text-[10px] font-mono font-bold uppercase tracking-widest mb-6">
              <Code2 className="h-3 w-3 text-blue-500" /> Embed SDK
            </div>
            <h2 className="text-4xl md:text-5xl font-serif italic font-bold tracking-tight mb-5 text-[var(--text-primary)] leading-none">
              Bring the Engine<br />to Your App
            </h2>
            <p className="text-base text-[var(--text-secondary)] mb-8 leading-relaxed font-medium max-w-sm">
              Use the <span className="font-mono text-[11px] bg-[var(--bg-surface)] px-1 py-0.5 rounded border border-[var(--border-subtle)] text-orange-500">@olpdf/embed</span> SDK to inject the full AST-driven document editor directly into your web app with just two lines of code.
            </p>
            <ul className="space-y-3 mb-10">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm font-medium text-[var(--text-secondary)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="https://npmjs.com/package/@olpdf/embed"
              target="_blank"
              className="inline-flex items-center gap-2 text-sm font-mono font-bold text-[var(--text-primary)] hover:text-blue-500 transition-colors group"
            >
              View on NPM
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
