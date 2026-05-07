"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ArrowRight, Sparkles } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    
    // In a real implementation you might want to sign up and update user meta data
    const { error: signUpError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          full_name: name,
        }
      }
    });
    
    setLoading(false);
    
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    
    // Redirect or show success message
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
    <main className="relative flex min-h-[calc(100vh-56px)] w-full items-center justify-center p-6 overflow-hidden bg-[var(--bg-base)]">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-gradient-to-tr from-[#2b579a]/10 via-[#e21818]/5 to-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Background paper texture (SVG noise) */}
      <div 
          className="absolute inset-0 opacity-[0.015] pointer-events-none z-0" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />

      <div className="w-full max-w-md relative z-10">
        
        {/* Sparkles Decoration */}
        <div className="absolute -top-6 -left-6 transform -rotate-12 pointer-events-none">
            <span className="text-orange-400 animate-[pulse_2s_ease-in-out_infinite] opacity-100 absolute"><Sparkles className="h-6 w-6" /></span>
            <span className="text-orange-500 animate-[pulse_3s_ease-in-out_infinite] opacity-70 absolute top-4 left-5"><Sparkles className="h-4 w-4" /></span>
        </div>

        <form onSubmit={onSubmit} className="w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl p-8 sm:p-10 relative overflow-hidden group/form">

          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 via-[#e21818] to-[#2b579a]"></div>

          <div className="mb-10">
            {/* Logo */}
            <div className="inline-flex items-baseline mb-6">
              <span className="font-sans font-black tracking-tighter text-orange-500 text-2xl">O</span>
              <span className="font-serif italic font-light text-[var(--text-primary)] -ml-1 transform -rotate-3 translate-y-0.5 mr-1 text-2xl">L</span>
              <span className="bg-[#e21818] text-white px-2 py-0.5 rounded-lg border border-[#b31212] inline-flex items-baseline relative transform rotate-1">
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-lg pointer-events-none"></div>
                <span className="font-mono font-bold tracking-tight opacity-90 relative z-10 text-lg">P</span>
                <span className="font-serif font-black -ml-0.5 relative z-10 text-lg">D</span>
                <span className="font-sans font-thin italic ml-0.5 scale-110 origin-bottom relative z-10 text-lg">F</span>
              </span>
            </div>
            <h1 className="text-4xl font-serif italic font-bold tracking-tight text-[var(--text-primary)] mb-2">
              Create account
            </h1>
            <p className="text-[var(--text-secondary)] font-medium">
              Start editing PDFs like Word documents.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[var(--text-primary)] mb-1.5 font-sans">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="John Doe"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#e21818]/50 focus:border-[#e21818] transition-all font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[var(--text-primary)] mb-1.5 font-sans">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#e21818]/50 focus:border-[#e21818] transition-all font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-[var(--text-primary)] mb-1.5 font-sans">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a strong password"
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#e21818]/50 focus:border-[#e21818] transition-all font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]"
                required
                minLength={8}
              />
            </div>
          </div>

          {error && (
            <div className="mt-6 bg-[#e21818]/10 border border-[#e21818]/20 text-[#e21818] text-sm px-4 py-3 rounded-xl font-medium flex items-start gap-2">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>{error}</span>
            </div>
          )}

          <div className="mt-8 space-y-4">
            <button 
              disabled={loading} 
              className="w-full rounded-xl bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] transition-colors px-4 py-4 font-bold text-[var(--bg-base)] disabled:opacity-50 flex items-center justify-center gap-2 group/btn"
            >
              {loading ? "Creating account..." : "Sign up for free"}
              {!loading && <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />}
            </button>

            <div className="flex items-center gap-4 before:h-px before:flex-1 before:bg-[var(--border-subtle)] after:h-px after:flex-1 after:bg-[var(--border-subtle)]">
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">Or</span>
            </div>

            <button 
              type="button" 
              onClick={signInWithGoogle} 
              className="w-full rounded-xl border-2 border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-transparent hover:bg-[var(--bg-surface)] transition-all px-4 py-3.5 font-bold flex items-center justify-center gap-3 text-[var(--text-primary)]"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.95F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              Continue with Google
            </button>
          </div>
          <p className="text-center mt-6 text-xs font-medium text-[var(--text-secondary)]">
            By signing up, you agree to our <Link href="/terms" className="underline hover:text-[var(--text-primary)]">Terms</Link> and <Link href="/privacy" className="underline hover:text-[var(--text-primary)]">Privacy Policy</Link>.
          </p>
        </form>

        <p className="text-center mt-8 text-sm font-medium text-[var(--text-secondary)]">
          Already have an account? <Link href="/login" className="text-orange-500 hover:text-orange-600 font-bold transition-colors underline decoration-orange-500/30 underline-offset-4 hover:decoration-orange-500">Log in</Link>
        </p>
      </div>
    </main>
  );
}
