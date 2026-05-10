"use client";

import Link from "next/link";
import { HelpCircle, Search, Mail, FileText, ExternalLink, MessageSquare } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border-subtle)] px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-[var(--accent)]" />
          Help & Support
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
            <input 
              type="text"
              placeholder="Search help articles..."
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full pl-10 pr-4 py-2 text-sm w-64 outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full space-y-12">
        <div className="py-12 flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full scale-150" />
            <div className="h-20 w-20 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 relative z-10">
              <MessageSquare className="h-10 w-10" />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold mb-4">How can we help you today?</h2>
          <p className="text-[var(--text-secondary)] max-w-xl text-lg">
            Browse our documentation, read frequently asked questions, or get in touch with our support team.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link href="/docs" className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 transition-all hover:border-[var(--accent)] hover:shadow-lg">
            <div className="mb-4 h-12 w-12 bg-[var(--bg-elevated)] rounded-xl flex items-center justify-center border border-[var(--border-subtle)] group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)] transition-colors">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Documentation</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-4">Detailed guides on using the editor, API, and managing templates.</p>
            <span className="text-[var(--accent)] text-sm font-semibold flex items-center gap-1">Read docs <ExternalLink className="h-3 w-3" /></span>
          </Link>

          <div className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 transition-all hover:border-emerald-500/50 hover:shadow-lg">
            <div className="mb-4 h-12 w-12 bg-[var(--bg-elevated)] rounded-xl flex items-center justify-center border border-[var(--border-subtle)] group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors">
              <HelpCircle className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">FAQ</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-4">Answers to the most common questions about features and billing.</p>
            <span className="text-emerald-500 text-sm font-semibold flex items-center gap-1">View FAQ <ExternalLink className="h-3 w-3" /></span>
          </div>

          <div className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 transition-all hover:border-amber-500/50 hover:shadow-lg">
            <div className="mb-4 h-12 w-12 bg-[var(--bg-elevated)] rounded-xl flex items-center justify-center border border-[var(--border-subtle)] group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors">
              <Mail className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Contact Support</h3>
            <p className="text-[var(--text-secondary)] text-sm mb-4">Can&apos;t find what you need? Send us a message directly.</p>
            <span className="text-amber-500 text-sm font-semibold flex items-center gap-1">Email us <ExternalLink className="h-3 w-3" /></span>
          </div>
        </div>

        {/* Skeleton State Example for potential dynamic FAQ loading */}
        <div className="mt-16 border-t border-[var(--border-subtle)] pt-12">
          <h4 className="text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-6">Popular Articles (Loading...)</h4>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 animate-pulse">
                <div className="h-5 w-1/3 bg-[var(--bg-elevated)] rounded mb-3" />
                <div className="h-3 w-full bg-[var(--bg-elevated)] rounded mb-2" />
                <div className="h-3 w-2/3 bg-[var(--bg-elevated)] rounded" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
