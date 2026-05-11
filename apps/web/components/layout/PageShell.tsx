"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from "@olpdf/ui";
import { 
  FolderIcon,
  StarIcon,
  ChartBarIcon,
  Cog8ToothIcon,
  QuestionMarkCircleIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';

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
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      {/* Sidebar */}
      <aside className="fixed z-20 hidden h-screen w-60 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-panel)] lg:flex">
        <div className="flex h-14 items-center border-b border-[var(--border-subtle)] px-5">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Workspace</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <Link href="/dashboard" className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${pathname === "/dashboard" ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"}`}>
            <FolderIcon className="h-4 w-4" /> All Projects
          </Link>
          <Link href="/favorites" className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${pathname === "/favorites" ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"}`}>
            <StarIcon className="h-4 w-4" /> Favorites
          </Link>
          <Link href="/analytics" className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${pathname === "/analytics" ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"}`}>
            <ChartBarIcon className="h-4 w-4" /> Analytics
          </Link>
          <Link href="/settings" className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${pathname === "/settings" ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"}`}>
            <Cog8ToothIcon className="h-4 w-4" /> Settings
          </Link>
          <Link href="/settings/developer" className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${pathname === "/settings/developer" ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"}`}>
            <CommandLineIcon className="h-4 w-4" /> Developer
          </Link>
        </nav>

        <div className="space-y-2 border-t border-[var(--border-subtle)] p-3">
          <Link href="/docs" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
            <QuestionMarkCircleIcon className="h-4 w-4" /> Help & Support
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pb-24 lg:ml-60">
        {(title || actions) && (
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/90 px-6 py-3 backdrop-blur-md">
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
