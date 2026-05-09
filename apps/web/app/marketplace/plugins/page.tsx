"use client";

import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  Puzzle, 
  Sparkles,
  PlusCircle,
  Filter
} from "lucide-react";
import { Spinner, EmptyState } from "@olpdf/ui";
import BackLink from "@/components/BackLink";
import { PluginCard } from "@/components/marketplace/PluginCard";
import { usePluginsStore } from "@/store/usePluginsStore";

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  installs: number;
  is_verified: boolean;
  category: string;
  author_name: string;
}

const categories = ["All", "Editor", "Export", "AI", "UI", "Utility"];

export default function PluginMarketplacePage() {
  const { activeCategory, searchQuery, installingId, setActiveCategory, setSearchQuery, setInstallingId } = usePluginsStore();

  const { data: plugins, isLoading } = useQuery<Plugin[]>({
    queryKey: ["plugins-marketplace", activeCategory],
    queryFn: async () => {
      const url = activeCategory === "All" 
        ? "/api/plugins" 
        : `/api/plugins?category=${activeCategory}`;
      
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch plugins");
        return res.json();
      } catch (e) {
        // Mock data for demo
        return [
          { id: "p1", name: "Grammar Pro", description: "Advanced structural grammar checking and style suggestions.", version: "1.2.0", installs: 4500, is_verified: true, category: "AI", author_name: "OLPDF Core" },
          { id: "p2", name: "LaTeX Math Renderer", description: "Seamlessly render complex mathematical equations using KaTeX.", version: "0.9.5", installs: 1200, is_verified: true, category: "Editor", author_name: "AcademicToolbox" },
          { id: "p3", name: "Dark Theme Pack", description: "High-contrast dark mode skins for the fidelity canvas.", version: "2.0.1", installs: 8900, is_verified: false, category: "UI", author_name: "ThemeMaster" },
          { id: "p4", name: "Export to Notion", description: "Directly sync your document blocks to a Notion page.", version: "1.0.0", installs: 3100, is_verified: true, category: "Export", author_name: "NotionSync" },
        ];
      }
    }
  });

  const handleInstall = async (id: string) => {
    setInstallingId(id);
    await new Promise(r => setTimeout(r, 1000));
    setInstallingId(null);
    alert('Plugin added to your workspace!');
  };

  const filtered = plugins?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24">
      {/* Header */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] pt-16 pb-12 px-6">
        <div className="mx-auto max-w-7xl">
          <BackLink href="/dashboard" label="Back to workspace" />
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mt-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-black uppercase tracking-widest mb-4">
                <Sparkles className="h-3 w-3" /> Plugin SDK v1.0
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">
                Studio Marketplace
              </h1>
              <p className="max-w-2xl text-[var(--text-secondary)] text-lg leading-relaxed font-medium">
                Extend OLPDF with specialized tools, AI agents, and custom UI components built on the open-source Plugin SDK.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[var(--accent)] text-[var(--text-on-accent)] font-black text-sm shadow-xl shadow-[var(--accent)]/20 transition-transform hover:scale-105 active:scale-95">
                <PlusCircle className="h-5 w-5" /> Submit Plugin
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-12">
        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-6 mb-12">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-tertiary)]" />
            <input 
              type="text" 
              placeholder="Search plugins by name, feature, or author..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10 transition-all font-bold"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all border ${
                  activeCategory === cat 
                    ? "bg-[var(--text-primary)] text-[var(--bg-base)] border-[var(--text-primary)]" 
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--accent)]/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm font-black uppercase tracking-widest animate-pulse">Scanning Registry...</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState 
            icon={<Puzzle className="h-16 w-16 text-[var(--text-tertiary)] opacity-30" />}
            title="No plugins found"
            description="Try adjusting your search or category filters to find what you're looking for."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map(plugin => (
              <PluginCard 
                key={plugin.id} 
                plugin={plugin} 
                onInstall={handleInstall}
                isInstalling={installingId === plugin.id}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
