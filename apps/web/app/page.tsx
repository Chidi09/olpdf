import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { DEFAULT_BRAND } from "@/lib/branding";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://olpdf.xyz";

export const metadata: Metadata = {
  title: "OLPDF — Word for PDFs | Free AI PDF Editor",
  description:
    "Edit PDFs like a Word document — completely free. OLPDF reconstructs semantic layouts from raw PDF coordinates and lets you edit with AI. No subscriptions, no uploads to third parties.",
  alternates: { canonical: APP_URL },
  openGraph: {
    url: APP_URL,
    title: "OLPDF — Word for PDFs",
    description:
      "Edit PDFs like a Word document. Free AI-powered PDF editor with semantic structure reconstruction.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "OLPDF",
  url: APP_URL,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "OLPDF is a free AI-powered PDF editor that reconstructs semantic layouts from raw PDF coordinates, letting you edit PDFs like a Word document.",
  creator: { "@type": "Organization", name: "OLPDF", url: APP_URL },
};
import ApiSection from "@/components/ApiSection";
import EmbedSection from "@/components/EmbedSection";
import { MagicAiDropzone } from "@/components/landing/MagicAiDropzone";
import {
  FileJson,
  Layers,
  Wand2,
  Download,
  Github,
  ArrowRight,
  Code2,
  BookOpen,
  Sparkles,
  CheckCircle2,
  PenTool,
  Bookmark,
  Library,
  Terminal,
  HardDrive,
  ShieldCheck,
  Cpu
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Paper texture overlay for the entire page */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.02] z-50 mix-blend-multiply dark:mix-blend-screen" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      {/* HERO SECTION */}
      <section className="relative min-h-[90vh] flex flex-col justify-center px-6 bg-[var(--bg-base)] border-b border-[var(--border-subtle)] overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] max-w-[1000px] max-h-[1000px] bg-gradient-to-b from-[var(--accent-glow)] to-transparent rounded-full blur-[100px] pointer-events-none" />
        
        <div className="mx-auto w-full max-w-7xl relative z-10 flex flex-col lg:flex-row items-center gap-6 pt-20">
            <div className="flex-1 animate-reveal opacity-0 text-left" style={{ animationDelay: '0ms' }}>
                <h1 className="text-6xl md:text-[5rem] lg:text-[7rem] leading-[0.9] mb-6 relative z-10">
                    <span className="inline-flex items-baseline relative">
                        {/* 3 Orange AI Sparkles at Top Left */}
                        <div className="absolute -top-8 -left-6 flex gap-1 transform -rotate-12">
                            <span className="text-orange-400 animate-[pulse_2s_ease-in-out_infinite] opacity-100"><Sparkles className="h-7 w-7" /></span>
                            <span className="text-orange-500 animate-[pulse_3s_ease-in-out_infinite] opacity-70 -mt-2"><Sparkles className="h-5 w-5" /></span>
                            <span className="text-orange-600 animate-[pulse_1.5s_ease-in-out_infinite] opacity-40 mt-1"><Sparkles className="h-4 w-4" /></span>
                        </div>
                        
                        <span className="font-sans font-black tracking-tighter text-orange-500">O</span>
                        <span className="font-serif italic font-light text-[#fff3e6] dark:text-[#ffedd6] -ml-2 transform -rotate-3 translate-y-1 mr-3">L</span>
                        <span className="bg-[#e21818] text-white px-4 py-1 rounded-2xl shadow-lg border border-[#b31212] inline-flex items-baseline relative transform rotate-1">
                            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl pointer-events-none"></div>
                            <span className="font-mono font-bold tracking-tight opacity-90 relative z-10">P</span>
                            <span className="font-serif font-black -ml-1 relative z-10">D</span>
                            <span className="font-sans font-thin italic ml-1 scale-110 origin-bottom relative z-10">F</span>
                        </span>
                    </span> <br />
                    <span className="text-[var(--text-secondary)] text-4xl md:text-[4rem] font-medium tracking-tight mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="text-[#2b579a] dark:text-[#4285f4] px-5 py-1 rounded-xl border-2 border-[#2b579a] dark:border-[#4285f4] font-serif italic font-bold transform -rotate-2 bg-transparent shadow-sm">
                            Word
                        </span> 
                        <span className="font-serif italic">for</span> 
                        <span className="text-[#e21818] dark:text-[#f25050] px-5 py-1 rounded-xl border-2 border-[#e21818] dark:border-[#f25050] font-sans font-black tracking-tighter transform rotate-2 bg-transparent shadow-sm">
                            PDFs.
                        </span>
                    </span>
                </h1>
                
                <p className="text-lg md:text-xl font-medium text-[var(--text-secondary)] mb-6 max-w-lg leading-relaxed">
                    A structure-first operating system for PDFs. Reconstruct semantic layouts from raw coordinates and edit with AI. Completely free.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Link href="/dashboard" className="group h-14 px-8 flex items-center justify-center bg-[var(--accent)] text-[var(--text-on-accent)] hover:brightness-110 active:scale-[0.97] text-sm font-black uppercase tracking-widest rounded-full transition-all hover:-translate-y-0.5 shadow-lg shadow-[var(--accent-glow)] w-full sm:w-auto">
                        Open Workspace
                    </Link>
                    <Link href="/docs" className="h-14 px-8 flex items-center justify-center border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] text-sm font-black uppercase tracking-widest rounded-full transition-all hover:-translate-y-0.5 w-full sm:w-auto">
                        Documentation
                    </Link>
                    <a href="#extraction-loop" className="h-14 px-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-semibold transition-colors gap-1.5 w-full sm:w-auto">
                        See how it works <ArrowRight className="h-4 w-4 rotate-90" />
                    </a>
                </div>
            </div>

            {/* Highly Detailed AI DOM Illustration - Enhanced for 'Word' feel */}
            <div className="flex-1 w-full max-w-lg relative animate-reveal opacity-0 mt-10 lg:mt-0" style={{ animationDelay: '200ms' }}>
               {/* Pencil Scribble floating */}
               <svg className="absolute -top-12 -left-12 w-24 h-24 text-[var(--text-tertiary)] -rotate-12 z-0 opacity-40" viewBox="0 0 100 100">
                  <path d="M10,80 Q20,20 80,10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M15,60 Q40,40 60,60 T85,60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
               </svg>

               <div className="relative aspect-[4/5] w-full bg-[#fdfdfc] dark:bg-[#1a1a1c] border border-[var(--border-strong)] rounded-3xl shadow-2xl overflow-hidden flex flex-col group hover:border-[var(--accent)] transition-colors duration-500 z-10">
                  {/* Editor Header - Word/Docs Style */}
                  <div className="h-14 border-b border-[var(--border-subtle)] bg-[#f3f4f6] dark:bg-[#252528] flex items-center px-4 justify-between shrink-0">
                     <div className="flex items-center gap-4">
                       <div className="flex gap-1.5">
                         <div className="w-3 h-3 rounded-full bg-red-400" />
                         <div className="w-3 h-3 rounded-full bg-amber-400" />
                         <div className="w-3 h-3 rounded-full bg-emerald-400" />
                       </div>
                       <div className="flex gap-2 text-[var(--text-tertiary)]">
                          <BookOpen className="h-4 w-4" />
                          <Bookmark className="h-4 w-4" />
                       </div>
                     </div>
                     <div className="flex items-center gap-2 bg-white dark:bg-[#1e1e20] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] shadow-sm">
                        <div className="text-xs font-serif italic font-bold text-[var(--text-primary)]">document_v2.pdf</div>
                        <div className="w-px h-3 bg-[var(--border-strong)] mx-1" />
                        <div className="text-[10px] font-mono text-orange-500 uppercase tracking-widest font-bold flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI Active</div>
                     </div>
                  </div>
                  
                  {/* Editor Canvas - Paper texture feel */}
                  <div className="flex-1 p-8 flex flex-col gap-6 relative bg-white dark:bg-[#141415] shadow-inner">
                     {/* Paper lines background */}
                     <div className="absolute inset-0 pointer-events-none opacity-5 dark:opacity-[0.02]" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, var(--text-primary) 31px, var(--text-primary) 32px)' }}></div>

                     {/* Title block */}
                     <div className="relative w-full p-2 group-hover:pl-4 transition-all duration-300">
                        <div className="absolute -left-4 top-1 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <PenTool className="h-4 w-4" />
                        </div>
                        <h2 className="font-serif italic text-3xl font-bold text-[var(--text-primary)]">The Future of Documents</h2>
                        <div className="absolute -bottom-1 left-0 w-3/4 h-1">
                            <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="w-full h-full text-blue-500/50">
                                <path d="M0,5 Q25,8 50,5 T100,5" fill="none" stroke="currentColor" strokeWidth="2" />
                            </svg>
                        </div>
                     </div>

                     {/* Text block actively being edited by AI */}
                     <div className="relative w-full p-5 mt-2 border border-orange-500/30 bg-orange-50/50 dark:bg-orange-950/20 rounded-lg transform scale-[1.02] z-10 transition-transform">
                        <div className="absolute -inset-px rounded-lg border border-orange-500/50 animate-pulse pointer-events-none" />
                        
                        <div className="space-y-3 mt-1 text-[var(--text-secondary)]">
                           <p className="leading-relaxed relative">
                               This document was once <span className="line-through opacity-50">a static picture of text</span> 
                               <span className="text-orange-600 dark:text-orange-400 font-bold ml-1">an editable, semantic structure</span>. 
                               <svg className="absolute -top-3 left-[45%] w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                           </p>
                           <p className="leading-relaxed">
                               Just like a Word processor, you can now seamlessly edit PDFs using AI.
                           </p>
                        </div>
                        
                        {/* Cursor element */}
                        <div className="absolute -bottom-3 right-4 flex items-center gap-2">
                           <div className="bg-orange-500 text-white text-[10px] px-3 py-1.5 rounded-full font-bold shadow-lg flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> Rephrasing...
                           </div>
                        </div>
                     </div>

                     {/* Complex Table Reconstruction */}
                     <div className="relative w-full p-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded-xl mt-4 opacity-90">
                        <div className="absolute -top-3 -right-2 bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[10px] font-mono px-2 py-1 rounded text-[var(--text-tertiary)] shadow-sm rotate-3">Parsed Table</div>
                        <div className="grid grid-cols-3 gap-3 mt-2">
                           <div className="h-2 bg-[var(--text-primary)] opacity-40 rounded w-full" />
                           <div className="h-2 bg-[var(--text-primary)] opacity-40 rounded w-full" />
                           <div className="h-2 bg-[var(--text-primary)] opacity-40 rounded w-full" />
                           <div className="h-px bg-[var(--border-strong)] col-span-3 my-1" />
                           <div className="h-2 bg-[var(--text-secondary)] opacity-20 rounded w-3/4" />
                           <div className="h-2 bg-[var(--text-secondary)] opacity-20 rounded w-1/2" />
                           <div className="h-2 bg-[var(--text-secondary)] opacity-20 rounded w-5/6" />
                        </div>
                     </div>
                  </div>
               </div>
               
               {/* Abstract floating book node */}
               <div className="absolute bottom-10 -right-10 bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-4 rounded-xl shadow-2xl animate-float hidden md:flex items-center gap-3 z-20" style={{ animationDelay: '500ms' }}>
                  <div className="h-10 w-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                      <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Semantic Layout</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Preserved flawlessly</span>
                  </div>
               </div>
            </div>
        </div>
      </section>

      {/* Magic AI Dropzone */}
      <section className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Try the <span className="text-[var(--accent)]">Magic AI</span>
          </h2>
          <p className="mt-3 text-lg text-[var(--text-secondary)]">
            Upload a PDF and tell the AI what to do. It chains multiple operations automatically.
          </p>
        </div>
        <MagicAiDropzone />
      </section>

      {/* MISSION */}
      <section className="py-28 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] animate-reveal opacity-0" style={{ animationDelay: '120ms' }}>
        <div className="max-w-5xl mx-auto">

          {/* Statement */}
          <div className="max-w-3xl mb-20">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-500 mb-6">Mission</p>
            <h2 className="font-sans font-black text-4xl md:text-5xl lg:text-6xl tracking-tight text-[var(--text-primary)] leading-[1.05] mb-6">
              PDFs shouldn&apos;t be<br />read-only forever.
            </h2>
            <p className="text-xl text-[var(--text-secondary)] leading-relaxed font-medium max-w-2xl">
              Most PDFs are digital paper — unstructured, unsearchable, and impossible to edit without destroying the layout. OLPDF turns every document into a machine-readable, AI-editable, and always re-exportable to the exact same format it came from.
            </p>
          </div>

          {/* Three principles — horizontal rule layout */}
          <div className="grid md:grid-cols-3 gap-0 border-t border-[var(--border-subtle)]">
            {[
              {
                index: "01",
                title: "Open Source",
                body: "The extraction heuristics, block model specification, and export pipeline are all public. Audit the logic, fork it, run it yourself. No black boxes, no paywalls on the core engine.",
              },
              {
                index: "02",
                title: "Structure First",
                body: "We don't OCR and call it done. Every page is classified before extraction runs — native text, scanned, table-heavy — and each block is assigned a type, confidence score, and column index.",
              },
              {
                index: "03",
                title: "AI as a Tool",
                body: "The model is never given a blank document and told to rewrite it. Every AI action goes through a validated tool call. The diff is logged, reversible, and requires explicit user acceptance.",
              },
            ].map(({ index, title, body }) => (
              <div key={index} className="pt-10 pb-2 md:pr-12 md:border-r border-[var(--border-subtle)] last:border-r-0 [&:not(:first-child)]:md:pl-12 border-t md:border-t-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-4">{index}</p>
                <h3 className="font-sans font-black text-xl text-[var(--text-primary)] mb-3">{title}</h3>
                <p className="text-[var(--text-secondary)] leading-relaxed text-base font-medium">{body}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* AI CANVAS VISUALIZATION */}
      <section className="py-16 px-6 border-b border-[var(--border-subtle)] bg-[#f3f4f6] dark:bg-[#1a1a1c] animate-reveal opacity-0 relative overflow-hidden" style={{ animationDelay: '160ms' }}>
        {/* Subtle grid background */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(to right, var(--border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--border-strong) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 items-center relative z-10">
          <div className="animate-slideUp">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold mb-6 font-mono uppercase tracking-widest border border-orange-500/20">
                <PenTool className="h-3 w-3" /> Editor Canvas
            </div>
            <h2 className="text-4xl md:text-5xl font-sans font-black tracking-tighter mb-6 text-[var(--text-primary)]">Edit PDFs like <br/>Word documents.</h2>
            <p className="text-lg text-[var(--text-secondary)] mb-8 leading-relaxed font-medium">
              We extract absolute bounding boxes and transform them into an editable DOM. You can ask Gemini 1.5 Pro to rewrite paragraphs, adjust formatting, or redact sensitive vectors directly on the canvas.
            </p>
            <ul className="space-y-5 mb-8 font-medium">
              <li className="flex items-center gap-3"><span className="flex items-center justify-center w-6 h-6 rounded-full border border-[var(--border-strong)] bg-white dark:bg-[#252528] text-blue-500 text-xs shadow-sm">1</span> Keep exact original layouts</li>
              <li className="flex items-center gap-3"><span className="flex items-center justify-center w-6 h-6 rounded-full border border-[var(--border-strong)] bg-white dark:bg-[#252528] text-blue-500 text-xs shadow-sm">2</span> Visual diff before accepting edits</li>
              <li className="flex items-center gap-3"><span className="flex items-center justify-center w-6 h-6 rounded-full border border-[var(--border-strong)] bg-white dark:bg-[#252528] text-blue-500 text-xs shadow-sm">3</span> Auditable, non-destructive history</li>
            </ul>
          </div>
          
          {/* Editor Mockup */}
          <div className="relative h-[450px] rounded-xl border border-[var(--border-strong)] bg-white dark:bg-[#141415] shadow-2xl overflow-hidden flex flex-col animate-fadeIn group">
             {/* Fake Editor Header */}
             <div className="h-12 border-b border-[var(--border-subtle)] flex items-center px-4 gap-2 bg-[#fdfdfc] dark:bg-[#1e1e20]">
                <div className="flex gap-1.5 mr-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]"></div>
                </div>
                <div className="text-xs font-serif italic font-bold text-[var(--text-primary)] bg-[var(--bg-surface)] px-3 py-1 rounded shadow-sm border border-[var(--border-subtle)]">annual_report_draft.pdf</div>
             </div>
             
             {/* Fake Canvas Body */}
             <div className="flex-1 flex bg-[#f9f9f8] dark:bg-[#101011] relative">
                {/* PDF Page Side */}
                <div className="w-1/2 p-8 border-r border-[var(--border-subtle)] relative bg-white dark:bg-[#141415] m-4 shadow-sm border">
                   <div className="w-full h-8 font-serif italic text-xl font-bold text-[var(--text-primary)] mb-4">Financial Overview</div>
                   <div className="w-full space-y-2 mb-8">
                      <div className="w-full h-2 bg-[var(--border-strong)] opacity-20 rounded"></div>
                      <div className="w-5/6 h-2 bg-[var(--border-strong)] opacity-20 rounded"></div>
                      <div className="w-4/5 h-2 bg-[var(--border-strong)] opacity-20 rounded"></div>
                   </div>
                   
                   {/* Highlighted text being edited */}
                   <div className="relative p-3 -mx-3 bg-orange-50 dark:bg-orange-900/10 border-l-2 border-orange-500 rounded-r">
                     <div className="w-full h-2 bg-orange-500/40 rounded mb-2"></div>
                     <div className="w-2/3 h-2 bg-orange-500/40 rounded"></div>
                     
                     {/* Floating AI Tooltip */}
                     <div className="absolute -top-8 -right-8 bg-white dark:bg-[#1e1e20] border border-[var(--border-strong)] shadow-xl rounded px-3 py-2 flex items-center gap-2 animate-slideUp z-20">
                        <Sparkles className="h-3 w-3 text-orange-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Rewriting formal tone</span>
                        <span className="w-1.5 h-3 bg-orange-500 animate-pulse"></span>
                     </div>
                   </div>
                </div>
                
                {/* AI Assistant Side */}
                <div className="w-1/2 p-4 flex flex-col justify-end bg-[#fdfdfc] dark:bg-[#1a1a1c]">
                   <div className="bg-white dark:bg-[#252528] border border-[var(--border-subtle)] rounded shadow-sm p-4 mb-4 relative">
                      <div className="absolute -left-2 top-4 w-4 h-4 bg-white dark:bg-[#252528] border-l border-t border-[var(--border-subtle)] rotate-45"></div>
                      <p className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-2 flex items-center gap-1"><Wand2 className="h-3 w-3"/> AI Suggestion</p>
                      <div className="text-sm font-serif mb-4 leading-relaxed text-[var(--text-primary)]">Replaced casual phrasing with corporate terminology. Layout metrics preserved perfectly.</div>
                      <div className="flex gap-2">
                        <button className="flex-1 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 text-xs py-2 rounded font-bold border border-blue-200 dark:border-blue-800 transition-colors hover:bg-blue-100">Accept</button>
                        <button className="flex-1 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-xs py-2 rounded font-bold border border-red-200 dark:border-red-800 transition-colors hover:bg-red-100">Reject</button>
                      </div>
                   </div>
                   <div className="h-12 border border-[var(--border-strong)] rounded-lg bg-white dark:bg-[#141415] flex items-center px-4 text-xs text-[var(--text-tertiary)] font-medium shadow-inner">
                     <PenTool className="h-4 w-4 mr-2 opacity-50" />
                     Ask Gemini to format the document...
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* BOOK PUBLISHING VISUALIZATION */}
      <section className="py-16 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] animate-reveal opacity-0" style={{ animationDelay: '200ms' }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 items-center">
          <div className="relative h-[400px] rounded-xl border border-[var(--border-strong)] bg-[#fdfdfc] dark:bg-[#141415] shadow-2xl overflow-hidden flex animate-fadeIn order-2 lg:order-1 p-2">
             <div className="flex w-full border border-[var(--border-subtle)] rounded shadow-inner overflow-hidden">
                 {/* Sidebar */}
                 <div className="w-1/3 border-r border-[var(--border-subtle)] bg-[#f3f4f6] dark:bg-[#1e1e20] p-4 flex flex-col gap-3">
                    <h4 className="text-[10px] font-mono tracking-widest text-[var(--text-tertiary)] uppercase mb-2">Table of Contents</h4>
                    <div className="bg-white dark:bg-[#252528] border border-[var(--border-subtle)] p-3 rounded shadow-sm flex items-center justify-between group cursor-pointer">
                      <span className="text-xs font-serif font-bold text-[var(--text-primary)]">I. Introduction</span>
                      <CheckCircle2 className="h-3 w-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="bg-white dark:bg-[#252528] border border-[var(--border-subtle)] p-3 rounded shadow-sm flex items-center justify-between group cursor-pointer">
                      <span className="text-xs font-serif font-bold text-[var(--text-primary)]">II. Methodology</span>
                      <CheckCircle2 className="h-3 w-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 p-3 rounded shadow-sm flex items-center justify-between relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
                      <span className="text-xs font-serif font-bold text-orange-700 dark:text-orange-400">III. Analysis</span>
                      <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></span>
                    </div>
                 </div>
                 {/* Main Content */}
                 <div className="w-2/3 bg-white dark:bg-[#141415] p-8 flex flex-col justify-center items-center text-center relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--accent-glow)_0%,transparent_60%)] opacity-50" />
                    <Library className="h-12 w-12 text-[var(--text-secondary)] mb-4 relative z-10 stroke-[1.5]" />
                    <h3 className="text-xl font-serif italic font-bold mb-2 relative z-10 text-[var(--text-primary)]">Compiling Volume</h3>
                    <p className="text-xs text-[var(--text-tertiary)] mb-6 relative z-10 font-mono">Cross-referencing entities...</p>
                    <div className="w-full max-w-[200px] h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden relative z-10">
                      <div className="h-full bg-[var(--text-primary)] w-2/3 animate-pulse rounded-full"></div>
                    </div>
                 </div>
             </div>
          </div>
          
          <div className="animate-slideUp order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border-strong)] text-[var(--text-secondary)] text-xs font-bold mb-6 font-mono uppercase tracking-widest shadow-sm">
                <Library className="h-3 w-3" /> Book Maker
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-[var(--text-primary)]">Publish with <br/>structural consistency.</h2>
            <p className="text-lg text-[var(--text-secondary)] mb-8 leading-relaxed font-medium">
              Compile multiple individual documents into a single cohesive book or report. Our engine runs global consistency checks across all chapters to ensure character names, terminology, and font hierarchies remain uniform.
            </p>
            <div className="flex gap-4">
              <span className="px-5 py-2.5 rounded border border-[var(--border-strong)] text-sm font-bold bg-[#fdfdfc] dark:bg-[#1e1e20] shadow-sm flex items-center gap-2 hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"><ArrowRight className="h-4 w-4" /> EPUB3 Export</span>
              <span className="px-5 py-2.5 rounded border border-[var(--border-strong)] text-sm font-bold bg-[#fdfdfc] dark:bg-[#1e1e20] shadow-sm flex items-center gap-2 hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"><ArrowRight className="h-4 w-4" /> PDF/A Archival</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS / THE LOOP */}
      <section id="extraction-loop" className="py-28 px-6 border-b border-[var(--border-subtle)] relative overflow-hidden" style={{ background: '#0d0d10' }}>
        {/* keyframes injected via dangerouslySetInnerHTML on a style tag */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes olpdf-pulse {
            0%   { left: 0%;   opacity: 0; }
            6%   { opacity: 1; }
            94%  { opacity: 1; }
            100% { left: calc(100% - 2rem); opacity: 0; }
          }
          @keyframes olpdf-node-breathe {
            0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
            50%      { box-shadow: 0 0 24px 4px rgba(249,115,22,0.18); }
          }
        `}} />

        {/* Faint grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Heading */}
          <div className="text-center mb-24">
            <p className="text-[10px] font-mono font-black uppercase tracking-[0.25em] text-orange-500 mb-5">Pipeline</p>
            <h2 className="font-sans font-black text-4xl md:text-5xl text-white tracking-tight mb-5">The Extraction Loop</h2>
            <p className="text-[#6b7280] text-lg max-w-md mx-auto font-medium">We reconstruct the semantic DOM from raw coordinates.</p>
          </div>

          {/* Pipeline */}
          <div className="relative">
            {/* Desktop orange connector line with traveling pulses */}
            <div className="hidden md:block absolute top-10 z-0" style={{ left: 'calc(12.5% + 2.5rem)', right: 'calc(12.5% + 2.5rem)', height: '1px', background: '#1e1e21' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="absolute inset-y-0 overflow-hidden" style={{ left: `${i * 33.34}%`, width: '33.33%' }}>
                  <div style={{
                    position: 'absolute',
                    top: '-3px',
                    width: '2rem',
                    height: '7px',
                    borderRadius: '9999px',
                    background: 'linear-gradient(90deg, transparent, #f97316 40%, transparent)',
                    animation: `olpdf-pulse 2.4s ease-in-out infinite ${i * 0.8}s`,
                  }} />
                </div>
              ))}
            </div>

            {/* Mobile vertical line */}
            <div className="md:hidden absolute left-10 top-20 bottom-20 w-px" style={{ background: 'linear-gradient(180deg, transparent, #f97316 30%, #f97316 70%, transparent)' }} />

            <div className="grid md:grid-cols-4 gap-8 md:gap-4">
              {[
                { n: '01', name: 'Extract',     desc: 'Raw PDF binaries are parsed to extract untagged text and coordinates.' },
                { n: '02', name: 'Reconstruct', desc: 'Python heuristics engine rebuilds paragraphs, tables, and lists.' },
                { n: '03', name: 'AI Edit',     desc: 'Gemini performs precise JSON tree mutations seamlessly.' },
                { n: '04', name: 'Export',      desc: 'Compiled back into a pristine PDF/A or EPUB3 document.' },
              ].map(({ n, name, desc }) => (
                <div key={n} className="flex flex-col items-center text-center group relative z-10 pl-6 md:pl-0">
                  {/* Node */}
                  <div className="relative mb-7">
                    <div
                      className="h-20 w-20 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:-translate-y-1"
                      style={{
                        background: '#111113',
                        border: '1px solid #2a2a2e',
                        animation: 'olpdf-node-breathe 4s ease-in-out infinite',
                        animationDelay: `${parseInt(n) * 0.6}s`,
                      }}
                    >
                      <span className="font-mono font-black text-2xl text-orange-500">{n}</span>
                    </div>
                    {/* Hover ring */}
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: '0 0 0 2px rgba(249,115,22,0.4)' }} />
                  </div>
                  <h3 className="font-sans font-black text-base text-white mb-2 tracking-tight">{name}</h3>
                  <p className="text-[#6b7280] text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* EASY INTEGRATION / API */}
      <ApiSection />

      {/* EMBED SECTION */}
      <EmbedSection />

      {/* FREE COMMITMENT + COMMUNITY — combined manifesto section */}
      <section className="py-28 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]">
        <div className="max-w-5xl mx-auto">

          {/* Badge */}
          <div className="flex justify-center mb-10">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/8 text-orange-400 text-[11px] font-mono font-black uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              100% Free Forever
            </span>
          </div>

          {/* Manifesto headline */}
          <div className="text-center mb-16">
            <h2 className="font-sans font-black text-6xl md:text-8xl tracking-tight text-[var(--text-primary)] leading-[0.9] mb-8">
              No Paywalls.<br />
              <span className="text-orange-500">Just Documents.</span>
            </h2>
            <p className="text-[var(--text-secondary)] text-xl max-w-xl mx-auto leading-relaxed font-medium">
              Document intelligence should be a public good. Free for individuals and open-source projects, always.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {[
              { icon: Layers,   label: 'Unlimited Projects', desc: 'No cap on documents or books. Create without limits.' },
              { icon: Sparkles, label: 'Full AI Access',      desc: 'Gemini-powered structural editing, no subscription needed.' },
              { icon: Terminal, label: 'Open API',            desc: 'Integrate our extraction engine into your own apps for free.' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="group flex items-start gap-4 p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-orange-500/30 transition-colors duration-300">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 group-hover:bg-orange-500/15 transition-colors">
                  <Icon className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-sans font-black text-[var(--text-primary)] mb-1">{label}</p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* How we survive — dark inset callout */}
          <div className="mb-20 rounded-2xl px-8 py-7" style={{ background: '#0d0d10', border: '1px solid #1e1e21' }}>
            <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[#4b5563] mb-3">How do we survive?</p>
            <p className="text-[var(--text-secondary)] text-lg italic leading-relaxed">
              &ldquo;Supported by infrastructure grants and contributors. We don&apos;t want your credit card — we want your feedback and pull requests.&rdquo;
            </p>
          </div>

          {/* Community CTA */}
          <div className="text-center">
            <p className="text-[10px] font-mono font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-5">Open Source & Community Driven</p>
            <h3 className="font-sans font-black text-3xl md:text-4xl text-[var(--text-primary)] tracking-tight mb-4">
              Built by developers,<br />for developers.
            </h3>
            <p className="text-[var(--text-secondary)] text-base max-w-md mx-auto mb-10 leading-relaxed">
              Check out our good first issues, sponsor the project, or build your own custom extraction plugins.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="https://github.com/chidi09/olpdf" target="_blank" className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-orange-500 hover:bg-orange-400 text-white font-sans font-black text-sm uppercase tracking-widest transition-colors shadow-lg shadow-orange-500/20">
                <Github className="h-4 w-4" /> Star on GitHub
              </Link>
              {[
                { label: 'Contribution Guide', href: '/contribute' },
                { label: 'API Docs',           href: '/docs' },
                { label: 'Plugin Marketplace', href: '/marketplace' },
              ].map(({ label, href }) => (
                <Link key={label} href={href} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] font-bold text-sm transition-colors">
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </section>


      {/* POWERED BY STRIP */}
      <section className="py-16 px-6 border-b border-[var(--border-subtle)] bg-[#0d0d10]">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[10px] font-mono font-bold uppercase tracking-widest text-[#4b5563] mb-10">
            Built on open infrastructure — no black boxes
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {[
              { name: "Next.js",   slug: "nextdotjs",    color: "ffffff" },
              { name: "FastAPI",   slug: "fastapi",      color: null     },
              { name: "Supabase",  slug: "supabase",     color: null     },
              { name: "Cloudflare",slug: "cloudflare",   color: null     },
              { name: "Gemini",    slug: "googlegemini", color: null     },
              { name: "Docker",    slug: "docker",       color: null     },
              { name: "Rust",      slug: "rust",         color: "CE422B" },
            ].map(({ name, slug, color }) => (
              <div key={name} className="flex items-center gap-2.5 text-[#6b7280] hover:text-[#9ca3af] transition-colors">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={color ? `https://cdn.simpleicons.org/${slug}/${color}` : `https://cdn.simpleicons.org/${slug}`}
                  alt={name}
                  width={18}
                  height={18}
                  className="opacity-60"
                />
                <span className="text-sm font-mono font-bold">{name}</span>
              </div>
            ))}
          </div>
          <p className="text-center mt-10 text-sm text-[#4b5563] font-medium">
            The core extraction engine, block model spec, and export pipeline are{" "}
            <Link href="https://github.com/Chidi09/olpdf" target="_blank" className="text-orange-500 hover:text-orange-400 transition-colors font-bold">
              open source
            </Link>
            . Audit it, fork it, self-host it.
          </p>
        </div>
      </section>


      {/* Footer */}
      <footer className="py-20 px-6 bg-[#fdfdfc] dark:bg-[#101011] relative">
          <div className="mx-auto max-w-6xl grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-8">
              <div className="col-span-2 lg:col-span-2">
                  <Link href="/" className="inline-flex items-center gap-2.5 mb-6 select-none group">
                      <div className="relative h-9 w-9 shrink-0 group-hover:scale-105 transition-transform">
                          <Image src={DEFAULT_BRAND.icon192} alt="OLPDF" fill className="object-contain" />
                      </div>
                      <span className="font-sans font-black tracking-tight text-2xl text-[var(--text-primary)]">
                          OL<span className="text-orange-500">PDF</span>
                      </span>
                  </Link>
                  <p className="text-[var(--text-secondary)] text-sm max-w-xs mb-8 font-medium leading-relaxed">
                      The structure-first AI document operating system. Reconstructing the semantic DOM from raw coordinates since 2026.
                  </p>
                  <div className="flex gap-4">
                     <Link href="https://github.com/chidi09/olpdf" target="_blank" className="p-2.5 rounded border border-[var(--border-subtle)] bg-white dark:bg-[#1e1e20] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shadow-sm"><Github className="h-4 w-4" /></Link>
                  </div>
              </div>
              
              <div>
                  <h4 className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-6 font-bold">Product</h4>
                  <ul className="space-y-4 text-sm text-[var(--text-secondary)] font-medium">
                      <li><Link href="/dashboard" className="hover:text-[var(--text-primary)] transition-colors">Workspace</Link></li>
                      <li><Link href="/templates" className="hover:text-[var(--text-primary)] transition-colors">Templates</Link></li>
                      <li><Link href="/toolkit" className="hover:text-[var(--text-primary)] transition-colors">Toolkit</Link></li>
                  </ul>
              </div>

              <div>
                  <h4 className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-6 font-bold">Resources</h4>
                  <ul className="space-y-4 text-sm text-[var(--text-secondary)] font-medium">
                      <li><Link href="/docs" className="hover:text-[var(--text-primary)] transition-colors">Documentation</Link></li>
                      <li><Link href="/contribute" className="hover:text-[var(--text-primary)] transition-colors">Contribute</Link></li>
                  </ul>
              </div>

              <div>
                  <h4 className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-widest mb-6 font-bold">Legal</h4>
                  <ul className="space-y-4 text-sm text-[var(--text-secondary)] font-medium">
                      <li><Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">Privacy Policy</Link></li>
                      <li><Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors">Terms of Service</Link></li>
                  </ul>
              </div>
          </div>
          
          <div className="mx-auto max-w-6xl pt-8 border-t border-[var(--border-subtle)] flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-[var(--text-tertiary)]">
              <div>
                  © 2026 OLPDF. Released under MIT License.
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                System Status: Operational
              </div>
          </div>
      </footer>

    </main>
  );
}
