"use client";

import Link from "next/link";
import { 
  Code2, 
  Github, 
  MessageSquare, 
  Heart, 
  Users, 
  ArrowRight, 
  Sparkles,
  Zap,
  Shield,
  Database,
  Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BackLink from "@/components/BackLink";

export default function ContributePage() {
  const stackItems = [
    { name: "Next.js 15", icon: Zap, color: "text-blue-500" },
    { name: "Python FastAPI", icon: Cpu, color: "text-emerald-500" },
    { name: "PostgreSQL", icon: Database, color: "text-blue-600" },
    { name: "Gemini AI", icon: Sparkles, color: "text-[var(--accent)]" },
  ];

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24 transition-colors duration-300">
      {/* Hero Section */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] pt-20 pb-16 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--accent)]/5 rounded-full blur-[140px] translate-x-1/4 -translate-y-1/4 pointer-events-none"></div>
        <div className="mx-auto max-w-5xl relative z-10 text-center">
          <BackLink href="/" label="Back to home" className="justify-center mb-8" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-black uppercase tracking-widest mb-6">
            <Users className="h-3 w-3" /> Community Driven
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
            Building OLPDF Together
          </h1>
          <p className="max-w-2xl mx-auto text-[var(--text-secondary)] text-xl leading-relaxed font-medium">
            We are building the future of document intelligence in the open. Join hundreds of contributors in shaping how the world edits PDFs.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-24">
        
        {/* Contribution Paths */}
        <section className="grid md:grid-cols-3 gap-8">
          <div className="group p-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]/50 transition-all">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6">
              <Code2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black mb-3">Core Engine</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
              Help us refine the Python heuristics for PDF layout reconstruction or improve our Gemini tool-calling loops.
            </p>
            <Link href="https://github.com/olpdf/olpdf" target="_blank">
               <Button variant="outline" className="w-full rounded-xl border-[var(--border-strong)] font-bold group-hover:bg-[var(--accent)] group-hover:text-white group-hover:border-[var(--accent)] transition-all">
                  Browse Code <ArrowRight className="ml-2 h-4 w-4" />
               </Button>
            </Link>
          </div>

          <div className="group p-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]/50 transition-all">
            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-6">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black mb-3">Feedback</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
              Report bugs, suggest new PDF toolkit operations, or share how you use OLPDF in your professional workflow.
            </p>
            <Link href="https://github.com/olpdf/olpdf/issues" target="_blank">
               <Button variant="outline" className="w-full rounded-xl border-[var(--border-strong)] font-bold group-hover:bg-[var(--accent)] group-hover:text-white group-hover:border-[var(--accent)] transition-all">
                  Open Issue <ArrowRight className="ml-2 h-4 w-4" />
               </Button>
            </Link>
          </div>

          <div className="group p-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]/50 transition-all">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
              <Heart className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-black mb-3">Support</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
              OLPDF is 100% free. If it saves you time, consider sponsoring the project to cover our infrastructure costs.
            </p>
            <Link href="#" target="_blank">
               <Button variant="outline" className="w-full rounded-xl border-[var(--border-strong)] font-bold group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all">
                  Sponsor Us <Heart className="ml-2 h-4 w-4 fill-current" />
               </Button>
            </Link>
          </div>
        </section>

        {/* Tech Stack Contributor Guide */}
        <section className="bg-[var(--bg-surface)] rounded-[40px] border border-[var(--border-subtle)] p-12 relative overflow-hidden">
           <div className="relative z-10">
              <h2 className="text-3xl font-black mb-8 text-center">Contribute to the Stack</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                 {stackItems.map((item) => (
                   <div key={item.name} className="flex flex-col items-center text-center gap-3">
                      <div className={`h-16 w-16 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-center ${item.color} shadow-sm group hover:scale-110 transition-transform`}>
                         <item.icon className="h-8 w-8" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider">{item.name}</span>
                   </div>
                 ))}
              </div>
              <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                 <h4 className="font-bold mb-4 text-center">First-time contributor?</h4>
                 <p className="text-sm text-[var(--text-secondary)] text-center leading-relaxed mb-6">
                    Check out our <code>GOOD_FIRST_ISSUES.md</code> on GitHub. We have plenty of "frontend-only" styling tasks and "backend-only" parser improvements waiting for your hands.
                 </p>
                 <div className="flex justify-center">
                    <Link href="https://github.com/olpdf/olpdf" className="inline-flex items-center gap-2 text-[var(--accent)] font-black hover:underline">
                       <Github className="h-5 w-5" /> Start here <ArrowRight className="h-4 w-4" />
                    </Link>
                 </div>
              </div>
           </div>
        </section>

      </div>
    </main>
  );
}
