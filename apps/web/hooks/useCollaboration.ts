"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import type { DocumentModel } from "@olpdf/document-model";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function generateColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return `hsl(${Math.abs(hash % 360)} 78% 46%)`;
}

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

export type CollaborationProvider = WebsocketProvider;

export function useCollaboration(documentId: string, model: DocumentModel) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ydoc = initYDoc(model);
    const localPersist = new IndexeddbPersistence(`olpdf-${documentId}`, ydoc);
    ydocRef.current = ydoc;

    const collabWsUrl = process.env.NEXT_PUBLIC_COLLAB_WS_URL || "ws://localhost:1234";
    const supabase = createSupabaseBrowserClient();

    let wsProvider: WebsocketProvider | null = null;

    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) {
        wsProvider = new WebsocketProvider(
          collabWsUrl,
          `olpdf-doc-${documentId}`,
          ydoc,
          { connect: false, params: { token } }
        );

        wsProvider.on("status", (event: { status: string }) => {
          setConnected(event.status === "connected");
        });

        const displayName =
          data.session?.user?.user_metadata?.full_name ??
          data.session?.user?.email ??
          "Collaborator";
        wsProvider.awareness.setLocalStateField("user", {
          name: displayName,
          color: generateColor(String(wsProvider.awareness.clientID)),
        });
        wsProvider.connect();
        providerRef.current = wsProvider;
      }
    });

    return () => {
      wsProvider?.disconnect();
      wsProvider?.destroy();
      void localPersist.destroy();
      ydoc.destroy();
      providerRef.current = null;
    };
  }, [documentId]);

  return { ydocRef, providerRef, connected };
}
