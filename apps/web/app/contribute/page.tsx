"use client";

import Link from "next/link";
import {
  CodeBracketSquareIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  UsersIcon,
  ArrowRightIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import BackLink from "@/components/BackLink";
import { GlassCard, GlassPanel } from "@/components/ui/Glass";

export default function ContributePage() {
  const stackItems = [
    {
      name: "Next.js 15",
      icon: "https://cdn.simpleicons.org/nextdotjs/ffffff",
    },
    {
      name: "Python FastAPI",
      icon: "https://cdn.simpleicons.org/fastapi/009688",
    },
    {
      name: "PostgreSQL",
      icon: "https://cdn.simpleicons.org/postgresql/4169E1",
    },
    {
      name: "Gemini AI",
      icon: "https://cdn.simpleicons.org/googlegemini/8E75B2",
    },
  ];

  return (
    <main className="app-shell-font min-h-screen bg-[var(--bg-base)] pb-24 text-[var(--text-primary)] transition-colors duration-300">
      <div className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 pb-14 pt-16">
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] -translate-y-1/4 translate-x-1/4 rounded-full bg-[var(--accent)]/5 blur-[130px]" />
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <BackLink href="/" label="Back to home" className="mb-8 justify-center" />
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
            <UsersIcon className="h-3 w-3" /> Community Driven
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight md:text-6xl">Building OLPDF Together</h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
            We are building the future of document intelligence in the open. Join hundreds of contributors in shaping how the world edits PDFs.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-20 px-6 py-14">
        <section className="grid gap-6 md:grid-cols-3">
          <GlassCard className="p-6">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-blue-400">
              <CodeBracketSquareIcon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Core Engine</h3>
            <p className="mb-5 text-sm leading-relaxed text-[var(--text-secondary)]">
              Help us refine the Python heuristics for PDF layout reconstruction or improve our Gemini tool-calling loops.
            </p>
            <Link href="https://github.com/chidi09/olpdf" target="_blank">
              <Button variant="outline" className="w-full">
                Browse Code <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-purple-400">
              <ChatBubbleLeftRightIcon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Feedback</h3>
            <p className="mb-5 text-sm leading-relaxed text-[var(--text-secondary)]">
              Report bugs, suggest new PDF toolkit operations, or share how you use OLPDF in your professional workflow.
            </p>
            <Link href="https://github.com/chidi09/olpdf/issues" target="_blank">
              <Button variant="outline" className="w-full">
                Open Issue <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-amber-400">
              <HeartIcon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Support</h3>
            <p className="mb-5 text-sm leading-relaxed text-[var(--text-secondary)]">
              OLPDF is 100% free. If it saves you time, consider sponsoring the project to cover our infrastructure costs.
            </p>
            <div className="grid gap-2">
              <a href="#" className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition-all hover:bg-white/[0.08]">
                <img src="/payments/00-19-37-11-May-2026.png" alt="Opay" className="h-4 w-4 rounded-sm object-cover" />
                Sponsor with Opay
              </a>
              <a href="#" className="flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition-all hover:bg-white/[0.08]">
                <img src="/payments/PNG image.png" alt="PalmPay" className="h-4 w-4 rounded-sm object-cover" />
                Sponsor with PalmPay
              </a>
            </div>
          </GlassCard>
        </section>

        <GlassPanel className="p-10">
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Contribute to the Stack</h2>
          <div className="mb-10 grid grid-cols-2 gap-8 md:grid-cols-4">
            {stackItems.map((item) => (
              <div key={item.name} className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition-transform hover:scale-105">
                  <img src={item.icon} alt={item.name} className="h-7 w-7" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider">{item.name}</span>
              </div>
            ))}
          </div>

          <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-7">
            <h4 className="mb-3 text-center text-base font-semibold">First-time contributor?</h4>
            <p className="mb-5 text-center text-sm leading-relaxed text-[var(--text-secondary)]">
              Check out our <code>GOOD_FIRST_ISSUES.md</code> on GitHub. We have plenty of "frontend-only" styling tasks and "backend-only" parser improvements waiting for your hands.
            </p>
            <div className="flex justify-center">
              <Link href="https://github.com/chidi09/olpdf" className="inline-flex items-center gap-2 font-semibold text-[var(--accent)] hover:underline">
                Start here <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </GlassPanel>
      </div>
    </main>
  );
}
