
"use client";
import { useState } from "react";
import { DocumentModel } from "@olpdf/document-model";
import PreflightPanel, { PreflightIssue } from "./editor/PreflightPanel";

const FORMATS = [
  { id: "fidelity", label: "PDF (Fidelity)" },
  { id: "pdfa", label: "PDF/A" },
  { id: "tagged", label: "Tagged PDF" },
  { id: "epub", label: "EPUB3" },
  { id: "html", label: "HTML" },
  { id: "markdown", label: "Markdown" },
  { id: "txt", label: "Plain Text" },
  { id: "images", label: "Images (ZIP)" },
];

export default function ExportButton({ model, documentId }: { model: DocumentModel; documentId: string }) {
    const [showPreflight, setShowPreflight] = useState(false);
    const [preflightIssues, setPreflightIssues] = useState<PreflightIssue[]>([]);
    const [isChecking, setIsChecking] = useState(false);

    const handlePreflight = async () => {
        setIsChecking(true);
        try {
            const response = await fetch(`/api/bff/documents/${documentId}/preflight`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(model)
            });
            
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                window.location.href = `/login?redirect=/editor/${documentId}`;
                return;
            }
            if (!response.ok) throw new Error("Preflight request failed");
            
            const issues = await response.json();
            setPreflightIssues(issues);
            setShowPreflight(true);
        } catch (error) {
            console.error("Preflight failed:", error);
            alert("Could not run preflight checks. Please try again.");
        } finally {
            setIsChecking(false);
        }
    };

    const handleExport = async (format: string = "pdf") => {
        try {
            if (format === "images") {
                const JSZip = (await import("jszip")).default;
                const zip = new JSZip();
                const pageIndexes = Array.from(new Set((model.blocks ?? []).map((b) => b.page_index ?? 0))).sort((a, b) => a - b);
                // Fabric creates two <canvas> elements per page (.lower-canvas + .upper-canvas).
                // Select only the main drawing canvas to get the correct element per page index.
                const allCanvases = document.querySelectorAll<HTMLCanvasElement>("canvas.lower-canvas");
                for (const pageIndex of pageIndexes) {
                    const canvas = allCanvases[pageIndex] as HTMLCanvasElement | undefined;
                    if (!canvas) continue;
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
                    const base64 = dataUrl.split(",")[1] || "";
                    zip.file(`page-${pageIndex + 1}.jpg`, base64, { base64: true });
                }
                const blob = await zip.generateAsync({ type: "blob" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "pages.zip";
                a.click();
                URL.revokeObjectURL(url);
                return;
            }
            const response = await fetch(`/api/bff/documents/${documentId}/export/${format}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(model)
            });
            
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                window.location.href = `/login?redirect=/editor/${documentId}`;
                return;
            }
            if (!response.ok) throw new Error("Export request failed");
            
            const data = await response.json();
            
            // The BFF returns a URL to the file
            if (data.url) {
                const a = document.createElement("a");
                a.href = data.url;
                a.download = `document-${format}.${format === "pdfa" || format === "tagged" || format === "fidelity" ? "pdf" : format}`;
                a.click();
            }
            
            setShowPreflight(false);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed. Please check preflight issues and try again.");
        }
    };

    return (
        <>
            <button
                onClick={handlePreflight}
                disabled={isChecking}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-800 text-black font-semibold px-4 py-2 rounded transition-colors"
            >
                {isChecking ? "Checking..." : "Export PDF"}
            </button>

            <select
                className="ml-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-2 text-xs"
                defaultValue=""
                onChange={(e) => {
                    const value = e.target.value;
                    if (!value) return;
                    void handleExport(value);
                    e.currentTarget.value = "";
                }}
            >
                <option value="" disabled>More formats...</option>
                {FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                ))}
            </select>

            {showPreflight && (
                <PreflightPanel 
                    issues={preflightIssues}
                    onClose={() => setShowPreflight(false)}
                    onExportAnyway={() => handleExport(model.meta?.export_standard || "pdf")}
                />
            )}
        </>
    );
}

