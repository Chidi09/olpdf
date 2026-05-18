"use client";

import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  Puzzle, 
  Sparkles,
  PlusCircle,
  Filter,
  AlertCircle
} from "lucide-react";
import { Spinner, EmptyState } from "@olpdf/ui";
import BackLink from "@/components/BackLink";
import { PluginCard } from "@/components/marketplace/PluginCard";
import { usePluginsStore } from "@/store/usePluginsStore";
import { useInstallPlugin } from "@/hooks/usePlugins";

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
  const installMutation = useInstallPlugin();

  const workspacesQuery = useQuery<any[]>({
    queryKey: ["user-workspaces"],
    queryFn: async () => {
      const res = await fetch("/api/bff/workspaces");
      if (!res.ok) throw new Error("Failed to fetch workspaces");
      return res.json();
    }
  });

  const { data: plugins, isLoading, isError } = useQuery<Plugin[]>({
    queryKey: ["plugins-marketplace", activeCategory],
    queryFn: async () => {
      const url = activeCategory === "All" 
        ? "/api/bff/plugins" 
        : `/api/bff/plugins?category=${activeCategory}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch plugins");
      return res.json();
    }
  });

  const handleInstall = async (pluginId: string) => {
    const workspaceId = workspacesQuery.data?.[0]?.id;
    if (!workspaceId) {
      console.warn("No workspace found for installation");
      return;
    }

    setInstallingId(pluginId);
    try {
      await installMutation.mutateAsync({ workspaceId, pluginId });
    } catch (e) {
      console.error("Installation failed:", e);
    } finally {
      setInstallingId(null);
    }
  };

  const filtered = plugins?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-24">
      {/* Header */}
      <div className="liquid-glass-strong liquid-glass-noise border-b border-white/[0.06] pt-16 pb-12 px-6">
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
              className="w-full liquid-glass rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all font-bold placeholder:text-white/30"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeCategory === cat
                    ? "liquid-glass-strong text-white ring-1 ring-accent/50"
                    : "liquid-glass liquid-glass-noise text-white/60 hover:text-white"
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
        ) : isError ? (
          <EmptyState 
            icon={<AlertCircle className="h-16 w-16 text-red-500 opacity-50" />}
            title="Registry sync failed"
            description="We're having trouble connecting to the plugin registry. Please check your connection and try again."
            action={
              <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 rounded-full border border-[var(--border-strong)] text-sm font-bold hover:bg-[var(--bg-surface)] transition-colors">
                Retry Connection
              </button>
            }
          />
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
