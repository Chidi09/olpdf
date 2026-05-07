"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { 
  Terminal, 
  Key, 
  Shield, 
  Zap, 
  FileJson, 
  Book, 
  Cpu, 
  Wand2, 
  Database,
  Eye,
  History,
  CheckCircle2,
  LayoutTemplate,
  Info
} from "lucide-react";
import BackLink from "@/components/BackLink";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("");
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    observer.current = new IntersectionObserver(handleIntersect, {
      rootMargin: "-10% 0% -80% 0%",
      threshold: 0,
    });

    const sections = document.querySelectorAll("section[id], div[id^='api-']");
    sections.forEach((section) => observer.current?.observe(section));

    return () => observer.current?.disconnect();
  }, []);

  const navLinks = [
    { id: "quickstart", label: "Getting Started", icon: Zap },
    { id: "editor", label: "Editor & Studio", icon: LayoutTemplate },
    { id: "books", label: "Book Maker", icon: Book },
    { id: "toolkit", label: "PDF Toolkit", icon: Cpu },
    { type: "header", label: "Developers & API" },
    { id: "public-api", label: "API Overview", icon: Terminal, primary: true },
    { id: "api-documents", label: "Document Routes", icon: FileJson },
    { id: "api-books", label: "Book Routes", icon: Book },
    { id: "api-ai", label: "AI Routes", icon: Wand2 },
    { id: "api-templates", label: "Template Routes", icon: LayoutTemplate },
    { id: "api-toolkit", label: "Toolkit Routes", icon: Cpu },
    { id: "api-worker", label: "Async Workers", icon: ActivityIcon },
    { type: "header", label: "Infrastructure" },
    { id: "self-hosting", label: "Self-hosting", icon: Database },
  ];

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] py-12 px-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-12">
        
        {/* Sticky ScrollSpy Sidebar */}
        <aside className="hidden md:block w-64 shrink-0 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto pr-4 custom-scrollbar">
          <h3 className="font-black text-[10px] tracking-widest uppercase text-[var(--text-tertiary)] mb-6">Documentation</h3>
          <ul className="space-y-1">
            {navLinks.map((link, i) => {
              if (link.type === 'header') {
                return (
                  <li key={i} className="pt-6 pb-2">
                    <h3 className="font-black text-[10px] tracking-widest uppercase text-[var(--text-tertiary)]">{link.label}</h3>
                  </li>
                );
              }
              const Icon = link.icon;
              const isActive = activeSection === link.id;
              return (
                <li key={link.id}>
                  <Link 
                    href={`#${link.id}`} 
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                      isActive 
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]" 
                        : link.primary ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                    }`}
                  >
                    {Icon && <Icon className={`h-4 w-4 ${isActive ? "opacity-100" : "opacity-60"}`} />}
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Content Area */}
        <div className="flex-1 space-y-24 max-w-4xl">
          
          <div id="intro" className="scroll-mt-32">
            <BackLink href="/dashboard" label="Back to dashboard" className="mb-8" />
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter">Documentation</h1>
            <p className="text-xl text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              The structure-first AI document operating system. Integrate our semantic extraction engine or operate our cloud studio.
            </p>
          </div>

          {/* New Public API Section */}
          <section id="public-api" className="scroll-mt-32">
            <div className="flex items-center gap-4 mb-8">
                <div className="h-12 w-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                   <Terminal className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-4xl font-bold tracking-tight">Public REST API (Beta)</h2>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest">Version 1.0.0-beta.4</span>
                  </div>
                </div>
            </div>
            
            <p className="text-[var(--text-secondary)] mb-12 leading-relaxed text-lg">
              OLPDF provides a managed backend for structural extraction. All endpoints consume and return JSON representing the semantic document model.
            </p>

            <div className="grid sm:grid-cols-3 gap-6 mb-16">
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-2xl shadow-sm relative overflow-hidden group hover:border-[var(--accent)]/50 transition-all">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full -mr-4 -mt-4" />
                <Key className="h-8 w-8 text-amber-500 mb-4" />
                <h4 className="font-bold text-lg mb-1">Static Beta Key</h4>
                <p className="text-xs text-[var(--text-tertiary)] mb-4">No registration required for beta.</p>
                <code className="text-[10px] bg-[var(--bg-base)] border border-[var(--border-subtle)] px-2 py-1 rounded text-amber-600 font-mono font-bold select-all cursor-copy">free_beta_key</code>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-2xl shadow-sm relative overflow-hidden group hover:border-blue-500/50 transition-all">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full -mr-4 -mt-4" />
                <Shield className="h-8 w-8 text-blue-500 mb-4" />
                <h4 className="font-bold text-lg mb-1">Rate Limits</h4>
                <p className="text-xs text-[var(--text-tertiary)] mb-4">Global burst protection active.</p>
                <div className="text-xs font-bold text-blue-600">10 req / min per IP</div>
              </div>
              <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-2xl shadow-sm relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-4 -mt-4" />
                <Zap className="h-8 w-8 text-emerald-500 mb-4" />
                <h4 className="font-bold text-lg mb-1">Payload Size</h4>
                <p className="text-xs text-[var(--text-tertiary)] mb-4">Binary ingestion limit.</p>
                <div className="text-xs font-bold text-emerald-600">10MB Max per Upload</div>
              </div>
            </div>

            <div className="space-y-16">
              {/* DOCUMENT ROUTES */}
              <div id="api-documents" className="scroll-mt-32">
                <div className="flex items-center gap-3 mb-8">
                   <FileJson className="h-6 w-6 text-blue-500" />
                   <h3 className="text-2xl font-bold">Document Lifecycle</h3>
                </div>
                <div className="space-y-4">
                  <EndpointCard method="POST" path="/api/documents/create" desc="Initialize a new empty document model." payload='{"title": "Q3 Report", "meta": {"author": "AI"}}' />
                  <EndpointCard method="GET" path="/api/documents/{doc_id}" desc="Retrieve the complete semantic JSON model." />
                  <EndpointCard method="GET" path="/api/documents/{doc_id}/preview" desc="Generate a temporary read-only signed URL for a PDF preview." />
                  <EndpointCard method="PUT" path="/api/documents/{doc_id}" desc="Update the document model. Replaces current block array." payload='{"blocks": [{"type": "header", "text": "New Title"}]}' />
                  <EndpointCard method="POST" path="/api/documents/{doc_id}/export/{format}" desc="Compile back to binary. Formats: 'pdf', 'epub', 'docx'." />
                  <EndpointCard method="POST" path="/api/documents/{doc_id}/snapshot" desc="Create a named version snapshot." payload='{"version_name": "v1.0-final"}' />
                </div>
              </div>

              {/* BOOK ROUTES */}
              <div id="api-books" className="scroll-mt-32">
                <div className="flex items-center gap-3 mb-8">
                   <Book className="h-6 w-6 text-purple-500" />
                   <h3 className="text-2xl font-bold">Book Publication</h3>
                </div>
                <div className="space-y-4">
                  <EndpointCard method="POST" path="/api/books/create" desc="Create a new book container for multiple documents." />
                  <EndpointCard method="POST" path="/api/books/{book_id}/chapters" desc="Append an existing document as a chapter." payload='{"document_id": "uuid", "chapter_number": 2}' />
                  <EndpointCard method="POST" path="/api/books/{book_id}/consistency" desc="Trigger RAG-based cross-chapter consistency analysis." />
                  <EndpointCard method="POST" path="/api/books/{book_id}/export/{format}" desc="Publish all chapters as a single publication." />
                </div>
              </div>

              {/* AI ROUTES */}
              <div id="api-ai" className="scroll-mt-32">
                <div className="flex items-center gap-3 mb-8">
                   <Wand2 className="h-6 w-6 text-[var(--accent)]" />
                   <h3 className="text-2xl font-bold">AI Structural Operations</h3>
                </div>
                <div className="space-y-4">
                  <EndpointCard method="POST" path="/api/ai/documents/{doc_id}/instruction" desc="Send a natural language command to Gemini for DOM mutation." payload='{"instruction": "Extract all actionable items into a bulleted list"}' />
                  <EndpointCard method="GET" path="/api/ai/documents/{doc_id}/logs" desc="Retrieve full audit history of AI edits and diff snapshots." />
                  <EndpointCard method="POST" path="/api/ai/logs/{log_id}/accept" desc="Apply the suggested diff permanently." />
                </div>
              </div>

              {/* TEMPLATE ROUTES */}
              <div id="api-templates" className="scroll-mt-32">
                <div className="flex items-center gap-3 mb-8">
                   <LayoutTemplate className="h-6 w-6 text-emerald-500" />
                   <h3 className="text-2xl font-bold">Structural Templates</h3>
                </div>
                <div className="space-y-4">
                  <EndpointCard method="GET" path="/api/templates" desc="List available system and user-defined templates." />
                  <EndpointCard method="POST" path="/api/templates/{template_id}/apply" desc="Bootstrap a new document using a template structure." payload='{"target_doc_id": "uuid"}' />
                </div>
              </div>

              {/* TOOLKIT ROUTES */}
              <div id="api-toolkit" className="scroll-mt-32">
                <div className="flex items-center gap-3 mb-8">
                   <Cpu className="h-6 w-6 text-blue-600" />
                   <h3 className="text-2xl font-bold">PDF Toolkit (Low-Level)</h3>
                </div>
                <div className="space-y-4">
                  <EndpointCard method="POST" path="/api/pdf/redact" desc="Apply mathematical vector redaction to absolute areas." payload='{"areas": [{"page": 1, "x": 100, "y": 200, "w": 50, "h": 20}]}' />
                  <EndpointCard method="POST" path="/api/pdf/forms/detect" desc="Locate and classify interactive form fields." />
                  <EndpointCard method="POST" path="/api/pdf/forms/fill" desc="Flatten PDF with provided field values." payload='{"data": {"FullName": "Jane Doe"}}' />
                </div>
              </div>

            </div>
          </section>

          <hr className="border-[var(--border-subtle)]" />

          {/* STUDIO GUIDES */}
          <section id="quickstart" className="scroll-mt-32">
            <div className="flex items-center gap-4 mb-8">
               <Zap className="h-10 w-10 text-amber-500" />
               <h2 className="text-4xl font-bold">Getting Started</h2>
            </div>
            <div className="prose prose-invert max-w-none text-[var(--text-secondary)]">
               <p className="text-lg leading-relaxed">
                 OLPDF Studio is designed for power users who need exact control over document semantics. 
                 The dashboard provides four main entry points:
               </p>
               <div className="grid sm:grid-cols-2 gap-4 mt-8 not-prose">
                  <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                     <div className="font-bold mb-1">Structural Editor</div>
                     <p className="text-xs">Manipulate the document DOM directly with AI assistance.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                     <div className="font-bold mb-1">Book Compiler</div>
                     <p className="text-xs">Aggregate multiple files into consistent publications.</p>
                  </div>
               </div>
            </div>
          </section>

          <section id="editor" className="scroll-mt-32">
             <div className="flex items-center gap-4 mb-8">
               <LayoutTemplate className="h-10 w-10 text-blue-500" />
               <h2 className="text-4xl font-bold">The Studio Editor</h2>
            </div>
            <p className="text-lg text-[var(--text-secondary)] leading-relaxed mb-8">
              The editor operates on a <strong>Virtual DOM</strong> representation of the PDF. Instead of editing pixels, you edit semantic blocks. 
              The AI assistant uses this DOM to understand context and apply non-destructive changes.
            </p>
            <div className="p-6 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-inner">
               <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">
                  <Info className="h-4 w-4" /> Pro Tip
               </div>
               <p className="text-sm text-[var(--text-secondary)]">
                  Use the <strong>Visual Diff</strong> toggle to see exactly what the AI changed before accepting. This ensures the layout remains identical to the original PDF.
               </p>
            </div>
          </section>

          <section id="self-hosting" className="scroll-mt-32">
            <div className="flex items-center gap-4 mb-8">
                <Database className="h-10 w-10 text-[var(--accent)]" />
                <h2 className="text-4xl font-bold">Infrastructure</h2>
            </div>
            <p className="text-lg text-[var(--text-secondary)] mb-12">
              OLPDF is fully containerized and uses Cloudflare R2 for zero-egress storage.
            </p>
            
            <div className="bg-[var(--bg-canvas)] rounded-2xl border border-[var(--border-strong)] overflow-hidden shadow-2xl">
              <div className="px-4 py-3 bg-[var(--border-subtle)] border-b border-[var(--border-strong)] flex items-center justify-between">
                <span className="text-xs font-mono text-[var(--text-tertiary)]">docker-compose.yml</span>
                <div className="h-2 w-2 rounded-full bg-[var(--status-ok)]" />
              </div>
              <div className="p-6 overflow-x-auto text-xs font-mono text-emerald-400">
<pre><code>{`services:
  api:
    image: olpdf/backend:latest
    environment:
      - R2_BUCKET_NAME=olpdf-prod
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
  web:
    image: olpdf/frontend:latest
    ports: ["3000:3000"]`}</code></pre>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}

function EndpointCard({ method, path, desc, payload }: { method: string, path: string, desc: string, payload?: string }) {
  const getMethodColor = (m: string) => {
    switch(m) {
      case 'GET': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'POST': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'PUT': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'DELETE': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className="flex flex-col bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 rounded-2xl hover:border-[var(--accent)]/30 hover:shadow-lg transition-all group">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 min-w-[320px]">
          <span className={`text-[10px] font-black px-2 py-1.5 rounded-md border ${getMethodColor(method)} w-16 text-center shrink-0`}>
            {method}
          </span>
          <code className="text-sm font-mono text-[var(--text-primary)] font-black tracking-tight group-hover:text-[var(--accent)] transition-colors">{path}</code>
        </div>
        <div className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">{desc}</div>
      </div>
      {payload && (
        <div className="mt-4 bg-[var(--bg-base)]/50 border border-[var(--border-subtle)] rounded-xl p-4">
          <div className="text-[9px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
             <div className="h-1 w-1 rounded-full bg-[var(--accent)]" />
             Request Payload Example
          </div>
          <code className="text-[11px] text-amber-600 dark:text-amber-400 font-mono break-all leading-normal">{payload}</code>
        </div>
      )}
    </div>
  );
}

function ActivityIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
