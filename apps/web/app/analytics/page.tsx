"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/PageShell";
import {
  DocumentTextIcon,
  BookOpenIcon,
  DocumentDuplicateIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { SkeletonRow } from "@/components/ui/MicroUI";
import { GlassCard, GlassPanel } from "@/components/ui/Glass";

type ApiDoc = { id: string; title?: string; updated_at?: string; created_at?: string; page_count?: number };
type ApiBook = { id: string; title?: string; updated_at?: string; created_at?: string; chapters?: unknown[] };

export default function AnalyticsPage() {
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
    <PageShell>
      <div className="max-w-5xl space-y-8">
        <div className="border-b border-[#222] pb-5">
          <h1 className="text-xl font-semibold tracking-tight text-white">Analytics</h1>
          <p className="mt-1 text-sm text-[#888]">Overview of your workspace usage and activity.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Documents"
            value={String(docs.length)}
            icon={<DocumentTextIcon className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            label="Total Books"
            value={String(books.length)}
            icon={<BookOpenIcon className="h-5 w-5 text-amber-500" />}
          />
          <StatCard
            label="Document Pages"
            value={String(totalPages)}
            icon={<DocumentDuplicateIcon className="h-5 w-5 text-emerald-500" />}
          />
          <StatCard
            label="Book Chapters"
            value={String(totalChapters)}
            icon={<ClockIcon className="h-5 w-5 text-purple-500" />}
          />
        </div>

        <GlassPanel className="mt-8 flex flex-col">
          <div className="border-b border-[#222] bg-[#050505] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
          </div>

          {documentsQuery.isLoading || booksQuery.isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : recent.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#666]">No activity yet.</div>
          ) : (
            <div className="divide-y divide-[#222]">
              {recent.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[#111]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#333] bg-[#1A1A1A]">
                      {item.type === "Document" ? (
                        <DocumentTextIcon className="h-4 w-4 text-[#888]" />
                      ) : (
                        <BookOpenIcon className="h-4 w-4 text-[#888]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#ededed]">{item.title}</p>
                      <p className="text-[11px] text-[#666]">{item.type}</p>
                    </div>
                  </div>
                  <p className="shrink-0 tabular-nums text-xs text-[#666]">
                    {new Date(item.updated_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </PageShell>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <GlassCard className="justify-between p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#888]">{label}</h3>
        {icon}
      </div>
      <div className="text-2xl font-semibold tracking-tight text-[#ededed]">{value}</div>
    </GlassCard>
  );
}
