"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

export function DragDropOverlay({ onDrop }: { onDrop?: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) {
        dragDepth.current = 0;
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) onDrop?.(file);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [onDrop]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 p-4 animate-in fade-in duration-200 pointer-events-none">
      <div className="w-full h-full rounded-xl border-2 border-dashed border-orange-500/50 bg-orange-500/5 backdrop-blur-[2px] flex items-center justify-center">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-2xl rounded-lg px-6 py-4 flex flex-col items-center pointer-events-auto">
          <div className="w-10 h-10 bg-[var(--bg-panel)] rounded-md border border-[var(--border-subtle)] flex items-center justify-center mb-3">
            <ArrowDownTrayIcon className="w-5 h-5 text-[var(--accent)] animate-bounce" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Drop PDF to Import</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Maximum file size 10MB</p>
        </div>
      </div>
    </div>
  );
}
