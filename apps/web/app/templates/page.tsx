"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  LayoutTemplate, 
  Star, 
  Users, 
  Briefcase, 
  GraduationCap, 
  Scale, 
  Book, 
  User, 
  Globe,
  Sparkles,
  ArrowRight,
  AlertCircle
} from "lucide-react";
import { Spinner, EmptyState } from "@olpdf/ui";
import BackLink from "@/components/BackLink";
import { useTemplatesStore } from "@/store/useTemplatesStore";

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
  { name: "All", icon: LayoutTemplate },
  { name: "Business", icon: Briefcase },
  { name: "Academic", icon: GraduationCap },
  { name: "Legal", icon: Scale },
  { name: "Books", icon: Book },
  { name: "Personal", icon: User },
  { name: "Community", icon: Globe },
];

export default function TemplatesPage() {
  const router = useRouter();
  const { activeCategory, searchQuery, applyingId, setActiveCategory, setSearchQuery, setApplyingId } = useTemplatesStore();

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

  const applyTemplate = async (templateId: string) => {
    setApplyingId(templateId);
    try {
      const response = await fetch(`/api/bff/templates/${templateId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error("Failed to apply template");
      
      const data = await response.json();
      const targetDocumentId = data.document_id;
      
      if (targetDocumentId) {
        router.push(`/editor/${targetDocumentId}`);
      } else {
        throw new Error("API did not return a document ID");
      }
    } catch (e) {
      console.error("Template application failed:", e);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24 transition-colors duration-300">
      {/* Header Banner */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] pt-16 pb-12 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--accent)]/5 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
        <div className="mx-auto max-w-7xl relative z-10">
          <BackLink href="/dashboard" label="Back to workspace" />
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mt-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-black uppercase tracking-widest mb-4">
                <Sparkles className="h-3 w-3" /> System Templates
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">
                Template Library
              </h1>
              <p className="max-w-2xl text-[var(--text-secondary)] text-lg leading-relaxed font-medium">
                Jumpstart your document modeling. Browse structured templates optimized for AI extraction and editing workflows.
              </p>
            </div>
            
            {/* Search Box */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-tertiary)]" />
              <input 
                type="text" 
                placeholder="Search blueprints..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 transition-all text-sm font-bold shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-12">
        {/* Category Filters */}
        <div className="flex flex-wrap gap-3 mb-12 pb-6">
          {categoryMap.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`flex items-center gap-2.5 rounded-full px-6 py-2.5 text-sm font-black transition-all duration-300 ${
                activeCategory === cat.name
                  ? "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-xl shadow-[var(--accent)]/20 scale-105"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
              }`}
            >
              <cat.icon className={`h-4 w-4 ${activeCategory === cat.name ? "opacity-100" : "opacity-60"}`} />
              {cat.name}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {query.isLoading && (
          <div className="py-24 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-4">
            <Spinner size="lg" />
            <p className="text-sm font-black uppercase tracking-widest animate-pulse">Synchronizing Blueprints...</p>
          </div>
        )}

        {query.isError && (
          <EmptyState 
            icon={<AlertCircle className="h-16 w-16 text-red-500 opacity-50" />}
            title="Registry sync failed"
            description="We're having trouble connecting to the blueprint registry. Please check your connection and try again."
            action={
              <button onClick={() => query.refetch()} className="mt-4 px-6 py-2 rounded-full border border-[var(--border-strong)] text-sm font-bold hover:bg-[var(--bg-surface)] transition-colors">
                Retry Connection
              </button>
            }
          />
        )}

        {/* Empty State */}
        {!query.isLoading && !query.isError && filtered.length === 0 && (
          <EmptyState 
            icon={<LayoutTemplate className="h-16 w-16 text-[var(--text-tertiary)] opacity-30" />}
            title="No blueprints found"
            description={searchQuery ? `We couldn't find any templates matching "${searchQuery}" in the ${activeCategory} category.` : "There are no templates available in this category yet."}
            action={
              <button onClick={() => {setSearchQuery(""); setActiveCategory("All");}} className="mt-4 px-6 py-2 rounded-full border border-[var(--border-strong)] text-sm font-bold hover:bg-[var(--bg-surface)] transition-colors">
                Reset Filters
              </button>
            }
          />
        )}

        {/* Template Grid */}
        {!query.isLoading && !query.isError && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((template) => {
              const CategoryIcon = categoryMap.find(c => c.name === template.category)?.icon || LayoutTemplate;
              return (
                <article key={template.id} className="group flex flex-col overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-500 hover:-translate-y-2 hover:border-[var(--accent)]/50 hover:shadow-2xl">
                  {/* Thumbnail Area */}
                  <div className="h-52 relative bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] overflow-hidden">
                    <div className="absolute inset-0 opacity-10 group-hover:opacity-30 transition-opacity bg-[radial-gradient(circle_at_center,var(--accent)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                    
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-28 h-36 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg shadow-xl flex flex-col p-3 gap-3 transform group-hover:scale-110 group-hover:rotate-2 transition-all duration-700">
                        <div className="w-full h-2 bg-[var(--accent)]/20 rounded" />
                        <div className="w-3/4 h-2 bg-[var(--border-subtle)] rounded" />
                        <div className="w-full h-1 bg-[var(--border-subtle)] rounded" />
                        <div className="w-5/6 h-1 bg-[var(--border-subtle)] rounded" />
                        <div className="w-full h-16 bg-[var(--accent)]/5 rounded-md border border-dashed border-[var(--accent)]/20 flex items-center justify-center">
                           <CategoryIcon className="h-6 w-6 text-[var(--accent)] opacity-40" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[9px] font-black text-white uppercase tracking-[0.15em]">
                      <CategoryIcon className="h-3 w-3 text-[var(--accent)]" />
                      {template.category}
                    </div>
                  </div>

                  {/* Content Area */}
                  <div className="p-6 flex flex-col flex-1">
                    <h2 className="text-xl font-black text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1 mb-2">{template.title}</h2>
                    <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed mb-6 line-clamp-2">
                      {template.description || "A professional-grade structural blueprint for scalable document production."}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto mb-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">Architect</span>
                        <span className="text-xs font-bold text-[var(--text-secondary)]">{template.author}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5">Adoption</span>
                        <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                           <Star className="h-3 w-3 fill-amber-500" /> {template.uses_count}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => applyTemplate(template.id)}
                      disabled={applyingId === template.id}
                      className="w-full rounded-2xl bg-[var(--bg-elevated)] border-2 border-[var(--border-strong)] px-4 py-3 text-sm font-black text-[var(--text-primary)] transition-all hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-[var(--text-on-accent)] hover:shadow-xl hover:shadow-[var(--accent)]/20 disabled:opacity-50 flex justify-center items-center gap-2 group/btn"
                    >
                      {applyingId === template.id ? (
                        <><Spinner size="sm" className="text-inherit" /> Initializing...</>
                      ) : (
                        <>Use Prototype <ArrowRight className="h-4 w-4 transform group-hover/btn:translate-x-1 transition-transform" /></>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
