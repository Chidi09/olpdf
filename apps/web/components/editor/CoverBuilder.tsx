"use client";

import React, { useState } from "react";
import { X, Image as ImageIcon } from "lucide-react";

interface CoverBuilderProps {
  onSave: (coverUrl: string) => void;
  onClose: () => void;
}

export default function CoverBuilder({ onSave, onClose }: CoverBuilderProps) {
  const [mode, setMode] = useState<"gradient" | "upload">("gradient");
  const [gradient, setGradient] = useState("from-amber-500 to-amber-900");

  const gradients = [
    "from-amber-500 to-amber-900",
    "from-blue-600 to-indigo-900",
    "from-emerald-500 to-teal-900",
    "from-rose-500 to-red-900",
    "from-purple-600 to-indigo-900",
    "from-slate-700 to-slate-900",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-[var(--border-subtle)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Book Cover Builder</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Preview */}
          <div className="flex flex-col items-center">
            <h3 className="text-xs font-bold tracking-widest uppercase text-[var(--text-tertiary)] mb-6">Preview</h3>
            <div className={`w-48 h-72 rounded-lg shadow-2xl bg-gradient-to-br ${gradient} flex flex-col items-center justify-center p-6 text-center`}>
                <div className="w-full h-1 bg-white/20 mb-4" />
                <div className="text-white font-display text-lg font-bold drop-shadow-md">My Masterpiece</div>
                <div className="mt-auto text-white/80 text-[10px] font-mono tracking-widest">OLPDF PRESS</div>
            </div>
          </div>

          {/* Controls */}
          <div>
            <div className="flex gap-4 mb-8">
              <button 
                onClick={() => setMode("gradient")}
                className={`text-sm font-bold pb-2 border-b-2 transition-all ${mode === "gradient" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-secondary)]"}`}
              >
                Gradients
              </button>
              <button 
                onClick={() => setMode("upload")}
                className={`text-sm font-bold pb-2 border-b-2 transition-all ${mode === "upload" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-secondary)]"}`}
              >
                Upload Image
              </button>
            </div>

            {mode === "gradient" && (
              <div className="grid grid-cols-3 gap-3">
                {gradients.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGradient(g)}
                    className={`h-12 rounded-md bg-gradient-to-br ${g} border-2 ${gradient === g ? "border-white" : "border-transparent"}`}
                  />
                ))}
              </div>
            )}

            {mode === "upload" && (
              <div className="border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8 text-center flex flex-col items-center justify-center bg-[var(--bg-base)]">
                <ImageIcon className="h-8 w-8 mb-3 opacity-30" />
                <p className="text-sm text-[var(--text-secondary)] mb-4">Click to upload or drag image</p>
                <button className="px-4 py-1.5 bg-[var(--accent)] text-[var(--text-on-accent)] rounded text-xs font-bold">Select File</button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
          <button 
            onClick={() => onSave(gradient)} 
            className="px-6 py-2 bg-[var(--accent)] text-[var(--text-on-accent)] rounded-lg text-sm font-bold hover:opacity-90"
          >
            Apply to Book
          </button>
        </div>
      </div>
    </div>
  );
}
