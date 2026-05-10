"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentModel } from "@olpdf/document-model";

interface ReflowState {
  isReflowing: boolean;
  lastError: string | null;
}

interface PendingReflow {
  id: string;
  resolve: (model: DocumentModel) => void;
  reject: (err: Error) => void;
}

let _workerInstance: Worker | null = null;
let _refCount = 0;

function _acquireWorker(): Worker {
  if (!_workerInstance) {
    _workerInstance = new Worker(new URL("../workers/reflow.worker.ts", import.meta.url), { type: "module" });
  }
  _refCount++;
  return _workerInstance;
}

function _releaseWorker(): void {
  _refCount--;
  if (_refCount <= 0 && _workerInstance) {
    _workerInstance.terminate();
    _workerInstance = null;
    _refCount = 0;
  }
}

let _idCounter = 0;
function _nextId(): string {
  return `rw_${++_idCounter}_${Date.now()}`;
}

/**
 * Returns a `scheduleReflow` function that off-loads the full AST layout pass
 * to a shared Web Worker, keeping the main thread free at 60 fps.
 *
 * Multiple components share one Worker instance (ref-counted).
 */
export function useReflowWorker(): {
  scheduleReflow: (model: DocumentModel, changedBlockId?: string) => Promise<DocumentModel>;
  isReflowing: boolean;
  lastError: string | null;
} {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef(new Map<string, PendingReflow>());
  const [state, setState] = useState<ReflowState>({ isReflowing: false, lastError: null });
  const inflightRef = useRef(0);

  useEffect(() => {
    const worker = _acquireWorker();
    workerRef.current = worker;

    function onMessage(e: MessageEvent) {
      const { type, id, model, error } = e.data as {
        type: string;
        id: string;
        model?: DocumentModel;
        error?: string;
      };

      const pending = pendingRef.current.get(id);
      if (!pending) return;
      pendingRef.current.delete(id);

      inflightRef.current = Math.max(0, inflightRef.current - 1);
      setState({ isReflowing: inflightRef.current > 0, lastError: error ?? null });

      if (type === "REFLOW_COMPLETE" && model) {
        pending.resolve(model);
      } else {
        pending.reject(new Error(error ?? "Reflow worker error"));
      }
    }

    function onError(e: ErrorEvent) {
      for (const [, pending] of pendingRef.current) {
        pending.reject(new Error(e.message));
      }
      pendingRef.current.clear();
      inflightRef.current = 0;
      setState({ isReflowing: false, lastError: e.message });
    }

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);

    return () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      _releaseWorker();
      workerRef.current = null;
    };
  }, []);

  const scheduleReflow = useCallback(
    (model: DocumentModel, changedBlockId?: string): Promise<DocumentModel> => {
      const worker = workerRef.current;
      if (!worker) return Promise.resolve(model);

      const id = _nextId();
      inflightRef.current++;
      setState((s) => ({ ...s, isReflowing: true }));

      return new Promise<DocumentModel>((resolve, reject) => {
        pendingRef.current.set(id, { id, resolve, reject });
        worker.postMessage({ type: "REFLOW", id, model, changedBlockId });
      });
    },
    [],
  );

  return { scheduleReflow, isReflowing: state.isReflowing, lastError: state.lastError };
}
