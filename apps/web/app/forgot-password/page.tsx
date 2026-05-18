"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setMessage("Check your email for a password reset link.");
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-md items-center px-6 py-12">
      <div className="w-full space-y-4 rounded-xl liquid-glass liquid-glass-noise p-6">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm backdrop-blur-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 transition-all"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          {message && <p className="text-sm text-green-500">{message}</p>}
          <button
            disabled={loading}
            className="w-full rounded bg-[var(--accent)] px-3 py-2 font-semibold text-[var(--text-on-accent)] disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <p className="text-sm text-[var(--text-secondary)]">
          Remember your password? <Link href="/login" className="text-[var(--accent)]">Log in</Link>
        </p>
      </div>
    </main>
  );
}
