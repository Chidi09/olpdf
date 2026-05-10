"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Copy, Check, ArrowRight } from "lucide-react";

// ── Framework catalogue ───────────────────────────────────────────────────────

const FRAMEWORKS = [
  { id: "npm",       label: "npm",       slug: "npm",       colorOverride: null,    file: "index.js"          },
  { id: "nextjs",    label: "Next.js",   slug: "nextdotjs", colorOverride: "ffffff", file: "PDFEditor.tsx"    },
  { id: "svelte",    label: "Svelte",    slug: "svelte",    colorOverride: null,    file: "PDFEditor.svelte"  },
  { id: "nuxt",      label: "Nuxt",      slug: "nuxt",      colorOverride: null,    file: "pdf-editor.vue"    },
  { id: "astro",     label: "Astro",     slug: "astro",     colorOverride: null,    file: "pdf-editor.astro"  },
  { id: "analog",    label: "Analog",    slug: "angular",   colorOverride: null,    file: "pdf-editor.ts"     },
  { id: "wix",       label: "Wix",       slug: "wix",       colorOverride: null,    file: "page.js"           },
  { id: "wordpress", label: "WordPress", slug: "wordpress", colorOverride: null,    file: "functions.php"     },
] as const;

function iconUrl(slug: string, colorOverride: string | null) {
  return colorOverride
    ? `https://cdn.simpleicons.org/${slug}/${colorOverride}`
    : `https://cdn.simpleicons.org/${slug}`;
}

type FrameworkId = typeof FRAMEWORKS[number]["id"];

// ── Code snippets ─────────────────────────────────────────────────────────────

const CODES: Record<FrameworkId, string> = {
  npm:
`import { OlPDFEmbed } from '@olpdf/embed';

const editor = new OlPDFEmbed(container, {
  host: 'https://olpdf.xyz',
  documentId: 'doc_abc123',
  token: userToken,
});

editor.on('MODEL_UPDATE', ({ documentModel }) => {
  myDB.save(documentModel);
});`,

  nextjs:
`'use client';
import { useEffect, useRef } from 'react';
import { OlPDFEmbed } from '@olpdf/embed';

export default function PDFEditor({ token }) {
  const ref = useRef(null);
  useEffect(() => {
    const ed = new OlPDFEmbed(ref.current, {
      host: 'https://olpdf.xyz',
      documentId: 'doc_abc123',
      token,
    });
    ed.on('MODEL_UPDATE', ({ documentModel }) =>
      myDB.save(documentModel));
    return () => ed.destroy();
  }, [token]);
  return <div ref={ref} className="h-screen w-full" />;
}`,

  svelte:
`<script>
  import { onMount, onDestroy } from 'svelte';
  import { OlPDFEmbed } from '@olpdf/embed';
  let el, editor;
  onMount(() => {
    editor = new OlPDFEmbed(el, {
      host: 'https://olpdf.xyz',
      documentId: 'doc_abc123',
      token: userToken,
    });
    editor.on('MODEL_UPDATE', ({ documentModel }) =>
      myDB.save(documentModel));
  });
  onDestroy(() => editor?.destroy());
</script>
<div bind:this={el} class="h-screen w-full" />`,

  nuxt:
`<script setup lang="ts">
import { OlPDFEmbed } from '@olpdf/embed';
const el = ref(null);
onMounted(() => {
  const editor = new OlPDFEmbed(el.value, {
    host: 'https://olpdf.xyz',
    documentId: 'doc_abc123',
    token: userToken,
  });
  editor.on('MODEL_UPDATE', ({ documentModel }) =>
    myDB.save(documentModel));
});
</script>
<template>
  <div ref="el" class="h-screen w-full" />
</template>`,

  astro:
`---
// src/components/PDFEditor.astro
---
<div id="olpdf" class="h-screen w-full"></div>
<script>
  import { OlPDFEmbed } from '@olpdf/embed';
  const editor = new OlPDFEmbed(
    document.getElementById('olpdf'), {
      host: 'https://olpdf.xyz',
      documentId: 'doc_abc123',
      token: userToken,
    }
  );
  editor.on('MODEL_UPDATE', ({ documentModel }) =>
    myDB.save(documentModel));
</script>`,

  analog:
`import { Component, AfterViewInit,
  ViewChild, ElementRef } from '@angular/core';
import { OlPDFEmbed } from '@olpdf/embed';

@Component({
  selector: 'app-pdf-editor',
  template: '<div #el class="h-screen"></div>',
})
export class PDFEditorComponent implements AfterViewInit {
  @ViewChild('el') el!: ElementRef;
  ngAfterViewInit() {
    const editor = new OlPDFEmbed(this.el.nativeElement, {
      host: 'https://olpdf.xyz',
      documentId: 'doc_abc123',
      token: userToken,
    });
    editor.on('MODEL_UPDATE', ({ documentModel }) =>
      myDB.save(documentModel));
  }
}`,

  wix:
`// Wix Velo — paste into the Page Code panel
import wixData from 'wix-data';
import { OlPDFEmbed } from '@olpdf/embed';

$w.onReady(() => {
  const el = $w('#editorBox').getEl();
  const editor = new OlPDFEmbed(el, {
    host: 'https://olpdf.xyz',
    documentId: 'doc_abc123',
    token: userToken,
  });
  editor.on('MODEL_UPDATE', ({ documentModel }) =>
    wixData.save('documents', documentModel));
});`,

  wordpress:
`<?php // functions.php
add_action('wp_enqueue_scripts', function() {
  wp_enqueue_script('olpdf',
    'https://cdn.jsdelivr.net/npm/@olpdf/embed',
    [], '1.0', true);
  wp_add_inline_script('olpdf', "
    new OlPDFEmbed(
      document.getElementById('olpdf'), {
        host: 'https://olpdf.xyz',
        documentId: 'doc_abc123',
        token: userToken,
      }
    ).on('MODEL_UPDATE', ({documentModel}) =>
      fetch('/wp-json/olpdf/v1/save', {
        method: 'POST',
        body: JSON.stringify(documentModel),
      }));
  ");
});`,
};

// ── Syntax highlighter ────────────────────────────────────────────────────────

function highlight(raw: string): string {
  // 1. Escape HTML entities
  let s = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Pull out strings first so we don't keyword-highlight inside them
  const strings: string[] = [];
  s = s.replace(/'[^'\n]*'|"[^"\n]*"/g, (m) => {
    strings.push(m);
    return `\x00S${strings.length - 1}\x00`;
  });

  // 3. Pull out line comments
  const comments: string[] = [];
  s = s.replace(/\/\/[^\n]*/g, (m) => {
    comments.push(m);
    return `\x00C${comments.length - 1}\x00`;
  });

  // 4. Keywords (blue)
  s = s.replace(
    /\b(import|export|from|const|let|var|function|return|new|class|extends|implements|interface|type|async|await|default|true|false|null|undefined|void|public|private|static|readonly|setup|lang)\b/g,
    '<span style="color:#60a5fa">$1</span>',
  );

  // 5. Decorators (purple)
  s = s.replace(/@\w+/g, (m) => `<span style="color:#c084fc">${m}</span>`);

  // 6. PHP opening tag (purple)
  s = s.replace(/&lt;\?php/g, '<span style="color:#c084fc">&lt;?php</span>');

  // 7. Astro frontmatter fence (muted)
  s = s.replace(/^---$/gm, '<span style="color:#4b5563">---</span>');

  // 8. Restore strings (orange)
  s = s.replace(
    /\x00S(\d+)\x00/g,
    (_, i) => `<span style="color:#f97316">${strings[+i]}</span>`,
  );

  // 9. Restore comments (muted)
  s = s.replace(
    /\x00C(\d+)\x00/g,
    (_, i) => `<span style="color:#6b7280">${comments[+i]}</span>`,
  );

  return s;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmbedSection() {
  const [active, setActive] = useState<FrameworkId>("npm");
  const [copied, setCopied] = useState(false);
  const [installCopied, setInstallCopied] = useState(false);

  const fw = FRAMEWORKS.find((f) => f.id === active)!;
  const code = CODES[active];

  const copyCode = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const copyInstall = useCallback(async () => {
    await navigator.clipboard.writeText("npm install @olpdf/embed");
    setInstallCopied(true);
    setTimeout(() => setInstallCopied(false), 2000);
  }, []);

  return (
    <section
      className="relative py-28 px-6 overflow-hidden border-b border-[var(--border-subtle)]"
      style={{ background: "linear-gradient(180deg,#0d0d0f 0%,#0a0a0c 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[700px] h-[320px] rounded-full opacity-[0.15]"
        style={{
          background: "radial-gradient(ellipse at center, #f97316 0%, transparent 70%)",
          filter: "blur(70px)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Badge + headline */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-mono font-bold uppercase tracking-widest mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            Embed SDK
          </span>
          <h2 className="font-sans font-black text-4xl md:text-5xl tracking-tight text-white leading-tight">
            Embed <span className="text-orange-500">OLPDF</span> anywhere.
          </h2>
          <p className="mt-3 text-[var(--text-secondary)] text-lg font-medium max-w-xl mx-auto leading-relaxed">
            Drop a full AST-driven PDF editor into any web app in three lines. Works with every major framework.
          </p>
        </div>

        {/* Install command */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3 bg-[#111113] border border-[#2a2a2e] rounded-xl px-5 py-3 font-mono text-sm">
            <span className="text-[#6b7280] select-none">$</span>
            <span className="text-white">npm install </span>
            <span className="text-orange-400">@olpdf/embed</span>
            <button
              onClick={copyInstall}
              className="ml-2 text-[#6b7280] hover:text-white transition-colors"
              aria-label="Copy install command"
            >
              {installCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Framework tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide justify-center flex-wrap">
          {FRAMEWORKS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActive(f.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold font-mono whitespace-nowrap transition-all ${
                active === f.id
                  ? "border-orange-500/60 bg-orange-500/10 text-white shadow-sm"
                  : "border-[#2a2a2e] bg-[#111113] text-[#9ca3af] hover:border-[#3a3a3e] hover:text-white"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={iconUrl(f.slug, f.colorOverride)}
                alt={f.label}
                width={14}
                height={14}
                className="shrink-0"
              />
              {f.label}
            </button>
          ))}
        </div>

        {/* Code card */}
        <div className="rounded-2xl border border-[#2a2a2e] overflow-hidden shadow-2xl" style={{ background: "#111113" }}>
          {/* Chrome bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1e21] bg-[#0e0e10]">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={iconUrl(fw.slug, fw.colorOverride)}
                  alt={fw.label}
                  width={12}
                  height={12}
                />
                <span className="text-[11px] font-mono text-[#4b5563]">{fw.file}</span>
              </div>
            </div>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#6b7280] hover:text-white transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className={copied ? "text-emerald-400" : ""}>{copied ? "Copied!" : "Copy"}</span>
            </button>
          </div>

          {/* Code body */}
          <div className="overflow-x-auto">
            <pre
              className="px-6 py-6 font-mono text-[13px] leading-[1.9] text-[#e5e7eb] min-h-[280px]"
              dangerouslySetInnerHTML={{ __html: highlight(code) }}
            />
          </div>
        </div>

        {/* Feature pills + CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-8">
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {["Zero dependencies", "postMessage bridge", "Full AST events"].map((pill) => (
              <span
                key={pill}
                className="px-3.5 py-1.5 rounded-full border border-[#2a2a2e] bg-[#111113] text-[11px] font-mono font-bold text-[#9ca3af] uppercase tracking-wider"
              >
                {pill}
              </span>
            ))}
          </div>
          <Link
            href="/docs#embed-frameworks"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-orange-500 hover:bg-orange-400 transition-colors text-white font-sans font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-500/20 shrink-0 group"
          >
            View Embed Docs
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
