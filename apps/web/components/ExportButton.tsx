
"use client";
import { useState } from "react";
import { DocumentModel } from "@olpdf/document-model";
import PreflightPanel, { PreflightIssue } from "./editor/PreflightPanel";

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
                a.download = `document-${format}.${format === 'pdfa' || format === 'tagged' ? 'pdf' : format}`;
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

