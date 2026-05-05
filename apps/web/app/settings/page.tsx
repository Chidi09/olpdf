"use client";

import { 
  Settings, 
  User, 
  FileText, 
  Sparkles, 
  Shield, 
  Trash2, 
  ArrowRight,
  Database,
  Lock,
  Cloud,
  Layers,
  Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BackLink from "@/components/BackLink";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24 transition-colors duration-300">
      {/* Header */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] pt-16 pb-12 px-6">
        <div className="mx-auto max-w-4xl">
          <BackLink href="/dashboard" label="Back to workspace" className="mb-8" />
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 flex items-center gap-4">
            <Settings className="h-10 w-10 text-[var(--accent)]" /> Settings
          </h1>
          <p className="max-w-2xl text-[var(--text-secondary)] text-lg leading-relaxed font-medium">
            Configure your document operating system, managed AI preferences, and security defaults.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16 space-y-16">
        
        {/* Account Section */}
        <section className="grid md:grid-cols-3 gap-8">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 mb-2">
              <User className="h-5 w-5 text-blue-500" /> Account
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] font-medium leading-relaxed">
              Your profile identity and authentication provider details.
            </p>
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
               <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">Display Name</label>
                    <input 
                      type="text" 
                      defaultValue="Guest User" 
                      className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--accent)] transition-all"
                    />
                  </div>
                  <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold mb-0.5">Auth Provider</div>
                      <div className="text-[10px] font-medium text-emerald-500 flex items-center gap-1">
                        <div className="h-1 w-1 rounded-full bg-emerald-500" /> Local Guest Mode
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-full px-4 text-[10px] font-black uppercase border-[var(--border-strong)]">Link Provider</Button>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Document Defaults Section */}
        <section className="grid md:grid-cols-3 gap-8">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-purple-500" /> Documents
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] font-medium leading-relaxed">
              Global defaults for every new project created in OLPDF.
            </p>
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
               <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">Standard Page Size</label>
                    <select className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--accent)] appearance-none transition-all">
                       <option>ISO A4 (210 x 297mm)</option>
                       <option>US Letter (8.5 x 11in)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">Export Standard</label>
                    <select className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--accent)] appearance-none transition-all">
                       <option>PDF/A-2b Archival</option>
                       <option>Tagged PDF (UA)</option>
                       <option>EPUB 3.0</option>
                    </select>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* AI Routing Section */}
        <section className="grid md:grid-cols-3 gap-8">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-amber-500" /> AI Engine
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] font-medium leading-relaxed">
              Configure how our structural heuristics interface with LLMs.
            </p>
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
               <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">Provider</label>
                      <div className="flex items-center gap-3 bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5">
                         <div className="h-4 w-4 bg-blue-500 rounded-full" />
                         <span className="text-sm font-bold">Google Gemini</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-2 block">Default Model</label>
                      <select className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-[var(--accent)] appearance-none transition-all">
                         <option>Gemini 1.5 Pro (Balanced)</option>
                         <option>Gemini 1.5 Flash (Fast)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--bg-base)] border border-dashed border-[var(--border-strong)]">
                     <input type="checkbox" defaultChecked className="mt-1 h-4 w-4 rounded border-[var(--border-strong)] text-[var(--accent)]" />
                     <div>
                       <div className="text-xs font-bold mb-1">Smart Task Routing</div>
                       <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">Automatically use Flash for simple extraction and Pro for complex table reconstruction.</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Data & Privacy Section */}
        <section className="grid md:grid-cols-3 gap-8 pt-8 border-t border-[var(--border-subtle)]">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-red-500" /> Data & Safety
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] font-medium leading-relaxed">
              Manage your document retention and local storage data.
            </p>
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="bg-[var(--bg-elevated)] p-8 rounded-3xl border border-red-500/20 shadow-sm">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <h3 className="font-bold mb-1">Erase Workspace Data</h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-sm">
                      This will permanently delete all local documents, favorites, and version history. This action is irreversible.
                    </p>
                  </div>
                  <Button className="bg-red-500 text-white font-black rounded-full px-6 hover:bg-red-600 transition-all shrink-0">
                    <Trash2 className="h-4 w-4 mr-2" /> Purge All Data
                  </Button>
               </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
