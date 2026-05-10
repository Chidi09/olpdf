"use client";

import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import type { RealtimeChannel } from "@supabase/supabase-js";
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

// Minimal awareness implementation backed by Supabase Realtime Presence.
// Matches the interface FidelityCanvas expects from y-supabase's provider.awareness.
class SupabaseAwareness {
  readonly clientID: number;
  private localState: Record<string, unknown> = {};
  private states = new Map<number, Record<string, unknown>>();
  private listeners = new Map<string, Set<() => void>>();
  private channel: RealtimeChannel;

  constructor(channel: RealtimeChannel, clientID: number) {
    this.clientID = clientID;
    this.channel = channel;

    channel.on("presence", { event: "sync" }, () => {
      this.states.clear();
      const presenceState = channel.presenceState<{ clientID: number } & Record<string, unknown>>();
      for (const presences of Object.values(presenceState)) {
        for (const p of presences) {
          const { clientID: cid, ...rest } = p as { clientID: number } & Record<string, unknown>;
          if (typeof cid === "number") this.states.set(cid, rest);
        }
      }
      // Always include local state so getStates() reflects it
      this.states.set(this.clientID, this.localState);
      this._emit("change");
    });
  }

  getStates(): Map<number, Record<string, unknown>> {
    return this.states;
  }

  getLocalState(): Record<string, unknown> {
    return { ...this.localState };
  }

  setLocalStateField(key: string, value: unknown): void {
    this.localState = { ...this.localState, [key]: value };
    void this.channel.track({ clientID: this.clientID, ...this.localState });
  }

  on(_event: string, fn: () => void): void {
    const set = this.listeners.get(_event) ?? new Set();
    set.add(fn);
    this.listeners.set(_event, set);
  }

  off(_event: string, fn: () => void): void {
    this.listeners.get(_event)?.delete(fn);
  }

  private _emit(event: string): void {
    this.listeners.get(event)?.forEach((fn) => fn());
  }
}

export type CollaborationProvider = { awareness: SupabaseAwareness };

export function useCollaboration(documentId: string, model: DocumentModel) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<CollaborationProvider | null>(null);

  useEffect(() => {
    const ydoc = initYDoc(model);
    const localPersist = new IndexeddbPersistence(`olpdf-${documentId}`, ydoc);
    ydocRef.current = ydoc;

    const supabase = createSupabaseBrowserClient();
    const clientID = Math.floor(Math.random() * 0xffffff);

    const channel = supabase.channel(`doc-collab:${documentId}`, {
      config: { broadcast: { self: false }, presence: { key: String(clientID) } },
    });

    const awareness = new SupabaseAwareness(channel, clientID);
    providerRef.current = { awareness };

    // Sync Y.js updates via broadcast
    channel.on("broadcast", { event: "y-update" }, ({ payload }) => {
      try {
        Y.applyUpdate(ydoc, new Uint8Array(payload.update as number[]));
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

    void channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      const { data } = await supabase.auth.getSession();
      const displayName =
        data.session?.user?.user_metadata?.full_name ??
        data.session?.user?.email ??
        "Collaborator";
      awareness.setLocalStateField("user", {
        name: displayName,
        color: generateColor(String(clientID)),
        selectedBlockId: null,
      });
    });

    return () => {
      ydoc.off("update", updateHandler);
      void supabase.removeChannel(channel);
      void localPersist.destroy();
      ydoc.destroy();
      providerRef.current = null;
    };
  }, [documentId]);

  return { ydocRef, providerRef };
}
