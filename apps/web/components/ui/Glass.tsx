import React from "react";

export function AmbientBackground() {
  return (
    <>
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] z-0 h-[40%] w-[40%] rounded-full bg-orange-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] z-0 h-[30%] w-[30%] rounded-full bg-blue-600/5 blur-[100px]" />
    </>
  );
}

export function GlassCard({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`group relative z-10 flex flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/[0.04] hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] ${className}`}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-500/0 via-transparent to-orange-500/0 transition-all duration-500 group-hover:from-orange-500/5" />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}

export function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`z-10 overflow-hidden rounded-lg border border-white/10 bg-white/[0.015] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}
