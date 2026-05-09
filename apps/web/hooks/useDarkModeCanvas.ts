"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import type { Canvas } from "fabric";

export function useDarkModeCanvas(fabricCanvasesRef: RefObject<Map<number, Canvas>>) {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (isDark: boolean) => {
      for (const canvas of fabricCanvasesRef.current.values()) {
        canvas.set({ backgroundColor: isDark ? "#1e1e1e" : "transparent" });
        canvas.renderAll();
      }
    };
    apply(mq.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [fabricCanvasesRef]);
}
