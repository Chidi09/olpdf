"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const errorParam = searchParams.get("error");
  const [error, setError] = useState<string | null>(errorParam);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace(redirectTo);
  };

  const signInWithGoogle = async () => {
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { 
        redirectTo: `${origin}/auth/callback?next=${redirectTo}` 
      },
    });
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-md items-center px-6 py-12">
      <form onSubmit={onSubmit} className="w-full space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <h1 className="text-2xl font-bold">Log in</h1>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="w-full rounded border border-[var(--border-subtle)] bg-transparent px-3 py-2"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full rounded border border-[var(--border-subtle)] bg-transparent px-3 py-2"
          required
        />
        <div className="flex justify-end">
          <Link href="/forgot-password" title="forgot-password" className="text-sm text-[var(--accent)]">Forgot password?</Link>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={loading} className="w-full rounded bg-[var(--accent)] px-3 py-2 font-semibold text-[var(--text-on-accent)] disabled:opacity-50">
          {loading ? "Logging in..." : "Log in"}
        </button>
        <button type="button" onClick={signInWithGoogle} className="w-full rounded border border-[var(--border-subtle)] px-3 py-2 font-semibold">
          Continue with Google
        </button>
        <p className="text-sm text-[var(--text-secondary)]">
          No account? <Link href="/signup" className="text-[var(--accent)]">Sign up</Link>
        </p>
      </form>
    </main>
  );
}
