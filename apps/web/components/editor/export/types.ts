export type ExportPhase = "idle" | "preflight" | "saving" | "exporting" | "success" | "error";

export interface ExportTelemetryPayload {
  documentId: string;
  layoutMode: string;
  format: string;
  elapsedMs: number;
  phase: ExportPhase;
  errorClass?: string;
}

export function toExportErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const d = (payload as { detail?: unknown }).detail;
    if (typeof d === "string" && d.trim()) return d;
  }
  return "Export failed. Please try again.";
}
