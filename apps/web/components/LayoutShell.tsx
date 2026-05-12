"use client";

import { usePathname, useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import AppSidebar from "@/components/AppSidebar";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { DragDropOverlay } from "@/components/DragDropOverlay";
import { useRef, useState } from "react";
import { usePdfWasm } from "@/hooks/usePdfWasm";
import { normalizeWasmResult } from "@/lib/nativePdf/normalizeWasmPdf";
import type { PdfEditSession } from "@/types/nativePdf";

// Pages that render with absolutely no chrome
const BARE_ROUTES = ["/embed"];

// Pages that render with no navbar and no sidebar (auth flow)
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

// Logged-in app shell — gets sidebar, no top navbar
const APP_ROUTES = [
  "/dashboard",
  "/favorites",
  "/analytics",
  "/editor",
  "/books",
  "/templates",
  "/toolkit",
  "/settings",
  "/help",
  "/profile",
];

const EDITOR_ROUTES = ["/editor"];

function matchesPrefix(pathname: string, routes: string[]) {
  return routes.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const { parsePdf } = usePdfWasm();
  const wasmSessionRef = useRef<PdfEditSession | null>(null);

  const handleFileDrop = async (file: File) => {
    if (file.type !== "application/pdf") return;
    try {
      const res = await fetch("/api/bff/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: file.name.replace(/\.pdf$/i, "") || "Imported PDF" }),
      });
      const created = await res.json();
      if (!created?.id) return;
      const arrayBuffer = await file.arrayBuffer();
      const wasmResult = await parsePdf(arrayBuffer).catch(() => null);
      let session: PdfEditSession | null = null;
      if (wasmResult) {
        session = normalizeWasmResult(wasmResult as any, created.id, "pending");
        wasmSessionRef.current = session;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("failed_to_read"));
        reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.readAsDataURL(file);
      });
      const importPayload: Record<string, unknown> = { documentId: created.id, fileBytes: base64, layout_mode: "fidelity" };
      if (session) {
        importPayload.client_model = {
          blocks: session.objects.map((obj) => ({
            id: obj.id,
            type: "text",
            content: obj.text || "",
            page_index: obj.pageIndex,
            bounding_box: obj.bbox,
            z_index: obj.zIndex,
            font_meta: obj.fontFamily ? { family: obj.fontFamily, size: obj.fontSize, color: obj.color } : undefined,
          })),
          page_dimensions: session.pages.map((p) => ({
            page_index: p.pageIndex,
            width: p.width,
            height: p.height,
          })),
        };
      }
      await fetch("/api/bff/import/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPayload),
      });
      router.push(`/editor/${created.id}`);
    } catch {
      // silent fail — user can retry via dashboard
    }
  };

  if (matchesPrefix(pathname, BARE_ROUTES)) {
    return <>{children}</>;
  }

  if (matchesPrefix(pathname, AUTH_ROUTES)) {
    return <>{children}</>;
  }

  if (matchesPrefix(pathname, EDITOR_ROUTES)) {
    return (
      <div className="app-shell-font relative h-screen overflow-hidden bg-black">
        {children}
        <OfflineIndicator />
      </div>
    );
  }

  if (matchesPrefix(pathname, APP_ROUTES)) {
    return (
      <div className="app-shell-font relative flex h-screen overflow-hidden bg-black">
        <div className="pointer-events-none absolute -left-[12%] -top-[14%] h-[46%] w-[42%] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-[10%] -right-[8%] h-[36%] w-[30%] rounded-full bg-blue-600/6 blur-[110px]" />
        <AppSidebar signingOut={signingOut} onSigningOutChange={setSigningOut} />
        <main className={`relative z-10 flex-1 overflow-auto transition-opacity ${signingOut ? "pointer-events-none opacity-50" : "opacity-100"}`}>
          {children}
        </main>
        <OfflineIndicator />
        <CommandPalette />
        <DragDropOverlay onDrop={handleFileDrop} />
      </div>
    );
  }

  // Public pages — landing, docs, etc.
  return (
    <>
      <AppNavbar />
      <div>{children}</div>
      <OfflineIndicator />
    </>
  );
}
