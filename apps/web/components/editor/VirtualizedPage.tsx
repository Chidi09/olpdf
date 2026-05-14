"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type PageState = "placeholder" | "thumbnail" | "live";

interface VirtualizedPageProps {
  dim: { page_index: number; width: number; height: number };
  scale: number;
  onCanvasReady: (pageIndex: number, el: HTMLCanvasElement) => void;
  onCanvasDestroy: (pageIndex: number) => void;
  children?: ReactNode;
  backgroundUrl?: string;
}

function captureThumbnail(canvas: HTMLCanvasElement, callback: (url: string) => void) {
  const task = () => {
    const url = canvas.toDataURL("image/jpeg", 0.65);
    callback(url);
  };

  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(task, { timeout: 2000 });
  } else {
    setTimeout(task, 0);
  }
}

async function cacheThumbnail(pageIndex: number, thumbnailUrl: string) {
  try {
    const cache = await caches.open("page-thumbnails-v1");
    await cache.put(`/thumbnail/local/${pageIndex}`, new Response(thumbnailUrl));
  } catch {
    // Best-effort cache only.
  }
}

export function VirtualizedPage({ dim, scale, onCanvasReady, onCanvasDestroy, children, backgroundUrl }: VirtualizedPageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const thumbnailCacheRef = useRef<Map<number, string>>(new Map());
  const [state, setState] = useState<PageState>("placeholder");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  // Ref so the IntersectionObserver callback always reads current state
  // without needing to be recreated on every state transition.
  const stateRef = useRef<PageState>("placeholder");
  // Sync via useLayoutEffect so we never mutate a ref during render.
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const cached = thumbnailCacheRef.current.get(dim.page_index);
    if (cached) {
      setThumbnailUrl(cached);
      setState("thumbnail");
    }
  }, [dim.page_index]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && stateRef.current !== "live") {
          setState("live");
          return;
        }
      },
      {
        rootMargin: "200% 0px",
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  // stateRef is intentionally excluded — it's always current via the ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dim.page_index, onCanvasDestroy]);

  const pageWidth = dim.width * scale;
  const pageHeight = dim.height * scale;

  return (
    <div
      ref={wrapperRef}
      data-page-index={dim.page_index}
      className="relative mx-auto rounded-sm bg-white shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
      style={{ width: pageWidth, height: pageHeight }}
    >
      {backgroundUrl && (
        <img
          src={backgroundUrl}
          alt=""
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-fill"
          draggable={false}
        />
      )}

      {state === "live" && (
        <canvas
          ref={(node) => {
            if (!node || node === canvasRef.current) return;
            canvasRef.current = node;
            onCanvasReady(dim.page_index, node);
          }}
          className="absolute inset-0 z-10"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      {state === "thumbnail" && thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={`Page ${dim.page_index + 1}`}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
      )}

      {state === "placeholder" && <div className="absolute inset-0 animate-pulse bg-gray-50" />}

      {state === "live" ? children : null}
    </div>
  );
}
