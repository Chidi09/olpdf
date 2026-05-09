"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { DEFAULT_BRAND } from "@/lib/branding";
import { ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) { setError(signInError.message); return; }
    router.replace(redirectTo);
  };

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}` },
    });
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0c]">

      {/* ── Left pane — form ─────────────────────────────────────────── */}
      <div className="relative flex flex-col w-full lg:w-[52%] xl:w-[48%] min-h-screen px-8 sm:px-14 py-10">

        {/* Logo */}
        <div className="mb-auto flex justify-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-10 w-10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <Image src={DEFAULT_BRAND.icon192} alt="OLPDF Logo" fill className="object-contain" priority />
            </div>
            <span className="text-xl font-extrabold tracking-tighter text-white">OLPDF</span>
          </Link>
        </div>

        {/* Form container — vertically centred */}
        <div className="flex flex-col justify-center flex-1 py-12 max-w-sm w-full mx-auto">
          <h1 className="text-3xl font-serif italic font-bold text-white mb-1">Welcome back.</h1>
          <p className="text-sm text-[#9ca3af] mb-8">Log in to your workspace.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#d1d5db] mb-1.5 uppercase tracking-widest">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-[#232325] bg-[#111113] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 transition-all text-sm font-medium text-white placeholder:text-[#6b7280]"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-[#d1d5db] uppercase tracking-widest">Password</label>
                <Link href="/forgot-password" className="text-xs font-semibold text-orange-500 hover:text-orange-400 transition-colors">Forgot?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#232325] bg-[#111113] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 transition-all text-sm font-medium text-white placeholder:text-[#6b7280]"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{error}</span>
              </div>
            )}

            <button
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 transition-colors px-4 py-3.5 font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2 group mt-2"
            >
              {loading ? "Logging in…" : "Log in"}
              {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5 before:h-px before:flex-1 before:bg-[#232325] after:h-px after:flex-1 after:bg-[#232325]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">Or</span>
          </div>

          <button
            onClick={signInWithGoogle}
            className="w-full rounded-xl border border-[#2a2a2e] hover:border-[#3a3a3e] bg-[#111113] hover:bg-[#161618] transition-all px-4 py-3 font-semibold text-sm flex items-center justify-center gap-3 text-[#d1d5db]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57C21.08 18.45 22.56 15.52 22.56 12.25z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center mt-8 text-sm text-[#6b7280]">
            No account? <Link href="/signup" className="text-orange-500 hover:text-orange-400 font-semibold transition-colors">Sign up free</Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-auto text-[11px] text-[#4b5563] text-center">
          © 2025 OLPDF · <Link href="/privacy" className="hover:text-[#9ca3af] transition-colors">Privacy</Link> · <Link href="/terms" className="hover:text-[#9ca3af] transition-colors">Terms</Link>
        </p>
      </div>

      {/* ── Right pane — visual ───────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col relative w-[48%] xl:w-[52%] min-h-screen overflow-hidden">

        {/* Background photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Dark + orange gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0c]/90 via-[#0a0a0c]/70 to-orange-950/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c]/95 via-transparent to-transparent" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-12 xl:p-16">

          {/* Floating stat cards */}
          <div className="flex-1 flex flex-col justify-center gap-4">

            <div className="self-start bg-[#0f0f11]/80 border border-[#2a2a2e] backdrop-blur-sm rounded-2xl px-5 py-4 max-w-[220px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] mb-1">Parse speed</p>
              <p className="text-2xl font-black text-white">&lt;200ms</p>
              <p className="text-xs text-orange-400 font-semibold mt-0.5">avg per page</p>
            </div>

            <div className="self-end bg-[#0f0f11]/80 border border-[#2a2a2e] backdrop-blur-sm rounded-2xl px-5 py-4 max-w-[240px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] mb-1">Extraction accuracy</p>
              <p className="text-2xl font-black text-white">98.4%</p>
              <p className="text-xs text-orange-400 font-semibold mt-0.5">semantic block detection</p>
            </div>

            {/* Central illustration — PDF document */}
            <div className="relative self-center my-4">
              <div className="w-44 h-56 rounded-2xl border border-[#2a2a2e] bg-[#111113]/90 shadow-2xl p-4 flex flex-col gap-2.5">
                {/* PDF header */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-[#e21818] flex items-center justify-center">
                    <span className="text-white text-[9px] font-black">PDF</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 w-16 rounded bg-[#2a2a2e]" />
                    <div className="h-1 w-10 rounded bg-[#1e1e21] mt-1" />
                  </div>
                </div>
                {/* Fake text lines */}
                {[100, 80, 90, 70, 85, 60, 75].map((w, i) => (
                  <div key={i} className="h-1.5 rounded-full bg-[#1e1e21]" style={{ width: `${w}%` }} />
                ))}
                {/* Orange highlight */}
                <div className="mt-1 h-5 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center px-2 gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  <div className="h-1 w-12 rounded bg-orange-400/40" />
                </div>
                <div className="h-1.5 rounded-full bg-[#1e1e21] w-4/5" />
                <div className="h-1.5 rounded-full bg-[#1e1e21] w-3/5" />
              </div>
              {/* Glow under doc */}
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-28 h-6 bg-orange-500/30 blur-xl rounded-full" />
            </div>

            <div className="self-start bg-[#0f0f11]/80 border border-[#2a2a2e] backdrop-blur-sm rounded-2xl px-5 py-4 max-w-[220px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] mb-1">API-first</p>
              <p className="text-2xl font-black text-white">REST</p>
              <p className="text-xs text-orange-400 font-semibold mt-0.5">free beta key included</p>
            </div>

          </div>

          {/* Bottom tagline */}
          <div className="mt-auto">
            <div className="w-8 h-0.5 bg-orange-500 rounded mb-4" />
            <p className="text-xl font-black text-white leading-tight max-w-xs">
              Parse, edit, and export any PDF — without the pain.
            </p>
            <p className="text-sm text-[#9ca3af] mt-2 max-w-xs leading-relaxed">
              Semantic block extraction, AI rewrites, EPUB3 export. Open and free.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
