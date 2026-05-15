import { describe, expect, it, vi } from "vitest";
import { OlPDFEmbed } from "./index";

function makeContainer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

describe("OlPDFEmbed", () => {
  it("throws when host is missing", () => {
    expect(() => new OlPDFEmbed(makeContainer(), { documentId: "doc_1", token: "token" })).toThrow(/host is required/i);
  });

  it("creates a sandboxed iframe with scoped origin", () => {
    const editor = new OlPDFEmbed(makeContainer(), {
      host: "https://olpdf.test",
      documentId: "doc_1",
      token: "token",
    });

    expect(editor.iframe.src).toContain("https://olpdf.test/embed/doc_1");
    expect(editor.iframe.getAttribute("sandbox")).toContain("allow-scripts");
    expect(editor.iframe.referrerPolicy).toBe("no-referrer");

    editor.destroy();
  });

  it("sends versioned commands to the embed origin", () => {
    const editor = new OlPDFEmbed(makeContainer(), {
      host: "https://olpdf.test",
      documentId: "doc_1",
      token: "token",
    });
    const postMessage = vi.fn();
    Object.defineProperty(editor.iframe, "contentWindow", { value: { postMessage } });

    editor.setTheme("dark");

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ olpdf: 1, type: "command:setTheme", payload: { theme: "dark" } }),
      "https://olpdf.test",
    );

    editor.destroy();
  });
});
