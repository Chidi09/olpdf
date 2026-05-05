import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { 
  FileJson, 
  Layers, 
  Wand2, 
  Download, 
  Server, 
  Cpu, 
  ShieldCheck, 
  Terminal, 
  Github, 
  Users, 
  ArrowRight, 
  Code2,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Database
} from "lucide-react";

// Official Logos as SVG Components
const SupabaseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.362 5.09756L12.5691 0.407316C12.213 -0.135772 11.5 0.117073 11.5 0.778862V12.1528C11.5 12.5854 11.8561 12.9415 12.2886 12.9415H21.5122C22.1447 12.9415 22.4618 12.1805 22.0146 11.7333L21.362 5.09756Z" fill="#3ECF8E"/>
    <path d="M2.63805 18.9024L11.4309 23.5927C11.787 24.1358 12.5 23.8829 12.5 23.2211V11.8472C12.5 11.4146 12.1439 11.0585 11.7114 11.0585H2.4878C1.85528 11.0585 1.53821 11.8195 1.98537 12.2667L2.63805 18.9024Z" fill="#3ECF8E"/>
  </svg>
);

const CloudflareIcon = () => (
  <svg viewBox="0 0 100 100" className="h-8 w-8" fill="#F38020" xmlns="http://www.w3.org/2000/svg">
    <path d="M73.5,67H22.9C15.4,67,9.3,61,9.3,53.4c0-7.3,5.8-13.3,13-13.6c-0.1-0.5-0.1-1.1-0.1-1.6c0-7,5.7-12.7,12.7-12.7c4.6,0,8.6,2.4,10.9,6.1c2-2.1,4.7-3.4,7.6-3.4c5.1,0,9.4,3.4,10.7,8.1c3.1,1.4,5.2,4.6,5.2,8.2c0,0.8-0.1,1.5-0.3,2.2C85.5,47.8,90.7,53.8,90.7,61C90.7,64.3,88.4,67,85.1,67H73.5z"/>
  </svg>
);

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden font-sans transition-colors duration-300">
      {/* ... rest of the code ... */}
      
      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] flex flex-col justify-center px-6 bg-[var(--bg-base)]">
        <div className="mx-auto w-full max-w-6xl relative z-10 flex flex-col items-center text-center">
            <div className="animate-reveal opacity-0" style={{ animationDelay: '0ms' }}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-strong)] text-[var(--text-secondary)] text-xs font-bold mb-10 tracking-widest uppercase shadow-sm">
                    <div className="h-2 w-2 rounded-full bg-[var(--text-primary)] animate-pulse" />
                    Open Source Beta
                </div>

                <h1 className="text-6xl md:text-[6rem] lg:text-[8.5rem] font-black tracking-tighter mb-8 text-[var(--text-primary)] leading-[0.9]">
                    Document <br /> Intelligence.
                </h1>
                
                <p className="text-lg md:text-xl font-medium text-[var(--text-secondary)] mb-12 max-w-2xl mx-auto leading-relaxed">
                    A structure-first operating system for PDFs. Reconstruct semantic layouts from raw coordinates and edit with AI. Completely free.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/dashboard" className="group h-14 px-8 flex items-center justify-center bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90 text-sm font-black uppercase tracking-widest rounded-full transition-all hover:-translate-y-0.5 shadow-lg">
                        Open Workspace
                    </Link>
                    <Link href="/docs" className="h-14 px-8 flex items-center justify-center border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] text-sm font-black uppercase tracking-widest rounded-full transition-all hover:-translate-y-0.5">
                        Documentation
                    </Link>
                </div>
            </div>
        </div>
      </section>

{/* TECH STACK EXPLANATION */}
      <section className="py-24 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 animate-reveal opacity-0" style={{ animationDelay: '80ms' }}>
            <h2 className="text-3xl font-bold mb-4">Built on Open Foundations</h2>
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
              OLPDF isn&apos;t just a tool; it&apos;s a stack of modern infrastructure optimized for document intelligence.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-base)] shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 bg-black rounded-xl flex items-center justify-center text-white mb-6">
                <svg viewBox="0 0 116 100" fill="currentColor" className="h-6 w-6"><path d="M57.5 0L115 100H0L57.5 0z" /></svg>
              </div>
              <h3 className="font-bold text-lg mb-3">Next.js & Vercel</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                The frontend is built with Next.js 15 for instant page transitions and server-side rendering, deployed on Vercel&apos;s edge network for global low latency.
              </p>
              <div className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer">
                <a href="https://nextjs.org" target="_blank" rel="noreferrer">Learn more <ArrowRight className="h-3 w-3 inline" /></a>
              </div>
            </div>

            <div className="p-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-base)] shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-6">
                <svg viewBox="0 0 128 128" fill="currentColor" className="h-7 w-7"><path d="M64.6 2c-17.1 0-26.6 7.6-26.6 23.4v12.8h27.3V43H36.9C15.8 43 5.3 56.4 8.7 78.4c3.2 20.3 16.5 24.5 28.5 24.5h8.9V91.2c0-16.1 13.8-29.3 29.5-29.3h22.8V49.1C98.4 25.5 86.8 2 64.6 2zM52.3 16.3c3.2 0 5.8 2.6 5.8 5.8s-2.6 5.8-5.8 5.8-5.8-2.6-5.8-5.8 2.6-5.8 5.8-5.8z"/><path d="M64.6 126c17.1 0 26.6-7.6 26.6-23.4v-12.8H63.9v4.8h28.4C113.4 85 123.9 71.6 120.5 49.6c-3.2-20.3-16.5-24.5-28.5-24.5h-8.9v11.7c0 16.1-13.8 29.3-29.5 29.3H30.8v12.8C30.8 102.5 42.4 126 64.6 126zm12.3-14.3c-3.2 0-5.8-2.6-5.8-5.8s2.6-5.8 5.8-5.8 5.8 2.6 5.8 5.8-2.6 5.8-5.8 5.8z"/></svg>
              </div>
              <h3 className="font-bold text-lg mb-3">Python & FastAPI</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                Our extraction engine leverages Python&apos;s rich ecosystem for PDF parsing and heuristic structural reconstruction, exposed via high-performance FastAPI endpoints.
              </p>
              <div className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer">
                <a href="https://fastapi.tiangolo.com" target="_blank" rel="noreferrer">Learn more <ArrowRight className="h-3 w-3 inline" /></a>
              </div>
            </div>

            <div className="p-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-base)] shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 bg-[#F6821F]/10 rounded-xl flex items-center justify-center mb-6">
                <CloudflareIcon />
              </div>
              <h3 className="font-bold text-lg mb-3">Cloudflare R2</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                S3-compatible object storage with zero egress fees. We use R2 to store your processed documents and export artifacts securely and cost-effectively.
              </p>
              <div className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer">
                <a href="https://www.cloudflare.com/products/r2/" target="_blank" rel="noreferrer">Learn more <ArrowRight className="h-3 w-3 inline" /></a>
              </div>
            </div>

            <div className="p-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-base)] shadow-sm hover:shadow-md transition-all">
              <div className="h-12 w-12 bg-[#3ECF8E]/10 rounded-xl flex items-center justify-center mb-6">
                <SupabaseIcon />
              </div>
              <h3 className="font-bold text-lg mb-3">Supabase Auth & DB</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                PostgreSQL with Row Level Security (RLS) ensures your data is private. Supabase Auth handles identity so we can focus on document structure.
              </p>
              <div className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer">
                <a href="https://supabase.com" target="_blank" rel="noreferrer">Learn more <ArrowRight className="h-3 w-3 inline" /></a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MISSION / SOCIAL PROOF REPLACEMENT */}
      <section className="py-24 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
        <div className="max-w-4xl mx-auto px-6 text-center animate-reveal opacity-0" style={{ animationDelay: '120ms' }}>
          <h2 className="text-3xl md:text-5xl font-bold mb-8 tracking-tight">One mission: Accessible Document Intelligence</h2>
          <p className="text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed mb-12">
            Most PDFs are "digital paper"—unstructured and hard to edit. OLPDF is our attempt to turn every document into a semantic, machine-readable, and human-editable data structure.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-left">
            <div className="flex flex-col gap-2">
              <div className="text-[var(--accent)] font-black text-2xl">Open Source</div>
              <p className="text-sm text-[var(--text-secondary)]">The core extraction heuristics are public. No black boxes or hidden fees.</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-[var(--accent)] font-black text-2xl">Structure-First</div>
              <p className="text-sm text-[var(--text-secondary)]">We don&apos;t just OCR text; we reconstruct the hierarchy of headers, lists, and tables.</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-[var(--accent)] font-black text-2xl">AI-Native</div>
              <p className="text-sm text-[var(--text-secondary)]">Built specifically to leverage LLM reasoning for non-destructive document editing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* AI CANVAS VISUALIZATION */}
      <section className="py-24 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] animate-reveal opacity-0" style={{ animationDelay: '160ms' }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-slideUp">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold mb-6">
                <Sparkles className="h-4 w-4" /> AI SEMANTIC EDITING
            </div>
            <h2 className="text-4xl font-bold mb-6">Edit PDFs like text files</h2>
            <p className="text-lg text-[var(--text-secondary)] mb-6 leading-relaxed">
              We extract absolute bounding boxes and transform them into an editable DOM. You can ask Gemini 1.5 Pro to rewrite paragraphs, adjust formatting, or redact sensitive vectors directly on the canvas.
            </p>
            <ul className="space-y-4 mb-8">
              <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[var(--status-ok)]" /> Keep exact original layouts</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[var(--status-ok)]" /> Visual diff before accepting edits</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[var(--status-ok)]" /> Auditable, non-destructive history</li>
            </ul>
          </div>
          
          <div className="relative h-[450px] rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[0_16px_48px_rgba(0,0,0,0.1)] dark:shadow-float overflow-hidden flex flex-col animate-fadeIn">
             {/* Fake Editor Header */}
             <div className="h-12 border-b border-[var(--border-subtle)] flex items-center px-4 gap-2 bg-[var(--bg-surface)]">
                <div className="flex gap-1.5 mr-4">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                </div>
                <div className="text-xs font-mono text-[var(--text-tertiary)] bg-[var(--bg-base)] px-3 py-1 rounded-md border border-[var(--border-subtle)]">annual_report.pdf</div>
             </div>
             
             {/* Fake Canvas Body */}
             <div className="flex-1 flex bg-[var(--bg-canvas)] relative">
                {/* PDF Page Side */}
                <div className="w-1/2 p-8 border-r border-[var(--border-subtle)] relative">
                   <div className="w-full h-8 bg-[var(--border-strong)] rounded mb-4 animate-pulse"></div>
                   <div className="w-3/4 h-4 bg-[var(--border-subtle)] rounded mb-2"></div>
                   <div className="w-5/6 h-4 bg-[var(--border-subtle)] rounded mb-2"></div>
                   <div className="w-full h-4 bg-[var(--border-subtle)] rounded mb-8"></div>
                   
                   {/* Highlighted text being edited */}
                   <div className="relative p-2 -mx-2 bg-[var(--accent-subtle)] border border-[var(--accent)] border-dashed rounded">
                     <div className="w-full h-4 bg-[var(--accent)]/30 rounded mb-2"></div>
                     <div className="w-2/3 h-4 bg-[var(--accent)]/30 rounded"></div>
                     
                     {/* Floating AI Tooltip */}
                     <div className="absolute -top-10 -right-4 bg-[var(--bg-elevated)] border border-[var(--accent)] shadow-lg rounded-lg p-2 flex items-center gap-2 animate-slideUp">
                        <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                        <span className="text-xs font-medium">Rewriting to formal tone...</span>
                        <span className="w-2 h-4 bg-[var(--accent)] animate-pulse"></span>
                     </div>
                   </div>
                </div>
                
                {/* AI Assistant Side */}
                <div className="w-1/2 bg-[var(--bg-surface)] p-4 flex flex-col justify-end">
                   <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-3 mb-4 shadow-sm">
                      <p className="text-xs text-[var(--text-secondary)] mb-2">AI Agent Suggestion</p>
                      <div className="text-sm font-medium mb-3">Replaced casual phrasing with corporate terminology. Layout metrics preserved.</div>
                      <div className="flex gap-2">
                        <button className="flex-1 bg-[var(--status-ok)]/10 text-[var(--status-ok)] text-xs py-1.5 rounded font-bold border border-[var(--status-ok)]/20">Accept</button>
                        <button className="flex-1 bg-[var(--status-error)]/10 text-[var(--status-error)] text-xs py-1.5 rounded font-bold border border-[var(--status-error)]/20">Reject</button>
                      </div>
                   </div>
                   <div className="h-10 border border-[var(--border-subtle)] rounded-full bg-[var(--bg-base)] flex items-center px-4 text-xs text-[var(--text-tertiary)]">
                     Ask Gemini to change the document...
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* BOOK PUBLISHING VISUALIZATION */}
      <section className="py-24 px-6 border-b border-[var(--border-subtle)] animate-reveal opacity-0" style={{ animationDelay: '200ms' }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative h-[400px] rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[0_16px_48px_rgba(0,0,0,0.1)] dark:shadow-float overflow-hidden flex animate-fadeIn order-2 lg:order-1">
             {/* Sidebar */}
             <div className="w-1/3 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 flex flex-col gap-2">
                <h4 className="text-xs font-bold tracking-widest text-[var(--text-tertiary)] uppercase mb-2">Chapters</h4>
                <div className="bg-[var(--status-ok)]/10 border border-[var(--status-ok)]/30 p-2 rounded flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--status-ok)]">1. Introduction</span>
                  <CheckCircle2 className="h-3 w-3 text-[var(--status-ok)]" />
                </div>
                <div className="bg-[var(--status-ok)]/10 border border-[var(--status-ok)]/30 p-2 rounded flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--status-ok)]">2. Methodology</span>
                  <CheckCircle2 className="h-3 w-3 text-[var(--status-ok)]" />
                </div>
                <div className="bg-[var(--accent-subtle)] border border-[var(--accent)]/50 p-2 rounded flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--accent)]">3. Analysis</span>
                  <span className="h-2 w-2 rounded-full bg-[var(--status-review)] animate-pulse"></span>
                </div>
             </div>
             {/* Main Content */}
             <div className="w-2/3 bg-[var(--bg-canvas)] p-8 flex flex-col justify-center items-center text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--accent-glow)_0%,transparent_60%)]" />
                <BookOpen className="h-16 w-16 text-[var(--accent)] mb-6 relative z-10" />
                <h3 className="text-xl font-bold mb-2 relative z-10">Consistency Check</h3>
                <p className="text-xs text-[var(--text-secondary)] mb-6 relative z-10">Cross-referencing entities and formatting across 3 documents...</p>
                <div className="w-full max-w-[200px] h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden relative z-10">
                  <div className="h-full bg-[var(--accent)] w-2/3 animate-pulse rounded-full"></div>
                </div>
             </div>
          </div>
          
          <div className="animate-slideUp order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold mb-6">
                <BookOpen className="h-4 w-4" /> BOOK MAKER
            </div>
            <h2 className="text-4xl font-bold mb-6">Publish with structural consistency</h2>
            <p className="text-lg text-[var(--text-secondary)] mb-6 leading-relaxed">
              Compile multiple individual documents into a single cohesive book or report. Our engine runs global consistency checks across all chapters to ensure character names, terminology, and font hierarchies remain uniform.
            </p>
            <div className="flex gap-4">
              <span className="px-4 py-2 rounded-full border border-[var(--border-subtle)] text-sm font-semibold bg-[var(--bg-surface)]">EPUB3 Export</span>
              <span className="px-4 py-2 rounded-full border border-[var(--border-subtle)] text-sm font-semibold bg-[var(--bg-surface)]">PDF/A Archival</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS / THE LOOP */}
      <section className="py-24 px-6 relative bg-[var(--bg-surface)] animate-reveal opacity-0" style={{ animationDelay: '240ms' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">The Extraction Loop</h2>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
              We reconstruct the semantic DOM from raw coordinates.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            <div className="relative bg-[var(--bg-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)] shadow-sm hover:shadow-md hover:border-[var(--accent)]/50 transition-all duration-300">
              <div className="h-12 w-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                <FileJson className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">1. Extract</h3>
              <p className="text-sm text-[var(--text-secondary)]">Raw PDF binaries are parsed to extract untagged text and coordinates.</p>
            </div>

            <div className="relative bg-[var(--bg-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)] shadow-sm hover:shadow-md hover:border-[var(--accent)]/50 transition-all duration-300">
              <div className="h-12 w-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">2. Reconstruct</h3>
              <p className="text-sm text-[var(--text-secondary)]">Python heuristics engine rebuilds paragraphs, tables, and lists.</p>
            </div>

            <div className="relative bg-[var(--bg-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)] shadow-sm hover:shadow-md hover:border-[var(--accent)]/50 transition-all duration-300">
              <div className="h-12 w-12 bg-[var(--accent)]/10 rounded-xl flex items-center justify-center mb-4 text-[var(--accent)]">
                <Wand2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">3. AI Edit</h3>
              <p className="text-sm text-[var(--text-secondary)]">Gemini 1.5 Pro performs precise JSON tree mutations seamlessly.</p>
            </div>

            <div className="relative bg-[var(--bg-elevated)] p-6 rounded-3xl border border-[var(--border-subtle)] shadow-sm hover:shadow-md hover:border-[var(--accent)]/50 transition-all duration-300">
              <div className="h-12 w-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
                <Download className="h-6 w-6" />
              </div>
              <h3 className="font-bold mb-2">4. Export</h3>
              <p className="text-sm text-[var(--text-secondary)]">Compiled back into a pristine PDF/A or EPUB3 document.</p>
            </div>
          </div>
        </div>
      </section>

      {/* EASY INTEGRATION / API */}
      <section className="py-24 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] animate-reveal opacity-0" style={{ animationDelay: '280ms' }}>
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Integrate in Minutes</h2>
          <p className="text-lg text-[var(--text-secondary)] mb-12 max-w-2xl mx-auto">
            You don&apos;t need to use our UI. Hook into our public API endpoint using the free rate-limited key and parse documents directly in your backend. Cloudflare R2 storage keeps assets secure.
          </p>
          
          {/* Terminal Box for Code - Keep this dark in both modes for standard terminal aesthetics */}
          <div className="text-left bg-[#0a0a0c] rounded-2xl border border-[var(--border-strong)] overflow-hidden shadow-2xl max-w-3xl mx-auto animate-slideUp">
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--border-subtle)] border-b border-[var(--border-strong)]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              </div>
              <div className="text-xs font-mono text-gray-400">extract.sh</div>
            </div>
            <div className="p-6 overflow-x-auto text-sm font-mono text-emerald-400">
              <pre><code>
<span className="text-pink-400">curl</span> -X POST https://api.olpdf.com/v1/extract \
  -H <span className="text-amber-300">"Authorization: Bearer free_beta_key"</span> \
  -H <span className="text-amber-300">"Content-Type: application/json"</span> \
  -d <span className="text-amber-300">{`'{ "url": "https://example.com/invoice.pdf", "mode": "semantic" }'`}</span>
              </code></pre>
            </div>
          </div>
          <div className="mt-8">
             <Link href="/docs" className="text-[var(--accent)] hover:underline font-bold inline-flex items-center gap-2">
                Read Full API Documentation <ArrowRight className="h-4 w-4" />
             </Link>
          </div>
        </div>
      </section>

      {/* FREE COMMITMENT SECTION */}
      <section className="py-24 px-6 bg-[var(--bg-surface)] animate-reveal opacity-0" style={{ animationDelay: '320ms' }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] text-xs font-black uppercase tracking-widest mb-8 shadow-lg shadow-[var(--accent)]/20">
            100% Free Forever
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tighter">No Paywalls. Just Documents.</h2>
          <p className="text-xl text-[var(--text-secondary)] leading-relaxed mb-12 max-w-2xl mx-auto">
            We believe that document intelligence should be a public good. OLPDF is committed to remaining free for individuals and open-source projects.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)]">
               <div className="h-10 w-10 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6" />
               </div>
               <h4 className="font-bold mb-2">Unlimited Projects</h4>
               <p className="text-xs text-[var(--text-secondary)]">Create as many documents or books as you need without hitting a cap.</p>
            </div>
            <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)]">
               <div className="h-10 w-10 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6" />
               </div>
               <h4 className="font-bold mb-2">Full AI Access</h4>
               <p className="text-xs text-[var(--text-secondary)]">Use Gemini-powered structural editing without a subscription fee.</p>
            </div>
            <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)]">
               <div className="h-10 w-10 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6" />
               </div>
               <h4 className="font-bold mb-2">Open API</h4>
               <p className="text-xs text-[var(--text-secondary)]">Integrate our extraction engine into your own apps for free.</p>
            </div>
          </div>

          <div className="mt-12 p-8 rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-base)]">
             <h3 className="text-xl font-bold mb-4">How do we survive?</h3>
             <p className="text-[var(--text-secondary)] text-sm leading-relaxed max-w-xl mx-auto mb-6">
                OLPDF is supported by infrastructure grants and a passionate community of contributors. We don&apos;t want your credit card; we want your feedback and your pull requests.
             </p>
             <Link href="/contribute" className="inline-flex items-center justify-center h-10 rounded-full bg-[var(--text-primary)] text-[var(--bg-base)] font-bold px-8 hover:opacity-90 transition-opacity">
                Join the Community
             </Link>
          </div>
        </div>
      </section>

      {/* CONTRIBUTE CTA */}
      <section className="py-24 px-6 border-t border-[var(--border-subtle)] bg-[var(--accent-subtle)] animate-reveal opacity-0" style={{ animationDelay: '360ms' }}>
        <div className="max-w-4xl mx-auto text-center">
          <Users className="h-12 w-12 text-[var(--accent)] mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[var(--text-primary)]">Open Source & Community Driven</h2>
          <p className="text-[var(--text-secondary)] mb-8 text-lg">
            OLPDF is built by developers, for developers. Check out our good first issues, sponsor the project, or build your own custom extraction plugins.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
             <Link href="https://github.com/olpdf/olpdf" target="_blank" className="inline-flex items-center justify-center h-10 bg-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90 px-6 rounded-full font-bold shadow-lg transition-opacity">
                  <Github className="mr-2 h-5 w-5" /> Star on GitHub
             </Link>
             <Link href="/contribute" className="inline-flex items-center justify-center h-10 px-6 rounded-full font-bold border border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors">
                  <Code2 className="mr-2 h-5 w-5" /> View Contribution Guide
             </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]">
          <div className="mx-auto max-w-6xl grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
              <div className="col-span-2 lg:col-span-2">
                  <Link href="/" className="text-xl font-extrabold tracking-tighter text-[var(--text-primary)] mb-6 block">
                      OLPDF
                  </Link>
                  <p className="text-[var(--text-secondary)] text-sm max-w-xs mb-6">
                      The structure-first AI document operating system. Reconstructing the semantic DOM from raw coordinates since 2026.
                  </p>
                  <div className="flex gap-4">
                     <Link href="https://github.com/olpdf/olpdf" target="_blank" className="p-2 rounded-full bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"><Github className="h-5 w-5" /></Link>
                  </div>
              </div>
              
              <div>
                  <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest mb-6">Product</h4>
                  <ul className="space-y-4 text-sm text-[var(--text-secondary)] font-medium">
                      <li><Link href="/dashboard" className="hover:text-[var(--text-primary)] transition-colors">Workspace</Link></li>
                      <li><Link href="/templates" className="hover:text-[var(--text-primary)] transition-colors">Templates</Link></li>
                      <li><Link href="/toolkit" className="hover:text-[var(--text-primary)] transition-colors">Toolkit</Link></li>
                  </ul>
              </div>

              <div>
                  <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest mb-6">Resources</h4>
                  <ul className="space-y-4 text-sm text-[var(--text-secondary)] font-medium">
                      <li><Link href="/docs" className="hover:text-[var(--text-primary)] transition-colors">Documentation</Link></li>
                      <li><Link href="/contribute" className="hover:text-[var(--text-primary)] transition-colors">Contribute</Link></li>
                  </ul>
              </div>

              <div>
                  <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest mb-6">Legal</h4>
                  <ul className="space-y-4 text-sm text-[var(--text-secondary)] font-medium">
                      <li><Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">Privacy Policy</Link></li>
                      <li><Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors">Terms of Service</Link></li>
                  </ul>
              </div>
          </div>
          
          <div className="mx-auto max-w-6xl pt-8 border-t border-[var(--border-subtle)] flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-[var(--text-tertiary)]">
              <div>
                  © 2026 OLPDF. Released under MIT License.
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--status-ok)] animate-pulse" />
                System Status: Operational
              </div>
          </div>
      </footer>

    </main>
  );
}
