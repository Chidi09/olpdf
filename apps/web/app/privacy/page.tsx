"use client";

import { Shield, Lock, Eye, Trash2, Globe, Bell, FileText, Scale } from "lucide-react";
import BackLink from "@/components/BackLink";

export default function PrivacyPage() {
  const sections = [
    {
      title: "1. Scope and Commitments",
      icon: Shield,
      content: "This policy explains how OLPDF collects, uses, stores, and protects information when you use the web app, API, and related services. We apply data minimization by default and only process what is needed to deliver document operations, AI actions, collaboration, and account security."
    },
    {
      title: "2. Information We Process",
      icon: FileText,
      content: "Account mode may include name, email, avatar, auth provider ID, billing metadata, and audit events. Document mode may include uploaded files, extracted text structure, generated previews, edits, version snapshots, AI instructions, AI diff logs, and export outputs."
    },
    {
      title: "3. Why We Use Data",
      icon: Eye,
      content: "We use information to authenticate users, run toolkit operations, generate AI suggestions, prevent fraud/abuse, maintain uptime, and improve product reliability. We do not sell personal data. We do not use your private documents to train foundation models unless you explicitly opt in."
    },
    {
      title: "4. Security Controls",
      icon: Lock,
      content: "We use encryption in transit, encryption at rest for managed storage, access controls, scoped service credentials, and auditable API events. No system is perfectly secure, but we continuously harden controls and incident response procedures."
    },
    {
      title: "5. Retention and Deletion",
      icon: Trash2,
      content: "Retention depends on workspace settings and plan defaults. Temporary processing artifacts are removed on a rolling schedule. You can delete projects and account data from Settings at any time."
    },
    {
      title: "6. International Transfers",
      icon: Globe,
      content: "If data is processed across regions, we apply safeguards such as standard contractual clauses or equivalent mechanisms where required to ensure your data remains protected under international law."
    }
  ];

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24 transition-colors duration-300">
      {/* Header */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] pt-16 pb-12 px-6">
        <div className="mx-auto max-w-3xl">
          <BackLink href="/" label="Back to home" className="mb-8" />
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 flex items-center gap-4">
            <Shield className="h-10 w-10 text-[var(--accent)]" /> Privacy Policy
          </h1>
          <p className="text-[var(--text-tertiary)] font-bold text-xs uppercase tracking-widest">
            Last updated: May 6, 2026 • Version 1.2
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="prose prose-invert max-w-none mb-16">
           <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
             At OLPDF, we believe that document privacy is a fundamental human right. Our systems are designed to process your data securely while giving you full transparency into how it is handled.
           </p>
        </div>

        <div className="space-y-12">
          {sections.map((section, i) => (
            <section key={i} className="group relative">
               <div className="flex items-start gap-6">
                  <div className="h-12 w-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 group-hover:border-[var(--accent)]/50 transition-colors">
                     <section.icon className="h-6 w-6 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black mb-3">{section.title}</h2>
                    <p className="text-[var(--text-secondary)] leading-relaxed font-medium">
                      {section.content}
                    </p>
                  </div>
               </div>
            </section>
          ))}
        </div>

        <div className="mt-20 p-8 rounded-[32px] bg-[var(--accent-subtle)] border border-[var(--accent)]/20 text-center">
           <h3 className="text-xl font-black mb-4">Have questions?</h3>
           <p className="text-sm text-[var(--text-secondary)] mb-6">
             Our privacy team is available to help with data export requests, deletion, or technical security inquiries.
           </p>
           <a href="mailto:privacy@olpdf.com" className="inline-flex items-center gap-2 bg-[var(--accent)] text-[var(--text-on-accent)] px-6 py-2.5 rounded-full font-bold text-sm shadow-lg hover:opacity-90 transition-all">
              Email Privacy Team
           </a>
        </div>
      </div>
    </main>
  );
}
