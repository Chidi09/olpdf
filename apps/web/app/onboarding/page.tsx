"use client";
import { useState } from "react";
import Link from "next/link";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"guest" | "auth" | null>(null);
  
  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex items-center justify-center py-12 px-6">
      <div className="max-w-2xl w-full p-8 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        {mode === "guest" && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm">
            <strong>Guest mode:</strong> edits remain local and may be lost if browser data is cleared. Cloud save and collaboration are disabled.
          </div>
        )}
        
        {step === 1 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Welcome to OLPDF</h1>
            <p className="text-[var(--text-secondary)]">OLPDF is a structure-first open source document operating system. We reconstruct semantic intent before the AI ever sees it.</p>
            <button onClick={() => setStep(2)} className="bg-[var(--accent)] text-[var(--text-on-accent)] px-6 py-3 rounded-full font-bold">Continue</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">Choose your mode</h1>
            <div className="grid gap-4 sm:grid-cols-2">
              <button onClick={() => { setMode("guest"); setStep(3); }} className="border border-[var(--border-subtle)] hover:border-amber-500 p-6 rounded-xl text-left">
                <h3 className="font-bold text-lg mb-2">Guest Mode</h3>
                <p className="text-sm text-[var(--text-secondary)]">Keep everything local. No account required.</p>
              </button>
              <button onClick={() => { setMode("auth"); setStep(3); }} className="border border-[var(--border-subtle)] hover:border-blue-500 p-6 rounded-xl text-left">
                <h3 className="font-bold text-lg mb-2">Google Sign-in</h3>
                <p className="text-sm text-[var(--text-secondary)]">Enable cloud save and collaboration features.</p>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">What is your primary use case?</h1>
            <div className="grid gap-4 sm:grid-cols-2">
              {['Documents', 'Books', 'Toolkit', 'Forms'].map(useCase => (
                <button key={useCase} onClick={() => setStep(4)} className="border border-[var(--border-subtle)] hover:border-[var(--accent)] p-6 rounded-xl font-bold text-left">
                  {useCase}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold">You&apos;re all set!</h1>
            <p className="text-[var(--text-secondary)]">Let&apos;s start working with documents.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/dashboard" className="bg-[var(--accent)] text-[var(--text-on-accent)] px-6 py-3 rounded-full font-bold">Go to Dashboard</Link>
              <Link href="/templates" className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] px-6 py-3 rounded-full font-bold">Browse Templates</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
