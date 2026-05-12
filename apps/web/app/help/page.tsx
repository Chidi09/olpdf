"use client";

import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import {
  LifebuoyIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline";

export default function HelpPage() {
  return (
    <PageShell>
      <div className="max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 border-b border-[#222] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Help & Support</h1>
            <p className="mt-1 text-sm text-[#888]">Browse documentation, FAQs, or get in touch.</p>
          </div>

          <div className="group relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666] transition-colors group-focus-within:text-orange-500" />
            <input
              type="text"
              placeholder="Search help articles..."
              className="h-9 w-full rounded-md border border-[#333] bg-[#0A0A0A] pl-9 pr-3 text-sm text-[#ededed] placeholder-[#666] transition-all focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/docs" className="group flex flex-col rounded-lg border border-[#222] bg-[#0A0A0A] p-5 transition-all hover:border-orange-500/40 hover:bg-[#111]">
            <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-md border border-[#333] bg-[#111]">
              <DocumentTextIcon className="h-4 w-4 text-[#888] transition-colors group-hover:text-orange-500" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-[#ededed]">Documentation</h3>
            <p className="mb-4 flex-1 text-xs leading-relaxed text-[#666]">
              Detailed guides on using the editor, API, and managing templates.
            </p>
            <span className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-orange-500">
              Read docs <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </span>
          </Link>

          <div className="group flex cursor-pointer flex-col rounded-lg border border-[#222] bg-[#0A0A0A] p-5 transition-all hover:border-[#444] hover:bg-[#111]">
            <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-md border border-[#333] bg-[#111]">
              <LifebuoyIcon className="h-4 w-4 text-[#888] transition-colors group-hover:text-[#ededed]" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-[#ededed]">FAQ</h3>
            <p className="mb-4 flex-1 text-xs leading-relaxed text-[#666]">
              Answers to the most common questions about features and billing.
            </p>
            <span className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-[#ededed]">
              View FAQ <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </span>
          </div>

          <div className="group flex cursor-pointer flex-col rounded-lg border border-[#222] bg-[#0A0A0A] p-5 transition-all hover:border-[#444] hover:bg-[#111]">
            <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-md border border-[#333] bg-[#111]">
              <EnvelopeIcon className="h-4 w-4 text-[#888] transition-colors group-hover:text-[#ededed]" />
            </div>
            <h3 className="mb-1 text-sm font-semibold text-[#ededed]">Contact Support</h3>
            <p className="mb-4 flex-1 text-xs leading-relaxed text-[#666]">
              Can&apos;t find what you need? Send us a message directly.
            </p>
            <span className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-[#ededed]">
              Email us <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </span>
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-lg border border-[#222] bg-[#0A0A0A]">
          <div className="border-b border-[#222] bg-[#050505] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Popular Articles</h2>
          </div>

          <div className="divide-y divide-[#222]">
            <div className="group flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors hover:bg-[#111]">
              <div className="mt-0.5 shrink-0">
                <ChatBubbleOvalLeftEllipsisIcon className="h-4 w-4 text-[#666] transition-colors group-hover:text-orange-500" />
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium text-[#ededed]">How to edit scanned PDFs with AI</h4>
                <p className="text-xs text-[#666]">Learn how the OCR pipeline automatically triggers on scanned documents and reconstructs the layout.</p>
              </div>
            </div>

            <div className="group flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors hover:bg-[#111]">
              <div className="mt-0.5 shrink-0">
                <ChatBubbleOvalLeftEllipsisIcon className="h-4 w-4 text-[#666] transition-colors group-hover:text-orange-500" />
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium text-[#ededed]">Exporting a Book to EPUB3</h4>
                <p className="text-xs text-[#666]">A step-by-step guide to compiling multiple documents into a reflowable EPUB3 file.</p>
              </div>
            </div>

            <div className="group flex cursor-pointer items-start gap-4 px-5 py-4 transition-colors hover:bg-[#111]">
              <div className="mt-0.5 shrink-0">
                <ChatBubbleOvalLeftEllipsisIcon className="h-4 w-4 text-[#666] transition-colors group-hover:text-orange-500" />
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium text-[#ededed]">Managing API Keys and Webhooks</h4>
                <p className="text-xs text-[#666]">How to securely authenticate server-to-server requests and listen to document events.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
