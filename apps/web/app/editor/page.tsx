"use client";

import Link from "next/link";
import { FileEdit, Search, Filter, Upload, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditorDocsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border-subtle)] px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileEdit className="h-6 w-6 text-[var(--accent)]" />
          My Documents
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
            <input 
              type="text"
              placeholder="Search documents..."
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full pl-10 pr-4 py-2 text-sm w-64 outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <Button variant="outline" className="rounded-full h-10 w-10 p-0 border-[var(--border-strong)]"><Filter className="h-4 w-4" /></Button>
          <Button className="rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] px-4 font-bold shadow-lg hover:shadow-xl transition-all h-10 gap-2">
            <Plus className="h-4 w-4" /> New Document
          </Button>
        </div>
      </header>

      <main className="flex-1 p-8">
        <div className="py-20 flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full scale-150" />
            <div className="h-24 w-24 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 relative z-10">
              <FileText className="h-10 w-10" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2">No documents yet</h3>
          <p className="text-[var(--text-secondary)] max-w-sm mb-8">
            Create a new blank document or import a PDF to start editing with full fidelity.
          </p>
          <div className="flex gap-4">
            <Link href="/editor/new">
              <Button className="rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] px-6 font-bold shadow-lg h-12 gap-2">
                <Plus className="h-4 w-4" /> Blank Document
              </Button>
            </Link>
            <Button variant="outline" className="rounded-full px-6 font-bold border-[var(--border-strong)] h-12 gap-2">
              <Upload className="h-4 w-4" /> Import PDF
            </Button>
          </div>
        </div>

        {/* Skeleton State Example (Hidden normally, shown while loading data) */}
        <div className="mt-24 border-t border-[var(--border-subtle)] pt-12">
          <h4 className="text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-6">Loading State Preview</h4>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 animate-pulse">
                <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] mb-4" />
                <div className="h-4 w-3/4 bg-[var(--bg-elevated)] rounded mb-2" />
                <div className="h-3 w-1/2 bg-[var(--bg-elevated)] rounded" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
