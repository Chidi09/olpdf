"use client";

import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { DocumentModel } from "@olpdf/document-model";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function initYDoc(model: DocumentModel): Y.Doc {
  const ydoc = new Y.Doc();
  const yBlocks = ydoc.getMap<Y.Map<unknown>>("blocks");

  ydoc.transact(() => {
    for (const block of model.blocks ?? []) {
      const yBlock = new Y.Map<unknown>();
      for (const [k, v] of Object.entries(block as Record<string, unknown>)) {
        yBlock.set(k, v);
      }
      yBlocks.set(block.id, yBlock);
    }
  });

  return ydoc;
}

export function useCollaboration(documentId: string, model: DocumentModel) {
  const ydocRef = useRef<Y.Doc | null>(null);
  // providerRef kept for API compatibility with useCollaborationBridge
  const providerRef = useRef<null>(null);

  useEffect(() => {
    const ydoc = initYDoc(model);
    const localPersist = new IndexeddbPersistence(`olpdf-${documentId}`, ydoc);
    ydocRef.current = ydoc;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`doc-collab:${documentId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "y-update" }, ({ payload }) => {
      try {
        const update = new Uint8Array(payload.update as number[]);
        Y.applyUpdate(ydoc, update);
      } catch { /* ignore malformed updates */ }
    });

    const updateHandler = (update: Uint8Array) => {
      void channel.send({
        type: "broadcast",
        event: "y-update",
        payload: { update: Array.from(update) },
      });
    };

    ydoc.on("update", updateHandler);
    void channel.subscribe();

    return () => {
      ydoc.off("update", updateHandler);
      void supabase.removeChannel(channel);
      void localPersist.destroy();
      ydoc.destroy();
    };
  }, [documentId]);

  return { ydocRef, providerRef };
}
