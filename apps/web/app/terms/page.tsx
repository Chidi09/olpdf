"use client";

import { Scale, ShieldCheck, UserCheck, ScrollText, AlertTriangle, Ban, FileSignature, HelpCircle } from "lucide-react";
import BackLink from "@/components/BackLink";

export default function TermsPage() {
  const sections = [
    {
      title: "1. Agreement to Terms",
      icon: ScrollText,
      content: "By accessing or using OLPDF, you agree to these Terms and any policies referenced within them. If you use OLPDF on behalf of an organization, you represent that you have authority to bind that organization."
    },
    {
      title: "2. Account and Access",
      icon: UserCheck,
      content: "You are responsible for account credentials, authorized access, and all activity under your account. We may suspend or restrict access where needed to protect users, infrastructure, or legal compliance."
    },
    {
      title: "3. Acceptable Use",
      icon: Ban,
      content: "You may not use OLPDF for unlawful, infringing, fraudulent, abusive, or security-disruptive activity. You may not attempt to bypass rate limits, abuse compute resources, or distribute malware through uploads or exports."
    },
    {
      title: "4. User Content and Licenses",
      icon: FileSignature,
      content: "You retain ownership of your content. You grant OLPDF a limited license to host, process, transform, and transmit content solely to operate the service features you request, such as parsing, AI-assisted transformation, and export generation."
    },
    {
      title: "5. AI and Generated Output",
      icon: AlertTriangle,
      content: "AI suggestions can be inaccurate or incomplete. You are responsible for review, approval, and final compliance of generated content before publication, filing, or legal submission."
    },
    {
      title: "6. Disclaimer of Warranties",
      icon: ShieldCheck,
      content: "The service is provided on an \"AS IS\" and \"AS AVAILABLE\" basis without warranties of any kind, express or implied. We do not guarantee 100% accuracy in PDF reconstruction due to the complex nature of the format."
    }
  ];

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24 transition-colors duration-300">
      {/* Header */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] pt-16 pb-12 px-6">
        <div className="mx-auto max-w-3xl">
          <BackLink href="/" label="Back to home" className="mb-8" />
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 flex items-center gap-4">
            <Scale className="h-10 w-10 text-[var(--accent)]" /> Terms of Service
          </h1>
          <p className="text-[var(--text-tertiary)] font-bold text-xs uppercase tracking-widest">
            Last updated: May 6, 2026 • Version 1.1
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="prose prose-invert max-w-none mb-16">
           <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
             Please read these terms carefully before using OLPDF. By using our platform, you agree to follow the rules and guidelines established to ensure a safe and productive environment for all users.
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

        <div className="mt-20 p-8 rounded-[32px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center">
           <HelpCircle className="h-10 w-10 text-[var(--accent)] mx-auto mb-4" />
           <h3 className="text-xl font-black mb-4">Legal Inquiries</h3>
           <p className="text-sm text-[var(--text-secondary)] mb-6">
             For specific legal questions or concerns regarding these terms, please contact our legal representative.
           </p>
           <a href="mailto:legal@olpdf.xyz" className="inline-flex items-center gap-2 bg-[var(--text-primary)] text-[var(--bg-base)] px-6 py-2.5 rounded-full font-bold text-sm shadow-lg hover:opacity-90 transition-all">
              Contact Legal
           </a>
        </div>
      </div>
    </main>
  );
}
