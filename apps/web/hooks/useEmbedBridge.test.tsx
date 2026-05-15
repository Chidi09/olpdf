import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEmbedBridge } from "./useEmbedBridge";

describe("useEmbedBridge", () => {
  it("ignores messages without olpdf protocol version", () => {
    const onSetTheme = vi.fn();
    renderHook(() => useEmbedBridge({ parentOrigin: "https://host.test", onSetTheme }));
    window.dispatchEvent(new MessageEvent("message", { origin: "https://host.test", data: { type: "command:setTheme", payload: { theme: "dark" } } }));
    expect(onSetTheme).not.toHaveBeenCalled();
  });

  it("handles versioned setTheme commands", () => {
    const onSetTheme = vi.fn();
    renderHook(() => useEmbedBridge({ parentOrigin: "https://host.test", onSetTheme }));
    window.dispatchEvent(new MessageEvent("message", { origin: "https://host.test", data: { olpdf: 1, id: "1", type: "command:setTheme", payload: { theme: "dark" } } }));
    expect(onSetTheme).toHaveBeenCalledWith("dark");
  });
});
