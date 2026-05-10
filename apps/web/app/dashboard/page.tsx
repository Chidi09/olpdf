"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileEdit,
  LayoutTemplate,
  Wrench,
  Clock,
  FileText,
  AlertCircle,
  ArrowRight,
  Search,
  Filter,
  MoreVertical,
  Upload,
  BarChart3,
  Shield,
  Settings,
  HelpCircle,
  Folder,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@olpdf/ui";

type Project = {
  id: string;
  title: string;
  type: "Document" | "Book";
  updated_at: string;
  pages?: number;
};

export default function Dashboard() {
  const pathname = usePathname();
  const { activeTab, searchQuery, setActiveTab, setSearchQuery } = useDashboardStore();

  const documentsQuery = useQuery<Record<string, unknown>[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/bff/documents");
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const booksQuery = useQuery<Record<string, unknown>[]>({
    queryKey: ["books"],
    queryFn: async () => {
      const res = await fetch("/api/bff/books");
      if (!res.ok) throw new Error("Failed to fetch books");
      return res.json();
    },
  });

  const isLoading = documentsQuery.isLoading || booksQuery.isLoading;

  const projects: Project[] = [
    ...(documentsQuery.data || []).map(d => ({
      id: d.id,
      title: d.title || "Untitled Document",
      type: "Document" as const,
      updated_at: d.updated_at || d.created_at,
      pages: d.page_count || 0
    })),
    ...(booksQuery.data || []).map(b => ({
      id: b.id,
      title: b.title || "Untitled Book",
      type: "Book" as const,
      updated_at: b.updated_at || b.created_at,
      pages: b.chapters?.length || 0
    }))
  ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const filtered = projects.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === "recent") return matchesSearch;
    if (activeTab === "documents") return matchesSearch && p.type === "Document";
    if (activeTab === "books") return matchesSearch && p.type === "Book";
    return matchesSearch;
  });

  const recentLimit = activeTab === "recent" ? 6 : undefined;
  const displayProjects = recentLimit ? filtered.slice(0, recentLimit) : filtered;

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
          <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/dashboard" ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}>
            <Folder className="h-5 w-5" /> All Projects
          </Link>
          <Link href="/favorites" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/favorites" ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}>
            <Star className="h-5 w-5" /> Favorites
          </Link>
          <Link href="/analytics" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/analytics" ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}>
            <BarChart3 className="h-5 w-5" /> Analytics
          </Link>
          <Link href="/settings" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${pathname === "/settings" ? "bg-[var(--accent)]/10 text-[var(--accent)] font-bold" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"}`}>
            <Settings className="h-5 w-5" /> Settings
          </Link>
        </nav>

        <div className="p-4 border-t border-[var(--border-subtle)] space-y-4">
          <div className="bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Plan: Free</span>
              <Shield className="h-3 w-3 text-[var(--accent)]" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[var(--text-secondary)]">AI Actions</span>
                  <span className="text-[var(--text-primary)] font-bold">4 / 10</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-base)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] w-[40%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[var(--text-secondary)]">OCR Imports</span>
                  <span className="text-[var(--text-primary)] font-bold">2 / 5</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-base)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--status-review)] w-[40%]" />
                </div>
              </div>
            </div>
            <Button size="sm" className="w-full mt-4 bg-[var(--accent)] text-[var(--text-on-accent)] text-[10px] font-bold uppercase tracking-widest h-8 rounded-lg">Upgrade to Pro</Button>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors text-xs font-medium cursor-pointer">
            <HelpCircle className="h-4 w-4" /> Help & Support
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pb-24">
        <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border-subtle)] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">Dashboard</h1>
            <div className="h-6 w-px bg-[var(--border-subtle)]" />
            <div className="flex items-center gap-1">
              {(["recent", "documents", "books"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize transition-all ${
                    activeTab === tab
                      ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search documents..."
                className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full pl-10 pr-4 py-2 text-sm w-64 outline-none focus:border-[var(--accent)] transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="rounded-full h-10 w-10 p-0 border-[var(--border-strong)]"><Filter className="h-4 w-4" /></Button>
            <Button className="rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] px-4 font-bold shadow-lg hover:shadow-xl transition-all h-10 gap-2">
              <Upload className="h-4 w-4" /> Import PDF
            </Button>
          </div>
        </header>

        <section className="p-8 space-y-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/editor/new" className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:-translate-y-1 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div className="mb-6 h-12 w-12 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/20">
                <FileEdit className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold mb-2 group-hover:text-blue-500 transition-colors">Blank Document</h3>
              <p className="text-sm text-[var(--text-secondary)]">Start from scratch with the structural AI editor.</p>
            </Link>

            <Link href="/books/new" className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition-all duration-300 hover:border-amber-500/50 hover:shadow-lg hover:-translate-y-1 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div className="mb-6 h-12 w-12 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center border border-amber-500/20">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold mb-2 group-hover:text-amber-500 transition-colors">New Book</h3>
              <p className="text-sm text-[var(--text-secondary)]">Compile multiple chapters with consistency checks.</p>
            </Link>

            <Link href="/templates" className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-lg hover:-translate-y-1 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div className="mb-6 h-12 w-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <LayoutTemplate className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold mb-2 group-hover:text-emerald-500 transition-colors">From Template</h3>
              <p className="text-sm text-[var(--text-secondary)]">Browse the library of structural defaults.</p>
            </Link>

            <Link href="/toolkit" className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:-translate-y-1 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
              <div className="mb-6 h-12 w-12 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center border border-purple-500/20">
                <Wrench className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold mb-2 group-hover:text-purple-500 transition-colors">PDF Toolkit</h3>
              <p className="text-sm text-[var(--text-secondary)]">Merge, split, compress, or redact existing PDFs.</p>
            </Link>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-[var(--text-tertiary)]" />
              {activeTab === "recent" ? "Recent Projects" : activeTab === "documents" ? "All Documents" : "All Books"}
            </h2>

            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Spinner size="lg" />
                <p className="text-sm font-bold text-[var(--text-tertiary)] animate-pulse uppercase tracking-widest">Loading Projects...</p>
              </div>
            ) : displayProjects.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {displayProjects.map((item) => (
                  <div key={item.id} className="group relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all hover:border-[var(--accent)]/50 hover:shadow-md">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${
                        item.type === "Document" 
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/20" 
                          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      } shadow-sm group-hover:scale-110 transition-transform`}>
                        {item.type === "Document" ? <FileText className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
                      </div>
                      <button className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                        <MoreVertical className="h-5 w-5" />
                      </button>
                    </div>
                    <Link href={item.type === "Document" ? `/editor/${item.id}` : `/books/${item.id}`} className="block">
                      <h4 className="font-bold text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent)] transition-colors truncate">{item.title}</h4>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                        <span>{item.type}</span>
                        <span>•</span>
                        <span>{item.pages || 0} Pages</span>
                        <span>•</span>
                        <span>{new Date(item.updated_at).toLocaleDateString()}</span>
                      </div>
                    </Link>
                    <div className="mt-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-[var(--bg-surface)]" />
                        <div className="w-6 h-6 rounded-full bg-amber-500 border-2 border-[var(--bg-surface)]" />
                      </div>
                      <Link href={item.type === "Document" ? `/editor/${item.id}` : `/books/${item.id}`} className="text-xs font-bold text-[var(--accent)] flex items-center gap-1 hover:underline">
                        Open {item.type === "Document" ? "Editor" : "Book"} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-[var(--accent)]/10 blur-3xl rounded-full scale-150" />
                  <svg width="200" height="200" viewBox="0 0 200 200" fill="none" className="relative">
                    <rect x="50" y="40" width="100" height="130" rx="8" fill="var(--bg-elevated)" stroke="var(--border-strong)" strokeWidth="2" />
                    <path d="M70 70H130M70 90H130M70 110H100" stroke="var(--border-subtle)" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="150" cy="50" r="20" fill="var(--accent)" fillOpacity="0.2" />
                    <path d="M150 40V60M140 50H160" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-2">No projects found</h3>
                <p className="text-[var(--text-secondary)] max-w-xs mb-8">Start by creating a new blank document or import an existing PDF file.</p>
                <div className="flex gap-4">
                  <Button className="rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] px-6 font-bold shadow-lg h-12">New Document</Button>
                  <Button variant="outline" className="rounded-full px-6 font-bold border-[var(--border-strong)] h-12">Import PDF</Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 flex gap-4 items-start shadow-sm">
            <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-amber-600 font-bold text-base mb-1">Development Mode Active</h3>
              <p className="text-sm text-amber-700/80 leading-relaxed font-medium">
                All data is currently being served from local memory mocks or a test Supabase instance.
                To enable production BFF mocks and persistent storage, set <code className="bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-800 font-mono">OLPDF_DEV_MODE=true</code> in your environment.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
