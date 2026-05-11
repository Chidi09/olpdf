"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";
import { 
  Folder, 
  Star, 
  BarChart3, 
  Settings, 
  HelpCircle,
  TerminalSquare
} from 'lucide-react';

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
    <div className="flex min-h-screen bg-background text-text-primary transition-colors duration-300">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border-subtle bg-surface flex-col fixed h-screen z-20">
        <div className="h-16 border-b border-border-subtle flex items-center px-6">
          <span className="font-serif font-black text-xl tracking-tight text-accent">OLPDF</span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/dashboard" ? "bg-accent/10 text-accent font-bold" : "text-text-secondary hover:bg-elevated"}`}>
            <Folder className="h-5 w-5" /> All Projects
          </Link>
          <Link href="/favorites" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/favorites" ? "bg-accent/10 text-accent font-bold" : "text-text-secondary hover:bg-elevated"}`}>
            <Star className="h-5 w-5" /> Favorites
          </Link>
          <Link href="/analytics" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/analytics" ? "bg-accent/10 text-accent font-bold" : "text-text-secondary hover:bg-elevated"}`}>
            <BarChart3 className="h-5 w-5" /> Analytics
          </Link>
          <Link href="/settings" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/settings" ? "bg-accent/10 text-accent font-bold" : "text-text-secondary hover:bg-elevated"}`}>
            <Settings className="h-5 w-5" /> Settings
          </Link>
          <Link href="/settings/developer" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/settings/developer" ? "bg-accent/10 text-accent font-bold" : "text-text-secondary hover:bg-elevated"}`}>
            <TerminalSquare className="h-5 w-5" /> Developer
          </Link>
        </nav>

        <div className="p-4 border-t border-border-subtle space-y-4">
          <Link href="/docs" className="flex items-center gap-3 px-3 py-2 text-text-tertiary hover:text-text-secondary transition-colors text-xs font-medium cursor-pointer">
            <HelpCircle className="h-4 w-4" /> Help & Support
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pb-24">
        {(title || actions) && (
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border-subtle px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              {title && <h1 className="text-xl font-bold">{title}</h1>}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </header>
        )}
        
        <section className={cn("p-8", className)}>
          {children}
        </section>
      </main>
    </div>
  );
};
