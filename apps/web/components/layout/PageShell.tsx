"use client";

import React from 'react';
import { cn } from "@olpdf/ui";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({ 
  children, 
  className, 
  title, 
  actions 
}) => {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <main className="pb-24">
        {(title || actions) && (
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-black/40 px-6 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              {title && <h1 className="text-sm font-semibold tracking-tight">{title}</h1>}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </header>
        )}
        
        <section className={cn("p-6 lg:p-8", className)}>
          {children}
        </section>
      </main>
    </div>
  );
};
