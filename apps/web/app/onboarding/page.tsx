"use client";

import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  ArrowRightIcon,
  CheckIcon,
  DocumentTextIcon,
  BookOpenIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentListIcon,
  CloudIcon,
  ServerIcon,
} from "@heroicons/react/24/outline";
import { useOnboardingStore } from "@/store/useOnboardingStore";

const STEPS = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Mode" },
  { id: 3, label: "Use case" },
  { id: 4, label: "Done" },
];

const USE_CASES = [
  { key: "documents" as const, label: "Documents", desc: "Reports, contracts, papers", icon: DocumentTextIcon },
  { key: "books" as const, label: "Books", desc: "Long-form annotation", icon: BookOpenIcon },
  { key: "toolkit" as const, label: "Toolkit", desc: "Merge and restructure", icon: WrenchScrewdriverIcon },
  { key: "forms" as const, label: "Forms", desc: "Extract form data", icon: ClipboardDocumentListIcon },
];

export default function OnboardingPage() {
  const supabase = createSupabaseBrowserClient();
  const { step, mode, useCase, setStep, setMode, setUseCase, complete } = useOnboardingStore();

  const signInWithGoogle = async () => {
    setMode("cloud");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
  };

  return (
    <div className="flex min-h-screen bg-black font-sans text-[#ededed]">
      <div className="relative flex min-h-screen w-full flex-col border-r border-[#222] px-8 py-10 lg:w-[45%]">
        <div className="mb-16">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-wide">
            <div className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-gradient-to-br from-orange-500 to-orange-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)]">
              <span className="text-xs font-black text-white">O</span>
            </div>
            OLPDF
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <div className="mb-8 flex items-center gap-2">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`h-1 rounded-full transition-all duration-300 ${
                  s.id < step
                    ? "w-8 bg-white"
                    : s.id === step
                    ? "w-12 bg-white"
                    : "w-8 bg-[#222]"
                }`}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              <div>
                <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">Welcome to OLPDF</h1>
                <p className="text-sm leading-relaxed text-[#888]">
                  A structure-first document editor. Edit PDFs like Word documents - free, forever.
                </p>
              </div>

              <ul className="space-y-3 pt-2">
                {[
                  "Semantic block extraction.",
                  "AI rewrites with document context.",
                  "Export to EPUB3 and DOCX.",
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm font-medium text-[#ededed]">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setStep(2)}
                className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-semibold text-black transition-all hover:bg-[#e5e5e5] active:scale-[0.98]"
              >
                Continue <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              <div>
                <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">Choose your mode</h1>
                <p className="text-sm leading-relaxed text-[#888]">
                  Select local-first for privacy, or cloud for sync.
                </p>
              </div>

              <div className="grid gap-3 pt-2">
                <button
                  onClick={() => {
                    setMode("guest");
                    setStep(3);
                  }}
                  className={`w-full rounded-xl liquid-glass liquid-glass-noise p-4 text-left transition-all active:scale-[0.98] ${
                    mode === "guest" ? "ring-1 ring-orange-500/60" : "hover:scale-[1.01]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#333] bg-[#111]">
                      <ServerIcon className="h-4 w-4 text-[#888]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Guest Mode</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#666]">No account. Edits stay in your browser. Great for one-off tasks.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={signInWithGoogle}
                  className={`w-full rounded-xl liquid-glass liquid-glass-noise p-4 text-left transition-all active:scale-[0.98] ${
                    mode === "cloud" ? "ring-1 ring-orange-500/60" : "hover:scale-[1.01]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#333] bg-[#111]">
                      <CloudIcon className="h-4 w-4 text-[#888]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Cloud Sync</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#666]">Sync across devices and collaborate. Sign in with Google.</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              <div>
                <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">Select a workflow</h1>
                <p className="text-sm leading-relaxed text-[#888]">
                  We&apos;ll tailor your workspace to your primary use case.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {USE_CASES.map(({ key, label, desc, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => {
                      setUseCase(key);
                      setStep(4);
                      complete();
                    }}
                    className={`flex flex-col rounded-xl liquid-glass liquid-glass-noise p-4 text-left transition-all active:scale-[0.98] ${
                      useCase === key ? "ring-1 ring-orange-500/60" : "hover:scale-[1.01]"
                    }`}
                  >
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg liquid-glass">
                      <Icon className="h-4 w-4 text-white/60" />
                    </div>
                    <p className="mb-0.5 text-sm font-semibold text-white">{label}</p>
                    <p className="text-[11px] leading-relaxed text-[#666]">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              <div>
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
                  <CheckIcon className="h-3 w-3" /> Complete
                </div>
                <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">You&apos;re all set</h1>
                <p className="text-sm leading-relaxed text-[#888]">Your workspace is ready.</p>
              </div>

              {mode === "guest" && (
                <div className="rounded-md border border-[#333] bg-[#111] px-4 py-3 text-xs text-[#888]">
                  <strong className="font-medium text-white">Guest mode active.</strong> Edits are local. You can sign in later from settings.
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Link
                  href="/dashboard"
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-semibold text-black transition-all hover:bg-[#e5e5e5] active:scale-[0.98]"
                >
                  Open Dashboard
                </Link>
                <Link
                  href="/dashboard/upload"
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[#333] bg-[#0A0A0A] text-sm font-semibold text-[#ededed] transition-all hover:bg-[#111] active:scale-[0.98]"
                >
                  Upload PDF
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative hidden min-h-screen flex-1 flex-col overflow-hidden bg-[#050505] lg:flex">
        <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-full rounded-full bg-orange-600/10 blur-[120px]" />
      </div>
    </div>
  );
}
