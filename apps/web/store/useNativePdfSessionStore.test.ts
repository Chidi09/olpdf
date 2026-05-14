import { describe, expect, it, beforeEach } from "vitest";
import { useNativePdfSessionStore } from "./useNativePdfSessionStore";

describe("useNativePdfSessionStore", () => {
  beforeEach(() => {
    useNativePdfSessionStore.setState({ session: null, isSyncing: false, lastError: null });
  });

  it("sets a session", () => {
    useNativePdfSessionStore.getState().setSession({
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [],
      objects: [],
      operations: [],
    });
    expect(useNativePdfSessionStore.getState().session?.documentId).toBe("doc-1");
  });

  it("appends an operation to an existing session", () => {
    const store = useNativePdfSessionStore.getState();
    store.setSession({
      documentId: "doc-1",
      originalObjectKey: "documents/doc-1.pdf",
      pages: [{ pageIndex: 0, width: 612, height: 792 }],
      objects: [{ id: "obj-1", pageIndex: 0, type: "text", bbox: [0, 0, 10, 10], text: "Hello" }],
      operations: [],
    });
    store.appendOperation({
      id: "op-1",
      type: "replace_text",
      pageIndex: 0,
      targetObjectId: "obj-1",
      before: { text: "Hello" },
      after: { text: "World" },
      createdAt: "now",
    });
    expect(useNativePdfSessionStore.getState().session?.operations).toHaveLength(1);
    expect(useNativePdfSessionStore.getState().session?.objects[0].text).toBe("World");
  });

  it("does not crash when appending to null session", () => {
    useNativePdfSessionStore.getState().appendOperation({
      id: "op-1",
      type: "replace_text",
      pageIndex: 0,
      targetObjectId: "obj-1",
      before: {},
      after: { text: "x" },
      createdAt: "now",
    });
    expect(useNativePdfSessionStore.getState().session).toBeNull();
  });

  it("tracks syncing and error state", () => {
    const store = useNativePdfSessionStore.getState();
    store.setSyncing(true);
    expect(useNativePdfSessionStore.getState().isSyncing).toBe(true);
    store.setLastError("timeout");
    expect(useNativePdfSessionStore.getState().lastError).toBe("timeout");
  });
});
