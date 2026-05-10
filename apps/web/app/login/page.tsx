"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ArrowRight } from "lucide-react";
import { DEFAULT_BRAND } from "@/lib/branding";

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

        {/* Logo + form — centered together as one block */}
        <div className="flex flex-col flex-1 justify-center max-w-sm w-full mx-auto">

          <div className="flex justify-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5 select-none group">
              <div className="relative h-9 w-9 shrink-0 group-hover:scale-105 transition-transform">
                <Image src={DEFAULT_BRAND.icon192} alt="OLPDF" fill className="object-contain" priority />
              </div>
              <span className="font-sans font-black tracking-tight text-2xl text-white">
                OL<span className="text-orange-500">PDF</span>
              </span>
            </Link>
          </div>
          <h1 className="text-4xl font-sans font-black tracking-tight text-white mb-2">Welcome back.</h1>
          <p className="text-base text-[#9ca3af] mb-8">Log in to your workspace.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#d1d5db] mb-2 uppercase tracking-widest">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-[#232325] bg-[#111113] px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 transition-all text-base font-medium text-white placeholder:text-[#6b7280]"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-[#d1d5db] uppercase tracking-widest">Password</label>
                <Link href="/forgot-password" className="text-sm font-semibold text-orange-500 hover:text-orange-400 transition-colors">Forgot?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#232325] bg-[#111113] px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/60 transition-all text-base font-medium text-white placeholder:text-[#6b7280]"
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
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 transition-colors px-4 py-4 font-bold text-base text-white disabled:opacity-50 flex items-center justify-center gap-2 group mt-2"
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
            className="w-full rounded-xl border border-[#2a2a2e] hover:border-[#3a3a3e] bg-[#111113] hover:bg-[#161618] transition-all px-4 py-3.5 font-semibold text-base flex items-center justify-center gap-3 text-[#d1d5db]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57C21.08 18.45 22.56 15.52 22.56 12.25z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center mt-8 text-base text-[#6b7280]">
            No account? <Link href="/signup" className="text-orange-500 hover:text-orange-400 font-semibold transition-colors">Sign up free</Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-auto text-[11px] text-[#4b5563] text-center">
          © 2025 OLPDF · <Link href="/privacy" className="hover:text-[#9ca3af] transition-colors">Privacy</Link> · <Link href="/terms" className="hover:text-[#9ca3af] transition-colors">Terms</Link>
        </p>
      </div>

      {/* ── Right pane — visual ───────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col relative w-[48%] xl:w-[52%] min-h-screen overflow-hidden bg-[#fdf6ef]">

        {/* Illustration — fills pane */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/auth-illustration.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-contain object-center p-8"
        />

        {/* Bottom tagline */}
        <div className="relative z-10 mt-auto p-10">
          <div className="w-8 h-0.5 bg-orange-500 rounded mb-3" />
          <p
            className="text-xl font-sans font-black tracking-tight leading-tight max-w-xs"
            style={{ WebkitTextStroke: "1.5px #f97316", color: "transparent" }}
          >
            Parse, edit, and export any PDF — without the pain.
          </p>
          <p className="text-sm text-[#3d3d3d] mt-2 max-w-xs leading-relaxed font-semibold">
            Semantic block extraction, AI rewrites, EPUB3 export. Open and free.
          </p>
        </div>
      </div>

    </div>
  );
}
