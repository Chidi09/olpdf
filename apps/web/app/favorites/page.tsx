"use client";

import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import {
  StarIcon,
  MagnifyingGlassIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

export default function FavoritesPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-[#222] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Favorites</h1>
            <p className="mt-1 text-sm text-[#888]">Quick access to your most important documents and books.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="group relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666] transition-colors group-focus-within:text-orange-500" />
              <input
                type="text"
                placeholder="Search favorites..."
                className="h-9 w-full rounded-md border border-[#333] bg-[#0A0A0A] pl-9 pr-3 text-sm text-[#ededed] placeholder-[#666] transition-all focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30 sm:w-64"
              />
            </div>
            <Link href="/toolkit" className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-[#e5e5e5]">
              <ArrowUpTrayIcon className="h-4 w-4" /> Import
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center rounded-lg border border-dashed border-[#222] bg-[#050505] p-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#333] bg-[#111]">
            <StarIcon className="h-6 w-6 text-[#888]" />
          </div>
          <h3 className="mb-1 text-base font-medium text-white">No favorites yet</h3>
          <p className="mb-6 max-w-sm text-sm text-[#666]">
            Mark documents or books as favorites to see them here for quick access.
          </p>
          <Link href="/dashboard" className="flex h-9 items-center rounded-md border border-[#333] bg-[#111] px-4 text-sm font-medium text-white transition-all hover:border-[#444] hover:bg-[#1A1A1A]">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
