"use client";

import Link from "next/link";
import { Shield, Lock, EyeOff, Server, Activity, ChevronRight } from "lucide-react";
import BackLink from "@/components/BackLink";

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24 transition-colors duration-300">
      {/* Header */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] pt-16 pb-12 px-6">
        <div className="mx-auto max-w-4xl">
          <BackLink href="/" label="Back to Home" className="mb-8" />
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 flex items-center gap-4">
            <Shield className="h-10 w-10 text-emerald-500" /> Security & Vulnerability Disclosure
          </h1>
          <p className="max-w-2xl text-[var(--text-secondary)] text-lg leading-relaxed font-medium">
            We take the security of your documents seriously. OLPDF employs enterprise-grade infrastructure and strict data policies to ensure your intellectual property remains yours.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16 space-y-16">
        
        {/* Core Principles */}
        <section className="grid sm:grid-cols-2 gap-8">
          <div className="bg-[var(--bg-elevated)] p-8 rounded-3xl border border-[var(--border-subtle)] shadow-sm">
            <Lock className="h-8 w-8 text-blue-500 mb-4" />
            <h3 className="text-xl font-bold mb-3">Encryption Everywhere</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              All data is encrypted in transit using TLS 1.3 and at rest using AES-256. We utilize Cloudflare R2 for highly available, zero-egress object storage with strict access controls.
            </p>
          </div>
          <div className="bg-[var(--bg-elevated)] p-8 rounded-3xl border border-[var(--border-subtle)] shadow-sm">
            <EyeOff className="h-8 w-8 text-purple-500 mb-4" />
            <h3 className="text-xl font-bold mb-3">Privacy by Design</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              We never use your private documents to train our foundation models. OLPDF employs strict row-level security (RLS) ensuring that your data is only accessible to authorized accounts.
            </p>
          </div>
        </section>

        {/* Responsible Disclosure */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Activity className="h-6 w-6 text-[var(--accent)]" />
            <h2 className="text-3xl font-black">Responsible Disclosure</h2>
          </div>
          <div className="prose prose-slate dark:prose-invert max-w-none text-[var(--text-secondary)]">
            <p>
              If you believe you&apos;ve found a security vulnerability in OLPDF, please notify us immediately. We will work with you to resolve the issue promptly.
            </p>
            <h3>Reporting Guidelines</h3>
            <ul>
              <li>Email your findings to <strong>security@olpdf.xyz</strong>.</li>
              <li>Provide detailed steps to reproduce the vulnerability.</li>
              <li>Do not disclose the vulnerability publicly until we have had a reasonable amount of time to deploy a fix (typically 90 days).</li>
              <li>Do not exploit the vulnerability further than necessary to demonstrate its existence.</li>
              <li>Do not access or modify data belonging to other users.</li>
            </ul>
            <h3>Out of Scope</h3>
            <p>The following issues are generally considered out of scope for our bug bounty/disclosure program:</p>
            <ul>
              <li>Clickjacking on pages with no sensitive actions.</li>
              <li>Unauthenticated/logout/login CSRF.</li>
              <li>Attacks requiring MITM or physical access to a user&apos;s device.</li>
              <li>Missing security headers which do not lead directly to a vulnerability.</li>
            </ul>
          </div>
        </section>

        {/* Compliance */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Server className="h-6 w-6 text-emerald-500" />
            <h2 className="text-3xl font-black">Compliance & Infrastructure</h2>
          </div>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
             <div className="p-6 border-b border-[var(--border-subtle)]">
               <h3 className="font-bold text-lg">Sub-processors</h3>
               <p className="text-sm text-[var(--text-secondary)] mt-1">We use the following trusted providers to deliver our service:</p>
             </div>
             <div className="divide-y divide-[var(--border-subtle)]">
               <div className="p-6 flex justify-between items-center hover:bg-[var(--bg-surface)] transition-colors">
                  <div>
                    <h4 className="font-bold">Cloudflare</h4>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">CDN, WAF, and R2 Object Storage (US/EU)</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] bg-[var(--bg-base)] px-2 py-1 rounded">SOC 2 Type II</span>
               </div>
               <div className="p-6 flex justify-between items-center hover:bg-[var(--bg-surface)] transition-colors">
                  <div>
                    <h4 className="font-bold">Supabase</h4>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Database and Authentication (AWS/AWS EU)</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] bg-[var(--bg-base)] px-2 py-1 rounded">SOC 2 Type II</span>
               </div>
               <div className="p-6 flex justify-between items-center hover:bg-[var(--bg-surface)] transition-colors">
                  <div>
                    <h4 className="font-bold">Modal</h4>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">GPU Compute and Async Workers</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] bg-[var(--bg-base)] px-2 py-1 rounded">SOC 2 Type II</span>
               </div>
             </div>
          </div>
        </section>

      </div>
    </main>
  );
}
