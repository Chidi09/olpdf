"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
  Settings,
  HelpCircle,
  Folder,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@olpdf/ui";
import UploadProgressModal from "@/components/UploadProgressModal";

type Project = {
  id: string;
  title: string;
  type: "Document" | "Book";
  updated_at: string;
  pages?: number;
};

export default function Dashboard() {
  const pathname = usePathname();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { activeTab, searchQuery, setActiveTab, setSearchQuery } = useDashboardStore();

  type ApiDoc  = { id: string; title?: string; updated_at?: string; created_at?: string; page_count?: number };
  type ApiBook = { id: string; title?: string; updated_at?: string; created_at?: string; chapters?: unknown[] };

  const documentsQuery = useQuery<ApiDoc[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/bff/documents");
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json() as Promise<ApiDoc[]>;
    },
  });

  const booksQuery = useQuery<ApiBook[]>({
    queryKey: ["books"],
    queryFn: async () => {
      const res = await fetch("/api/bff/books");
      if (!res.ok) throw new Error("Failed to fetch books");
      return res.json() as Promise<ApiBook[]>;
    },
  });

  const isLoading = documentsQuery.isLoading || booksQuery.isLoading;

  const projects: Project[] = [
    ...(documentsQuery.data || []).map(d => ({
      id: d.id,
      title: d.title ?? "Untitled Document",
      type: "Document" as const,
      updated_at: d.updated_at ?? d.created_at ?? new Date(0).toISOString(),
      pages: d.page_count ?? 0
    })),
    ...(booksQuery.data || []).map(b => ({
      id: b.id,
      title: b.title ?? "Untitled Book",
      type: "Book" as const,
      updated_at: b.updated_at ?? b.created_at ?? new Date(0).toISOString(),
      pages: b.chapters?.length ?? 0
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

  const onImportClick = () => fileInputRef.current?.click();

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
    setUploadOpen(true);
    setUploadError(null);
    setUploadStatus("creating document");
    setUploadProgress(10);
    const createRes = await fetch("/api/bff/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: file.name.replace(/\.pdf$/i, "") || "Imported PDF" }),
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !created?.id) {
      setUploadError("Failed to create document");
      setUploadStatus("failed");
      return;
    }
    setUploadStatus("reading file");
    setUploadProgress(30);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("failed_to_read_file"));
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const encoded = dataUrl.split(",")[1] || "";
        resolve(encoded);
      };
      reader.readAsDataURL(file);
    });
    await fetch("/api/bff/import/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: created.id, fileBytes: base64, layout_mode: "fidelity" }),
    }).catch(() => null);
    setUploadStatus("processing");
    setUploadProgress(45);

    const poll = async () => {
      for (let i = 0; i < 45; i += 1) {
        const res = await fetch(`/api/bff/import/${created.id}/status`).catch(() => null);
        const body = await res?.json().catch(() => ({} as Record<string, unknown>));
        const p = typeof body?.import_progress === "number" ? body.import_progress : null;
        const s = typeof body?.status === "string" ? body.status : "processing";
        setUploadStatus(s);
        if (p !== null) setUploadProgress(Math.max(45, Math.min(98, p)));
        if (s === "ready" || s === "completed" || s === "success") {
          setUploadProgress(100);
          break;
        }
        if (s === "failed" || s === "error") {
          setUploadError(String(body?.error || "Import failed"));
          break;
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      router.push(`/editor/${created.id}`);
    };
    void poll();
  };

  return (
    <PageShell 
      title={
        <div className="flex items-center gap-6">
          <span>Dashboard</span>
          <div className="h-6 w-px bg-border-subtle" />
          <div className="flex items-center gap-1">
            {(["recent", "documents", "books"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold capitalize transition-all ${
                  activeTab === tab
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      }
      actions={
        <>
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search documents..."
              className="bg-surface border border-border-subtle rounded-full pl-10 pr-4 py-2 text-sm w-64 outline-none focus:border-accent transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setActiveTab("documents")} className="rounded-full h-10 w-10 p-0 border-border-strong"><Filter className="h-4 w-4" /></Button>
          <Button onClick={onImportClick} className="rounded-full bg-accent text-white px-4 font-bold shadow-lg hover:shadow-xl transition-all h-10 gap-2">
            <Upload className="h-4 w-4" /> Import PDF
          </Button>
        </>
      }
    >
      <div className="space-y-12">
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
          {/* ... (Projects Listing) */}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => void onFileSelected(e.target.files?.[0] || null)}
      />
      <UploadProgressModal
        open={uploadOpen}
        status={uploadStatus}
        progress={uploadProgress}
        error={uploadError}
        onClose={() => setUploadOpen(false)}
      />
    </PageShell>
  );
}
