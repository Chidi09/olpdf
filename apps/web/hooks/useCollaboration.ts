"use client";

import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { SupabaseProvider } from "y-supabase";
import { IndexeddbPersistence } from "y-indexeddb";
import type { DocumentModel } from "@olpdf/document-model";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function generateColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash << 5) - hash + seed.charCodeAt(i);
  const hue = Math.abs(hash % 360);
  return `hsl(${hue} 78% 46%)`;
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

export function useCollaboration(documentId: string, model: DocumentModel) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<SupabaseProvider | null>(null);

  useEffect(() => {
    const ydoc = initYDoc(model);
    const localPersist = new IndexeddbPersistence(`olpdf-${documentId}`, ydoc);
    ydocRef.current = ydoc;

    let provider: SupabaseProvider | null = null;
    const init = async () => { try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const displayName =
        sessionData.session?.user?.user_metadata?.full_name ??
        sessionData.session?.user?.email ??
        "Collaborator";

      provider = new SupabaseProvider(ydoc, supabase as any, {
        channel: `document:${documentId}`,
        tableName: "yjs_updates",
        columnName: "data",
        docId: documentId,
      });
      providerRef.current = provider;

      provider.awareness.setLocalStateField("user", {
        id: `local-${provider.awareness.clientID}`,
        name: displayName,
        color: generateColor(String(provider.awareness.clientID)),
        selectedBlockId: null,
      });
    } catch { providerRef.current = null; } };
    void init();

    return () => {
      provider?.destroy();
      localPersist.destroy();
      ydoc.destroy();
    };
  }, [documentId]);

  return { ydocRef, providerRef };
}
