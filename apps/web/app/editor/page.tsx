"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileEdit, Search, Filter, Upload, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import UploadProgressModal from "@/components/UploadProgressModal";

export default function EditorDocsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onImportClick = () => fileInputRef.current?.click();

  const onFileSelected = async (file: File | null) => {
    if (!file) return;
    setUploadOpen(true);
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
    <div className="flex flex-col min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-300">
      <header className="sticky top-0 z-10 bg-[var(--bg-base)]/80 backdrop-blur-md border-b border-[var(--border-subtle)] px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileEdit className="h-6 w-6 text-[var(--accent)]" />
          My Documents
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
            <input 
              type="text"
              placeholder="Search documents..."
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full pl-10 pr-4 py-2 text-sm w-64 outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>
          <Button variant="outline" className="rounded-full h-10 w-10 p-0 border-[var(--border-strong)]"><Filter className="h-4 w-4" /></Button>
          <Link href="/editor/new">
            <Button className="rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] px-4 font-bold shadow-lg hover:shadow-xl transition-all h-10 gap-2">
              <Plus className="h-4 w-4" /> New Document
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 p-8">
        <div className="py-20 flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full scale-150" />
            <div className="h-24 w-24 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 relative z-10">
              <FileText className="h-10 w-10" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2">No documents yet</h3>
          <p className="text-[var(--text-secondary)] max-w-sm mb-8">
            Create a new blank document or import a PDF to start editing with full fidelity.
          </p>
          <div className="flex gap-4">
            <Link href="/editor/new">
              <Button className="rounded-full bg-[var(--accent)] text-[var(--text-on-accent)] px-6 font-bold shadow-lg h-12 gap-2">
                <Plus className="h-4 w-4" /> Blank Document
              </Button>
            </Link>
            <Button variant="outline" onClick={onImportClick} className="rounded-full px-6 font-bold border-[var(--border-strong)] h-12 gap-2">
              <Upload className="h-4 w-4" /> Import PDF
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

        {/* Skeleton State Example (Hidden normally, shown while loading data) */}
        <div className="mt-24 border-t border-[var(--border-subtle)] pt-12">
          <h4 className="text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-6">Loading State Preview</h4>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 animate-pulse">
                <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] mb-4" />
                <div className="h-4 w-3/4 bg-[var(--bg-elevated)] rounded mb-2" />
                <div className="h-3 w-1/2 bg-[var(--bg-elevated)] rounded" />
              </div>
            ))}
          </div>
        </div>
      </main>
      <UploadProgressModal
        open={uploadOpen}
        status={uploadStatus}
        progress={uploadProgress}
        error={uploadError}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  );
}
