
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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1b1b20] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-[#f0ede8] flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        Export Preflight
                    </h2>
                    <button onClick={onClose} className="text-[#918d93] hover:text-white transition-colors">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {issues.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <CheckCircle className="w-12 h-12 text-emerald-500 mb-4" />
                            <p className="text-[#f0ede8] font-medium">No issues found!</p>
                            <p className="text-[#918d93] text-sm mt-1">Your document is ready for a professional export.</p>
                        </div>
                    ) : (
                        issues.map((issue, idx) => (
                            <div 
                                key={idx} 
                                className={`p-4 rounded-lg border flex gap-4 ${
                                    issue.severity === 'error' 
                                        ? 'bg-red-500/10 border-red-500/20 text-red-200' 
                                        : issue.severity === 'warning'
                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                                        : 'bg-blue-500/10 border-blue-500/20 text-blue-200'
                                }`}
                            >
                                <div className="mt-0.5">
                                    {issue.severity === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
                                    {issue.severity === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
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

                <div className="p-6 bg-black/20 border-t border-white/10 flex justify-between gap-4">
                    <Button variant="ghost" onClick={onClose} className="text-[#918d93] hover:text-white hover:bg-white/5">
                        Cancel
                    </Button>
                    <div className="flex gap-3">
                        {canExport && issues.length > 0 && (
                            <Button variant="outline" onClick={onExportAnyway} className="border-white/10 text-[#f0ede8] hover:bg-white/5">
                                Export Anyway
                            </Button>
                        )}
                        <Button 
                            disabled={!canExport && issues.length > 0}
                            onClick={issues.length === 0 || canExport ? onExportAnyway : undefined}
                            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-8"
                        >
                            {issues.length === 0 ? 'Export Now' : 'Fix & Export'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
