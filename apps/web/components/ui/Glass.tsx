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
      className={`group relative z-10 flex flex-col rounded-xl liquid-glass liquid-glass-noise transition-all duration-300 hover:scale-[1.01] hover:shadow-float ${className}`}
      {...props}
    >
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}

export function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`z-10 overflow-hidden rounded-xl liquid-glass liquid-glass-noise ${className}`}>
      {children}
    </div>
  );
}
