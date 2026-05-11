"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BarChart3, Folder, Star, Settings, HelpCircle, FileText, BookOpen, CalendarClock } from "lucide-react";

type ApiDoc = { id: string; title?: string; updated_at?: string; created_at?: string; page_count?: number };
type ApiBook = { id: string; title?: string; updated_at?: string; created_at?: string; chapters?: unknown[] };

export default function AnalyticsPage() {
  const pathname = usePathname();

  const documentsQuery = useQuery<ApiDoc[]>({
    queryKey: ["analytics-documents"],
    queryFn: async () => {
      const res = await fetch("/api/bff/documents");
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json() as Promise<ApiDoc[]>;
    },
  });

  const booksQuery = useQuery<ApiBook[]>({
    queryKey: ["analytics-books"],
    queryFn: async () => {
      const res = await fetch("/api/bff/books");
      if (!res.ok) throw new Error("Failed to load books");
      return res.json() as Promise<ApiBook[]>;
    },
  });

  const docs = documentsQuery.data || [];
  const books = booksQuery.data || [];

  const totalPages = docs.reduce((sum, d) => sum + (d.page_count || 0), 0);
  const totalChapters = books.reduce((sum, b) => sum + (b.chapters?.length || 0), 0);
  const recent = [
    ...docs.map((d) => ({
      id: d.id,
      type: "Document",
      title: d.title || "Untitled Document",
      updated_at: d.updated_at || d.created_at || new Date(0).toISOString(),
    })),
    ...books.map((b) => ({
      id: b.id,
      type: "Book",
      title: b.title || "Untitled Book",
      updated_at: b.updated_at || b.created_at || new Date(0).toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <aside className="hidden lg:flex w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-col fixed h-screen z-20">
        <div className="h-16 border-b border-[var(--border-subtle)]" />
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/dashboard" ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}><Folder className="h-5 w-5" /> All Projects</Link>
          <Link href="/favorites" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/favorites" ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}><Star className="h-5 w-5" /> Favorites</Link>
          <Link href="/analytics" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/analytics" ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}><BarChart3 className="h-5 w-5" /> Analytics</Link>
          <Link href="/settings" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/settings" ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}><Settings className="h-5 w-5" /> Settings</Link>
        </nav>
        <div className="p-4 border-t border-[var(--border-subtle)]">
          <Link href="/docs" className="flex items-center gap-3 px-3 py-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors text-xs font-medium cursor-pointer"><HelpCircle className="h-4 w-4" /> Help & Support</Link>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64 pb-24">
        <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border-subtle)] px-8 py-4">
          <h1 className="text-xl font-bold">Analytics</h1>
        </header>

        <section className="p-8 space-y-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Documents" value={String(docs.length)} icon={<FileText className="h-5 w-5 text-blue-500" />} />
            <StatCard label="Books" value={String(books.length)} icon={<BookOpen className="h-5 w-5 text-amber-500" />} />
            <StatCard label="Doc Pages" value={String(totalPages)} icon={<BarChart3 className="h-5 w-5 text-emerald-500" />} />
            <StatCard label="Book Chapters" value={String(totalChapters)} icon={<CalendarClock className="h-5 w-5 text-purple-500" />} />
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
            {documentsQuery.isLoading || booksQuery.isLoading ? (
              <p className="text-sm text-[var(--text-secondary)]">Loading activity...</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {recent.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] px-4 py-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{item.type}</p>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">{new Date(item.updated_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="bg-[var(--bg-elevated)] p-6 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="h-10 w-10 rounded-lg bg-black/10 flex items-center justify-center">{icon}</div>
      </div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}
