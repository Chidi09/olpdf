"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, 
  Folder, 
  Star, 
  Settings, 
  Shield, 
  HelpCircle,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AnalyticsPage() {
  const pathname = usePathname();

  const stats = [
    { label: "AI Actions", value: "1,284", change: "+12.5%", trending: "up", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Docs Parsed", value: "42", change: "+4.2%", trending: "up", icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Avg. Accuracy", value: "98.4%", change: "-0.2%", trending: "down", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Time Saved", value: "14h", change: "+2h", trending: "up", icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

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
              <h1 className="text-xl font-bold">Analytics</h1>
           </div>
           <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const report = {
                    generatedAt: new Date().toISOString(),
                    stats,
                  };
                  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `olpdf-analytics-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-full px-4 h-10 font-bold border border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
              >
                Export Report
              </button>
           </div>
        </header>

        <section className="p-8 space-y-8">
           {/* Stats Grid */}
           <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat, i) => (
                <div key={i} className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
                   <div className="flex items-center justify-between mb-4">
                      <div className={`h-10 w-10 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center`}>
                         <stat.icon className="h-5 w-5" />
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-bold ${stat.trending === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
                         {stat.trending === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                         {stat.change}
                      </div>
                   </div>
                   <div className="text-2xl font-black">{stat.value}</div>
                   <div className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mt-1">{stat.label}</div>
                </div>
              ))}
           </div>

           {/* Mock Chart Section */}
           <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border-subtle)] h-[400px] flex flex-col">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="font-bold">Extraction Volume</h3>
                    <div className="flex gap-2">
                       {['7D', '30D', '90D'].map(d => (
                         <button key={d} className={`px-3 py-1 rounded-full text-[10px] font-black border ${d === '30D' ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'}`}>{d}</button>
                       ))}
                    </div>
                 </div>
                 <div className="flex-1 flex items-end gap-2 pb-2">
                    {[40, 65, 45, 90, 55, 75, 50, 85, 60, 95, 40, 70, 55, 80].map((h, i) => (
                      <div key={i} className="flex-1 bg-[var(--accent)]/20 rounded-t-sm relative group cursor-pointer hover:bg-[var(--accent)] transition-all" style={{ height: `${h}%` }}>
                         <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-1 rounded text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            {Math.round(h * 1.5)} docs
                         </div>
                      </div>
                    ))}
                 </div>
                 <div className="flex justify-between mt-4 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-tighter">
                    <span>May 01</span>
                    <span>May 08</span>
                    <span>May 15</span>
                    <span>May 22</span>
                    <span>May 29</span>
                 </div>
              </div>

              <div className="bg-[var(--bg-surface)] p-8 rounded-3xl border border-[var(--border-subtle)] h-[400px] flex flex-col">
                 <h3 className="font-bold mb-8">Accuracy by Model</h3>
                 <div className="space-y-6">
                    <div>
                       <div className="flex justify-between text-xs font-bold mb-2">
                          <span>Gemini 1.5 Pro</span>
                          <span className="text-emerald-500">99.2%</span>
                       </div>
                       <div className="h-2 w-full bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 w-[99.2%]" />
                       </div>
                    </div>
                    <div>
                       <div className="flex justify-between text-xs font-bold mb-2">
                          <span>Gemini 1.5 Flash</span>
                          <span className="text-blue-500">96.5%</span>
                       </div>
                       <div className="h-2 w-full bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 w-[96.5%]" />
                       </div>
                    </div>
                    <div>
                       <div className="flex justify-between text-xs font-bold mb-2">
                          <span>Heuristic Engine</span>
                          <span className="text-amber-500">84.1%</span>
                       </div>
                       <div className="h-2 w-full bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 w-[84.1%]" />
                       </div>
                    </div>
                 </div>
                 
                 <div className="mt-auto p-4 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/20">
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed italic">
                       "Gemini 1.5 Pro continues to lead in semantic reconstruction for complex table structures."
                    </p>
                 </div>
              </div>
           </div>
        </section>
      </main>
    </div>
  );
}
