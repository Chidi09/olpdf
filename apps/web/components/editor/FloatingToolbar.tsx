"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ChatBubbleLeftIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { GlassPanel } from "@/components/ui/Glass";

export type FloatingToolbarAction = "bold" | "italic" | "link" | "comment" | "aiRewrite";

type Position = { top: number; left: number };

interface FloatingToolbarProps {
  onAction: (action: FloatingToolbarAction, selectionText: string) => void;
}

export default function FloatingToolbar({ onAction }: FloatingToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });

  const getSelectionText = useCallback(() => {
    return window.getSelection()?.toString() || "";
  }, []);

  const handleAction = useCallback((action: FloatingToolbarAction) => {
    onAction(action, getSelectionText());
    setVisible(false);
  }, [onAction, getSelectionText]);

  useEffect(() => {
    const onMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setVisible(false);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setPosition({ top: rect.top - 48, left: rect.left + rect.width / 2 });
      setVisible(true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false);
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
      style={{ top: position.top, left: position.left, transform: "translateX(-50%)" }}
    >
      <GlassPanel className="flex items-center gap-1 p-1 shadow-2xl">
        <button
          onClick={() => handleAction("bold")}
          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/10 rounded transition-colors active:scale-[0.95]"
        >
          <BoldIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleAction("italic")}
          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/10 rounded transition-colors active:scale-[0.95]"
        >
          <ItalicIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleAction("link")}
          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/10 rounded transition-colors active:scale-[0.95]"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button
          onClick={() => handleAction("aiRewrite")}
          className="p-1.5 text-orange-500 hover:bg-orange-500/10 rounded transition-colors active:scale-[0.95]"
          title="AI Rewrite"
        >
          <SparklesIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleAction("comment")}
          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/10 rounded transition-colors active:scale-[0.95]"
          title="Comment"
        >
          <ChatBubbleLeftIcon className="w-4 h-4" />
        </button>
      </GlassPanel>
      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--bg-panel)] border-b border-r border-[var(--border-subtle)] rotate-45" />
    </div>
  );
}
