
"use client";

import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

export interface PreflightIssue {
    type: string;
    block_id?: string;
    detail: string;
    severity: 'error' | 'warning' | 'info';
    count?: number;
    block_ids?: string[];
}

interface PreflightPanelProps {
    issues: PreflightIssue[];
    onClose: () => void;
    onExportAnyway: () => void;
    onFixIssue?: (issue: PreflightIssue) => void;
}

export default function PreflightPanel({ issues, onClose, onExportAnyway, onFixIssue }: PreflightPanelProps) {
    const errors = issues.filter(i => i.severity === 'error');
    const canExport = errors.length === 0;

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="preflight-title">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-[var(--border-subtle)] flex justify-between items-center">
                    <h2 id="preflight-title" className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" aria-hidden="true" />
                        Export Preflight
                    </h2>
                    <button 
                        onClick={onClose} 
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        aria-label="Close Preflight Panel"
                    >
                        <XCircle className="w-6 h-6" aria-hidden="true" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4" role="region" aria-label="Preflight Issues">
                    {issues.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <CheckCircle className="w-12 h-12 text-[var(--status-ok)] mb-4" />
                            <p className="text-[var(--text-primary)] font-medium">No issues found!</p>
                            <p className="text-[var(--text-secondary)] text-sm mt-1">Your document is ready for a professional export.</p>
                        </div>
                    ) : (
                        issues.map((issue, idx) => (
                            <div 
                                key={idx} 
                                className={`p-4 rounded-lg border flex gap-4 ${
                                    issue.severity === 'error' 
                                        ? 'bg-[var(--status-error)]/10 border-[var(--status-error)]/20 text-red-200' 
                                        : issue.severity === 'warning'
                                        ? 'bg-[var(--status-review)]/10 border-[var(--status-review)]/20 text-amber-200'
                                        : 'bg-blue-500/10 border-blue-500/20 text-blue-200'
                                }`}
                            >
                                <div className="mt-0.5">
                                    {issue.severity === 'error' && <XCircle className="w-5 h-5 text-[var(--status-error)]" />}
                                    {issue.severity === 'warning' && <AlertCircle className="w-5 h-5 text-[var(--status-review)]" />}
                                    {issue.severity === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{issue.detail}</p>
                                    <p className="text-xs opacity-70 mt-1 uppercase tracking-wider font-semibold">
                                        {issue.type.replace(/_/g, ' ')}
                                    </p>
                                </div>
                                {onFixIssue && (
                                    <button 
                                        onClick={() => onFixIssue(issue)}
                                        className="text-xs underline hover:no-underline font-medium self-start mt-1"
                                    >
                                        Fix
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 bg-[var(--bg-glass)] border-t border-[var(--border-subtle)] flex justify-between gap-4">
                    <Button variant="ghost" onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-glass-subtle)]">
                        Cancel
                    </Button>
                    <div className="flex gap-3">
                        {canExport && issues.length > 0 && (
                            <Button variant="outline" onClick={onExportAnyway} className="border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-glass-subtle)]">
                                Export Anyway
                            </Button>
                        )}
                        <Button 
                            disabled={!canExport && issues.length > 0}
                            onClick={issues.length === 0 || canExport ? onExportAnyway : undefined}
                            className="bg-[var(--accent)] hover:opacity-90 text-[var(--text-on-accent)] font-semibold px-8"
                        >
                            {issues.length === 0 ? 'Export Now' : 'Fix & Export'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
