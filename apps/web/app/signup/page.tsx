"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signUpError, data } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    setLoading(false);
    
    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user && data.session) {
      // User is already logged in (verification likely disabled in Supabase)
      router.replace("/dashboard");
    } else {
      // User needs to verify email
      setSuccess(true);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-md items-center px-6 py-12">
      <div className="w-full space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <h1 className="text-2xl font-bold">Create account</h1>
        {success ? (
          <div className="space-y-4">
            <p className="text-green-500 font-semibold">Account created!</p>
            <p className="text-sm text-[var(--text-secondary)]">
              We've sent a verification email to <strong>{email}</strong>. Please check your inbox and click the link to continue.
            </p>
            <Link href="/login" className="block w-full text-center rounded border border-[var(--border-subtle)] px-3 py-2 font-semibold">
              Return to login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
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
              minLength={8}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button disabled={loading} className="w-full rounded bg-[var(--accent)] px-3 py-2 font-semibold text-[var(--text-on-accent)] disabled:opacity-50">
              {loading ? "Creating account..." : "Sign up"}
            </button>
            <p className="text-sm text-[var(--text-secondary)] text-center">
              Already have an account? <Link href="/login" className="text-[var(--accent)]">Log in</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
