"use client";

import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ArrowRight, Check, FileText, BookOpen, Wrench, ClipboardList, Cloud, HardDrive } from "lucide-react";
import { useOnboardingStore } from "@/store/useOnboardingStore";

const STEPS = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Mode" },
  { id: 3, label: "Use case" },
  { id: 4, label: "Done" },
];

const USE_CASES = [
  { key: "documents" as const, label: "Documents", desc: "Reports, contracts, research papers", icon: FileText },
  { key: "books" as const, label: "Books", desc: "Long-form reading & annotation", icon: BookOpen },
  { key: "toolkit" as const, label: "Toolkit", desc: "Convert, merge, and restructure files", icon: Wrench },
  { key: "forms" as const, label: "Forms", desc: "Fill, sign, and extract form data", icon: ClipboardList },
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

  const illustrations = [
    "/onboarding-1.png",
    "/onboarding-2.png",
    "/onboarding-3.png",
    "/onboarding-4.png",
  ];

  const currentIllustration = illustrations[step - 1];

  return (
    <div className="flex min-h-screen bg-[#0a0a0c]">

      {/* ── Left pane — content ───────────────────────────────────────── */}
      <div className="relative flex flex-col w-full lg:w-[52%] xl:w-[48%] min-h-screen px-8 sm:px-14 py-10">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="inline-flex items-baseline select-none">
            <span className="font-sans font-black tracking-tighter text-orange-500 text-2xl">O</span>
            <span className="font-serif font-light text-white -ml-0.5 mr-0.5 text-2xl">L</span>
            <span className="bg-[#e21818] text-white px-2 py-0.5 rounded-md inline-flex items-baseline relative">
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-md pointer-events-none" />
              <span className="font-mono font-bold text-lg opacity-90 relative z-10">P</span>
              <span className="font-serif font-black text-lg -ml-0.5 relative z-10">D</span>
              <span className="font-sans font-thin italic text-lg ml-0.5 relative z-10">F</span>
            </span>
          </Link>
        </div>

        {/* Step content */}
        <div className="flex flex-col flex-1 justify-center max-w-sm w-full mx-auto">

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-10">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s.id < step
                    ? "w-6 bg-orange-500"
                    : s.id === step
                    ? "w-10 bg-orange-500"
                    : "w-6 bg-[#232325]"
                }`}
              />
            ))}
            <span className="text-xs text-[#4b5563] ml-1 font-bold uppercase tracking-widest">
              {step} / {STEPS.length}
            </span>
          </div>

          {/* ── Step 1: Welcome ── */}
          {step === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h1 className="text-4xl font-sans font-black tracking-tight text-white mb-2">
                  Welcome to OLPDF.
                </h1>
                <p className="text-base text-[#9ca3af] leading-relaxed">
                  A structure-first document editor that reconstructs semantic intent before AI ever sees your content. Edit PDFs like Word documents — free, forever.
                </p>
              </div>

              <ul className="space-y-2.5">
                {[
                  "Semantic block extraction — headings, paragraphs, tables",
                  "AI rewrites that understand document context",
                  "Export to EPUB3, DOCX, and more",
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-[#9ca3af]">
                    <Check className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setStep(2)}
                className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 transition-colors px-4 py-4 font-bold text-base text-white flex items-center justify-center gap-2 group"
              >
                Get started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}

          {/* ── Step 2: Choose mode ── */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h1 className="text-4xl font-sans font-black tracking-tight text-white mb-2">
                  How do you want to work?
                </h1>
                <p className="text-base text-[#9ca3af]">
                  Choose local-first for privacy, or cloud for sync and collaboration.
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={() => { setMode("guest"); setStep(3); }}
                  className={`w-full rounded-xl border p-5 text-left transition-all ${
                    mode === "guest"
                      ? "border-orange-500/60 bg-orange-500/5"
                      : "border-[#232325] hover:border-[#3a3a3e] bg-[#111113]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#1a1a1c] border border-[#2a2a2e] flex items-center justify-center shrink-0 mt-0.5">
                      <HardDrive className="w-4 h-4 text-[#9ca3af]" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base">Guest — local only</p>
                      <p className="text-sm text-[#6b7280] mt-0.5 leading-relaxed">No account needed. Edits stay in your browser. Great for one-off tasks.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={signInWithGoogle}
                  className={`w-full rounded-xl border p-5 text-left transition-all ${
                    mode === "cloud"
                      ? "border-orange-500/60 bg-orange-500/5"
                      : "border-[#232325] hover:border-[#3a3a3e] bg-[#111113]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#1a1a1c] border border-[#2a2a2e] flex items-center justify-center shrink-0 mt-0.5">
                      <Cloud className="w-4 h-4 text-[#9ca3af]" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base">Google — cloud sync</p>
                      <p className="text-sm text-[#6b7280] mt-0.5 leading-relaxed">Sync across devices, collaborate with others, and access your API key.</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Use case ── */}
          {step === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h1 className="text-4xl font-sans font-black tracking-tight text-white mb-2">
                  What will you work on?
                </h1>
                <p className="text-base text-[#9ca3af]">
                  We&apos;ll tailor your first-run experience to your workflow.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {USE_CASES.map(({ key, label, desc, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => { setUseCase(key); setStep(4); complete(); }}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      useCase === key
                        ? "border-orange-500/60 bg-orange-500/5"
                        : "border-[#232325] hover:border-[#3a3a3e] bg-[#111113]"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#1a1a1c] border border-[#2a2a2e] flex items-center justify-center mb-3">
                      <Icon className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="font-bold text-white text-sm">{label}</p>
                    <p className="text-xs text-[#6b7280] mt-0.5 leading-relaxed">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 4: All set ── */}
          {step === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
                  <Check className="w-3.5 h-3.5" />
                  Setup complete
                </div>
                <h1 className="text-4xl font-sans font-black tracking-tight text-white mb-2">
                  You&apos;re all set.
                </h1>
                <p className="text-base text-[#9ca3af] leading-relaxed">
                  Your workspace is ready. Upload a PDF to start editing, or explore the dashboard first.
                </p>
              </div>

              {mode === "guest" && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm px-4 py-3 rounded-xl">
                  <strong className="block mb-0.5">Guest mode active</strong>
                  Edits are local and may be lost if browser data is cleared. You can sign in later to enable cloud save.
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Link
                  href="/dashboard"
                  className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 transition-colors px-4 py-4 font-bold text-base text-white flex items-center justify-center gap-2 group"
                >
                  Open dashboard
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href="/dashboard/upload"
                  className="w-full rounded-xl border border-[#232325] hover:border-[#3a3a3e] bg-[#111113] hover:bg-[#161618] transition-all px-4 py-3.5 font-semibold text-base text-[#d1d5db] flex items-center justify-center gap-2"
                >
                  Upload a PDF now
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-auto text-[11px] text-[#4b5563] text-center">
          © 2025 OLPDF · <Link href="/privacy" className="hover:text-[#9ca3af] transition-colors">Privacy</Link> · <Link href="/terms" className="hover:text-[#9ca3af] transition-colors">Terms</Link>
        </p>
      </div>

      {/* ── Right pane — illustration ─────────────────────────────────── */}
      <div className="hidden lg:flex flex-col relative w-[48%] xl:w-[52%] min-h-screen overflow-hidden bg-[#fdf6ef]">

        <img
          key={currentIllustration}
          src={currentIllustration}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-contain object-center p-10 animate-fadeIn"
        />

        <div className="relative z-10 mt-auto p-10">
          <div className="flex gap-2 mb-4">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`h-1 rounded-full transition-all duration-300 ${
                  s.id === step ? "w-6 bg-orange-500" : "w-3 bg-[#d4c4b4]"
                }`}
              />
            ))}
          </div>
          <p className="text-xl font-sans font-black tracking-tight text-[#1a1a1a] leading-tight max-w-xs">
            {step === 1 && "The PDF editor that actually understands your document."}
            {step === 2 && "Your data, your choice. Local or cloud."}
            {step === 3 && "Built for every kind of document work."}
            {step === 4 && "Welcome to your new document workspace."}
          </p>
          <p className="text-sm text-[#6b6b6b] mt-2 max-w-xs leading-relaxed">
            {step === 1 && "Semantic layout reconstruction. AI-native. Open source."}
            {step === 2 && "No account required to get started — sign in later to unlock collaboration."}
            {step === 3 && "Documents, books, forms, or a full conversion toolkit."}
            {step === 4 && "Upload your first PDF and see the difference semantic editing makes."}
          </p>
        </div>
      </div>

    </div>
  );
}
