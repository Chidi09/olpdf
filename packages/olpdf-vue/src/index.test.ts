import { describe, expect, it, vi } from "vitest";
import { OlpdfEditor } from "./index";

vi.mock("@olpdf/embed", () => ({
  OlPDFEmbed: vi.fn().mockImplementation(function () {
    return { on: vi.fn(), destroy: vi.fn() };
  }),
}));

describe("OlpdfEditor", () => {
  it("exports component definition", () => {
    expect(OlpdfEditor).toBeDefined();
    expect(OlpdfEditor.name).toBe("OlpdfEditor");
  });
});
