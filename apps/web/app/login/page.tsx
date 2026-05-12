"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { InlineSpinner } from "@/components/ui/MicroUI";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const magicToken = searchParams.get("magicToken");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    if (!magicToken) return;
    const run = async () => {
      setLoading(true);
      const res = await fetch("/api/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: magicToken }),
      });
      setLoading(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.detail || "Magic link is invalid or expired");
        return;
      }
      router.replace(redirectTo);
    };
    run();
  }, [magicToken, redirectTo, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.detail || "Something went wrong");
      return;
    }
    router.replace(redirectTo);
  };

  const onMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/magic-link/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: magicEmail, callbackURL: `/login?redirect=${encodeURIComponent(redirectTo)}` }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.detail || "Something went wrong");
      return;
    }
    setMagicSent(true);
  };

  const signInWithGoogle = async () => {
    window.location.href = `/api/auth/oauth/google/start?callbackURL=${encodeURIComponent(redirectTo)}`;
  };

  const signInWithGitHub = async () => {
    window.location.href = `/api/auth/oauth/github/start?callbackURL=${encodeURIComponent(redirectTo)}`;
  };

  return (
    <div className="flex min-h-screen bg-black font-sans text-[#ededed]">
      <div className="relative flex min-h-screen w-full flex-col border-r border-[#222] px-8 py-10 lg:w-[40%]">
        <div className="mb-16">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-wide">
            <div className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-gradient-to-br from-orange-500 to-orange-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)]">
              <span className="text-xs font-black text-white">O</span>
            </div>
            OLPDF
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">Welcome back</h1>
          <p className="mb-8 text-sm text-[#888]">Log in to your workspace.</p>

          <div className="mb-6 flex gap-1 rounded-md border border-[#222] bg-[#0A0A0A] p-1">
            {(["password", "magic"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded py-1.5 text-xs font-medium transition-all ${
                  mode === m ? "bg-[#222] text-white shadow-sm" : "text-[#888] hover:text-[#ededed]"
                }`}
              >
                {m === "password" ? "Password" : "Magic Link"}
              </button>
            ))}
          </div>

          {mode === "password" ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-9 w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 text-sm text-[#ededed] placeholder-[#666] transition-all focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                  required
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#888]">Password</label>
                  <Link href="/forgot-password" className="text-[11px] font-medium text-[#666] transition-colors hover:text-[#ededed]">Forgot password?</Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="........"
                  className="h-9 w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 text-sm text-[#ededed] placeholder-[#666] transition-all focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                  required
                />
              </div>
              {error && <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}

              <button
                disabled={loading}
                className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-semibold text-black transition-all hover:bg-[#e5e5e5] active:scale-[0.98] disabled:opacity-50"
              >
                {loading && <InlineSpinner className="h-4 w-4 text-black" />}
                {loading ? "Authenticating..." : "Log In"}
              </button>
            </form>
          ) : (
            <form onSubmit={onMagicLink} className="space-y-4">
              {magicSent ? (
                <div className="rounded-md border border-[#222] bg-[#0A0A0A] py-6 text-center">
                  <p className="mb-1 text-sm font-medium text-white">Check your email</p>
                  <p className="text-xs text-[#888]">We sent a magic link to <span className="text-white">{magicEmail}</span></p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#888]">Email</label>
                    <input
                      type="email"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="h-9 w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 text-sm text-[#ededed] placeholder-[#666] transition-all focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                      required
                    />
                  </div>
                  {error && <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
                  <button
                    disabled={loading}
                    className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-semibold text-black transition-all hover:bg-[#e5e5e5] active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading && <InlineSpinner className="h-4 w-4 text-black" />}
                    {loading ? "Sending..." : "Send Magic Link"}
                  </button>
                </>
              )}
            </form>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#222]" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#666]">Or continue with</span>
            <div className="h-px flex-1 bg-[#222]" />
          </div>

          <div className="space-y-3">
            <button onClick={signInWithGoogle} className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[#333] bg-[#0A0A0A] text-sm font-medium text-[#ededed] transition-all hover:border-[#444] hover:bg-[#111] active:scale-[0.98]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57C21.08 18.45 22.56 15.52 22.56 12.25z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Google
            </button>
            <button onClick={signInWithGitHub} className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[#333] bg-[#0A0A0A] text-sm font-medium text-[#ededed] transition-all hover:border-[#444] hover:bg-[#111] active:scale-[0.98]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
              GitHub
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-[#666]">
            No account? <Link href="/signup" className="font-medium text-white transition-colors hover:underline">Sign up</Link>
          </p>
        </div>
      </div>

      <div className="relative hidden min-h-screen flex-1 flex-col overflow-hidden bg-[#050505] lg:flex">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-full -translate-x-1/2 rounded-full bg-orange-600/10 blur-[120px]" />
      </div>
    </div>
  );
}
