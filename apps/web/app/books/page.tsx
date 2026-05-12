"use client";

import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import {
  BookOpenIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

export default function BooksPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 border-b border-[#222] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Books</h1>
            <p className="mt-1 text-sm text-[#888]">Compile multiple documents with structural consistency checks.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="group relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666] transition-colors group-focus-within:text-orange-500" />
              <input
                type="text"
                placeholder="Search books..."
                className="h-9 w-full rounded-md border border-[#333] bg-[#0A0A0A] pl-9 pr-3 text-sm text-[#ededed] placeholder-[#666] transition-all focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30 sm:w-64"
              />
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-md border border-[#333] bg-[#0A0A0A] text-[#888] transition-colors hover:bg-[#111]">
              <FunnelIcon className="h-4 w-4" />
            </button>
            <Link href="/books/new" className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-orange-600 px-4 text-sm font-semibold text-white shadow-[0_0_12px_rgba(234,88,12,0.2)] transition-colors hover:bg-orange-500">
              <PlusIcon className="h-4 w-4" /> New Book
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center rounded-lg border border-dashed border-[#222] bg-[#050505] p-12 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#333] bg-[#111]">
            <BookOpenIcon className="h-6 w-6 text-[#888]" />
          </div>
          <h3 className="mb-1 text-base font-medium text-white">No books found</h3>
          <p className="mb-6 max-w-sm text-sm text-[#666]">
            Create a new book workspace to compile chapters and run cross-document consistency checks.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/books/new" className="flex h-9 items-center gap-1.5 rounded-md border border-[#333] bg-[#111] px-4 text-sm font-medium text-white transition-all hover:border-[#444] hover:bg-[#1A1A1A]">
              <PlusIcon className="h-4 w-4" /> Create Book
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
