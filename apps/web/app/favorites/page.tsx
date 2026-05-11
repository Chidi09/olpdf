"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Star,
  Search,
  Upload,
  Folder,
  BarChart3,
  Settings,
  Shield,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FavoritesPage() {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-col fixed h-screen z-20">
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-[var(--text-primary)]">
            OLPDF
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
           <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === '/dashboard' ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}>
              <Folder className="h-5 w-5" /> All Projects
           </Link>
           <Link href="/favorites" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === '/favorites' ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}>
              <Star className="h-5 w-5" /> Favorites
           </Link>
           <Link href="/analytics" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === '/analytics' ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}>
              <BarChart3 className="h-5 w-5" /> Analytics
           </Link>
           <Link href="/settings" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === '/settings' ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'}`}>
              <Settings className="h-5 w-5" /> Settings
           </Link>
        </nav>

        <div className="p-4 border-t border-[var(--border-subtle)] space-y-4">
           <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-2">
                 <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Plan: Free</span>
                 <Shield className="h-3 w-3 text-[var(--accent)]" />
              </div>
              <Link href="/settings" className="block">
                <Button size="sm" className="w-full mt-4 bg-[var(--accent)] text-[var(--text-on-accent)] text-[10px] font-bold uppercase tracking-widest h-8 rounded-lg">Manage Plan</Button>
              </Link>
           </div>
            
           <Link href="/docs" className="flex items-center gap-3 px-3 py-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors text-xs font-medium cursor-pointer">
              <HelpCircle className="h-4 w-4" /> Help & Support
           </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pb-24">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border-subtle)] px-8 py-4 flex items-center justify-between">
           <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold">Favorites</h1>
           </div>
           <div className="flex items-center gap-3">
              <div className="relative hidden md:block">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
                 <input 
                   type="text"
                   placeholder="Search favorites..."
                   className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full pl-10 pr-4 py-2 text-sm w-64 outline-none focus:border-[var(--accent)] transition-all"
                 />
              </div>
              <Link href="/toolkit">
                <Button className="rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] px-4 font-bold shadow-lg h-10 gap-2">
                   <Upload className="h-4 w-4" /> Import PDF
                </Button>
              </Link>
           </div>
        </header>

        <section className="p-8">
           <div className="py-20 flex flex-col items-center text-center">
              <div className="relative mb-8">
                 <div className="absolute inset-0 bg-amber-500/10 blur-3xl rounded-full scale-150" />
                 <Star className="h-24 w-24 text-amber-500/20 relative animate-float" strokeWidth={1} />
              </div>
              <h3 className="text-xl font-bold mb-2">No favorites yet</h3>
              <p className="text-[var(--text-secondary)] max-w-xs mb-8">Mark documents or books as favorites to see them here for quick access.</p>
              <Link href="/dashboard">
                 <Button variant="outline" className="rounded-full px-6 font-bold border-[var(--border-strong)] h-12">Go to Dashboard</Button>
              </Link>
           </div>
        </section>
      </main>
    </div>
  );
}
