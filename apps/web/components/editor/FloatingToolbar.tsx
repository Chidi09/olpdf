"use client";

import { useEffect, useState } from "react";

type Position = { top: number; left: number };

export default function FloatingToolbar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });

  useEffect(() => {
    const onMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setVisible(false);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setPosition({ top: rect.top - 44, left: rect.left + rect.width / 2 });
      setVisible(true);
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-[var(--bg-elevated)] p-1 shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <button className="px-2 py-1 text-xs" onClick={() => document.execCommand("bold")}>B</button>
      <button className="px-2 py-1 text-xs italic" onClick={() => document.execCommand("italic")}>I</button>
      <button className="px-2 py-1 text-xs underline" onClick={() => document.execCommand("underline")}>U</button>
    </div>
  );
}
