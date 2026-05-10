'use client'

import { Download, ShieldCheck, User, Box } from 'lucide-react'

interface PluginCardProps {
  plugin: {
    id: string;
    name: string;
    description: string;
    version: string;
    author_name?: string;
    installs: number;
    is_verified: boolean;
    category: string;
  };
  onInstall?: (id: string) => void;
  isInstalling?: boolean;
}

export function PluginCard({ plugin, onInstall, isInstalling }: PluginCardProps) {
  return (
    <div className="group flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 transition-all hover:border-[var(--accent)]/50 hover:shadow-xl">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
          <Box className="h-6 w-6" />
        </div>
        {plugin.is_verified && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
            <ShieldCheck className="h-3 w-3" /> Verified
          </div>
        )}
      </div>

      <h3 className="text-lg font-black text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent)] transition-colors">
        {plugin.name}
      </h3>
      <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-widest mb-4">
        <User className="h-3 w-3" /> {plugin.author_name || 'Anonymous'} • v{plugin.version}
      </div>

      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6 line-clamp-2">
        {plugin.description}
      </p>

      <div className="mt-auto pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-tertiary)]">
            <Download className="h-3.5 w-3.5" />
            {plugin.installs.toLocaleString()}
          </div>
          <div className="text-[10px] font-black px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-secondary)] uppercase">
            {plugin.category}
          </div>
        </div>

        <button
          onClick={() => onInstall?.(plugin.id)}
          disabled={isInstalling}
          className="px-4 py-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-base)] text-xs font-black transition-all hover:bg-[var(--accent)] hover:text-[var(--text-on-accent)] disabled:opacity-50"
        >
          {isInstalling ? 'Installing...' : 'Add to Studio'}
        </button>
      </div>
    </div>
  )
}
