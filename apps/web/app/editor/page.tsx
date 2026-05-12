"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpTrayIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { ImportStatusToast } from "@/components/ui/ImportStatusToast";

export default function EditorDocsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onImportClick = () => fileInputRef.current?.click();

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
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
      setUploadStatus("failed");
      setUploadError("Failed to create document");
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
    const importRes = await fetch("/api/bff/import/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: created.id, fileBytes: base64, layout_mode: "fidelity" }),
    });
    if (!importRes.ok) {
      setUploadStatus("failed");
      setUploadError("Import request failed");
      return;
    }
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
      title="Documents"
      actions={
        <>
          <div className="relative hidden md:block group">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)] group-focus-within:text-[var(--accent)]" />
            <input 
              type="text"
              placeholder="Search documents..."
              className="h-8 w-64 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-subtle)]"
            />
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <FunnelIcon className="h-4 w-4" />
          </button>
          <Link href="/editor/new">
            <Button className="h-8 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--text-on-accent)]">
              <PlusIcon className="h-4 w-4" /> New
            </Button>
          </Link>
        </>
      }
    >
      <div className="mt-8 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-panel)] px-6 py-14 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
          <DocumentTextIcon className="h-6 w-6 text-[var(--text-secondary)]" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)]">No documents found</h3>
        <p className="mx-auto mb-6 max-w-sm text-sm text-[var(--text-secondary)]">
          Create a new blank document or import a PDF to start editing with full fidelity.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/editor/new">
            <Button variant="outline" className="h-9 rounded-md border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]">
              <PlusIcon className="h-4 w-4" /> Blank Document
            </Button>
          </Link>
          <Button onClick={onImportClick} className="h-9 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--text-on-accent)]">
            <ArrowUpTrayIcon className="h-4 w-4" /> Import PDF
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => void onFileSelected(e.target.files?.[0] || null)}
      />

      <ImportStatusToast
        status={uploadStatus}
        progress={uploadProgress}
        error={uploadError}
        filename="Importing PDF..."
      />
    </PageShell>
  );
}
