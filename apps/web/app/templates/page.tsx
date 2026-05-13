"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { 
  MagnifyingGlassIcon,
  Squares2X2Icon,
  BriefcaseIcon,
  AcademicCapIcon,
  ScaleIcon,
  BookOpenIcon,
  UserIcon,
  GlobeAltIcon,
  ArrowRightIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { Spinner, EmptyState } from "@olpdf/ui";
import { useTemplatesStore } from "@/store/useTemplatesStore";
import { PageShell } from "@/components/layout/PageShell";
import { InlineSpinner } from "@/components/ui/MicroUI";
import { GlassCard } from "@/components/ui/Glass";

type Template = {
  id: string;
  title: string;
  category: string;
  author: string;
  uses_count: number;
  thumbnail_url?: string;
  description?: string;
};

const categoryMap = [
  { name: "All", icon: Squares2X2Icon },
  { name: "Business", icon: BriefcaseIcon },
  { name: "Academic", icon: AcademicCapIcon },
  { name: "Legal", icon: ScaleIcon },
  { name: "Books", icon: BookOpenIcon },
  { name: "Personal", icon: UserIcon },
  { name: "Community", icon: GlobeAltIcon },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const { activeCategory, searchQuery, applyingId, setActiveCategory, setSearchQuery, setApplyingId } = useTemplatesStore();

  useEffect(() => {
    if (!searchQuery) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const t = setTimeout(() => setIsSearching(false), 450);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const query = useQuery<Template[]>({
    queryKey: ["templates-library"],
    queryFn: async () => {
      const response = await fetch("/api/bff/templates");
      if (!response.ok) throw new Error("API error");
      return response.json();
    },
  });

  const filtered = useMemo(() => {
    if (!query.data) return [];
    let result = query.data;
    
    if (activeCategory !== "All") {
      result = result.filter((t) => t.category === activeCategory);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.author.toLowerCase().includes(q));
    }
    
    return result;
  }, [activeCategory, searchQuery, query.data]);

  const [deployLabel, setDeployLabel] = useState("");
  const applyTemplate = async (templateId: string) => {
    setApplyingId(templateId);
    setDeployError(null);
    setDeployLabel("Creating document…");
    await new Promise((r) => setTimeout(r, 200));
    try {
      const response = await fetch(`/api/bff/templates/${templateId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || `Server error ${response.status}`);
      }

      setDeployLabel("Applying content…");
      await new Promise((r) => setTimeout(r, 300));

      const targetDocumentId = data.document_id;

      setDeployLabel("Opening editor…");
      await new Promise((r) => setTimeout(r, 200));

      if (targetDocumentId) {
        router.push(`/editor/${targetDocumentId}`);
      } else {
        throw new Error("API did not return a document ID");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Template deploy failed";
      setDeployError(msg);
      setTimeout(() => setDeployError(null), 6000);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <PageShell
      title="Template Library"
      actions={
        <div className="relative w-72 group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {isSearching ? (
              <InlineSpinner className="w-4 h-4 text-[var(--accent)]" />
            ) : (
              <MagnifyingGlassIcon className="h-4 w-4 text-[var(--text-tertiary)] group-focus-within:text-[var(--accent)]" />
            )}
          </div>
          <input
            type="text"
            placeholder="Search blueprints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-subtle)]"
          />
        </div>
      }
    >
      <section className="space-y-6">
        <p className="text-sm text-[var(--text-secondary)]">Jumpstart document modeling with structural blueprints.</p>

        {deployError && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
            <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
            <span><span className="font-semibold">Deploy failed:</span> {deployError}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {categoryMap.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                activeCategory === cat.name
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--text-on-accent)]"
                  : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
              }`}
            >
              <cat.icon className="h-3.5 w-3.5" />
              {cat.name}
            </button>
          ))}
        </div>

        {query.isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-[var(--text-secondary)]">
            <Spinner size="md" />
            <p className="text-[11px] uppercase tracking-widest">Synchronizing registry...</p>
          </div>
        )}

        {query.isError && (
          <EmptyState
            icon={<ExclamationCircleIcon className="h-14 w-14 text-red-500/70" />}
            title="Registry sync failed"
            description="We are having trouble loading templates. Check your connection and retry."
            action={
              <button
                onClick={() => query.refetch()}
                className="mt-4 rounded-md border border-[var(--border-strong)] px-4 py-2 text-xs font-semibold hover:bg-[var(--bg-elevated)]"
              >
                Retry
              </button>
            }
          />
        )}

        {!query.isLoading && !query.isError && filtered.length === 0 && (
          <EmptyState
            icon={<Squares2X2Icon className="h-14 w-14 text-[var(--text-tertiary)]" />}
            title="No templates found"
            description={searchQuery ? `No templates match "${searchQuery}" in ${activeCategory}.` : "No templates are available in this category yet."}
            action={
              <button
                onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
                className="mt-4 rounded-md border border-[var(--border-strong)] px-4 py-2 text-xs font-semibold hover:bg-[var(--bg-elevated)]"
              >
                Reset filters
              </button>
            }
          />
        )}

        {!query.isLoading && !query.isError && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((template) => {
              const CategoryIcon = categoryMap.find((c) => c.name === template.category)?.icon || Squares2X2Icon;
              return (
                <GlassCard
                  key={template.id}
                  className="p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.05] bg-white/[0.05]">
                      <CategoryIcon className="h-4 w-4 text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                    </div>
                    <span className="rounded border border-white/[0.05] bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] backdrop-blur-md">
                      {template.category}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h2 className="mb-1 truncate text-sm font-semibold text-[var(--text-primary)]">{template.title}</h2>
                    <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {template.description || "A professional-grade structural blueprint for scalable document production."}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)]">Author</p>
                      <p className="max-w-[120px] truncate text-xs font-medium text-[var(--text-primary)]">{template.author}</p>
                    </div>
                    <button
                      onClick={() => applyTemplate(template.id)}
                      disabled={applyingId === template.id}
                      className="flex items-center gap-1 rounded-md border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] transition-all hover:bg-orange-500/20 active:scale-[0.98] disabled:opacity-50"
                    >
                      {applyingId === template.id ? (
                        <>
                          <InlineSpinner className="w-3 h-3 text-[var(--accent)]" /> {deployLabel || "Initializing..."}
                        </>
                      ) : (
                        <>
                          Deploy <ArrowRightIcon className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
