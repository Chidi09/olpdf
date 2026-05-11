"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  FileText,
  Upload,
  Search,
  MoreVertical,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DocumentTextIcon,
  BookOpenIcon,
  Squares2X2Icon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useDashboardStore } from "@/store/useDashboardStore";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@olpdf/ui";
import { PageShell } from "@/components/layout/PageShell";
import UploadProgressModal from "@/components/UploadProgressModal";

type Project = {
  id: string;
  title: string;
  type: "Document" | "Book";
  updated_at: string;
  pages?: number;
};

export default function Dashboard() {
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
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold tracking-tight">Dashboard</span>
          <div className="h-5 w-px bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
            {(["recent", "documents", "books"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-all ${
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
      }
      actions={
        <>
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search projects"
              className="h-8 w-64 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-subtle)]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={onImportClick} className="h-8 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--text-on-accent)]">
            <Upload className="h-3.5 w-3.5" /> Import PDF
          </Button>
          <Link
            href="/editor/new"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </Link>
        </>
      }
    >
      <div className="space-y-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/editor/new" className="group flex h-28 flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--bg-elevated)]">
            <DocumentTextIcon className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)]" />
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Blank Document</h3>
              <p className="text-xs text-[var(--text-secondary)]">Start from scratch</p>
            </div>
          </Link>

          <Link href="/books/new" className="group flex h-28 flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--bg-elevated)]">
            <BookOpenIcon className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)]" />
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">New Book</h3>
              <p className="text-xs text-[var(--text-secondary)]">Compile chapters</p>
            </div>
          </Link>

          <Link href="/templates" className="group flex h-28 flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--bg-elevated)]">
            <Squares2X2Icon className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)]" />
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Use Template</h3>
              <p className="text-xs text-[var(--text-secondary)]">Structural defaults</p>
            </div>
          </Link>

          <Link href="/toolkit" className="group flex h-28 flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--bg-elevated)]">
            <WrenchScrewdriverIcon className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)]" />
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">PDF Toolkit</h3>
              <p className="text-xs text-[var(--text-secondary)]">Merge, split, redact</p>
            </div>
          </Link>
        </div>

        <div className="space-y-6">
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            {activeTab === "recent" ? "Recent Projects" : activeTab === "documents" ? "All Documents" : "All Books"}
          </h2>

          {isLoading ? (
            <div className="flex h-28 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <Spinner />
            </div>
          ) : displayProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-secondary)]">
              No projects found.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              {displayProjects.map((project, index) => {
                const href = project.type === "Document" ? `/editor/${project.id}` : `/books/${project.id}`;
                const Icon = project.type === "Document" ? FileText : BookOpen;
                const updated = new Date(project.updated_at).toLocaleDateString();
                return (
                  <Link
                    key={project.id}
                    href={href}
                    className={`group flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--bg-elevated)] ${
                      index < displayProjects.length - 1 ? "border-b border-[var(--border-subtle)]" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
                        <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)]">{project.title}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{project.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                      <span>{updated}</span>
                      <button type="button" className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {(documentsQuery.isError || booksQuery.isError) && (
            <div className="flex items-start gap-2 rounded-md border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 p-3 text-xs text-[var(--text-primary)]">
              <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--status-error)]" />
              <span>Could not load all projects. Refresh to try again.</span>
            </div>
          )}
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
