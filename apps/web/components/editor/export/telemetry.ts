import type { ExportPhase } from "./types";

export interface ExportTelemetryEvent {
  documentId: string;
  layoutMode: string;
  format: string;
  elapsedMs: number;
  phase: ExportPhase;
  errorClass?: string;
}

export function emitExportTelemetry(event: ExportTelemetryEvent): void {
  try {
    if (typeof window !== "undefined" && "fetch" in window) {
      fetch("/api/bff/telemetry/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // silently fail — telemetry must never block the UX
  }
}
