"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import type { Canvas } from "fabric";

export function useDarkModeCanvas(fabricCanvasesRef: RefObject<Map<number, Canvas>>) {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (_isDark: boolean) => {
      // Always transparent — VirtualizedPage's bg-white wrapper IS the paper.
      // Setting a dark fill here was covering the white page and causing the
      // "greyed out" appearance in dark mode.
      for (const canvas of fabricCanvasesRef.current.values()) {
        canvas.set({ backgroundColor: "transparent" });
        canvas.renderAll();
      }
    };
    apply(mq.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [fabricCanvasesRef]);
}
