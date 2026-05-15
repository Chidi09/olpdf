import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OlpdfEditor } from "./index";

vi.mock("@olpdf/embed", () => ({
  OlPDFEmbed: vi.fn().mockImplementation(function () {
    return { on: vi.fn(), destroy: vi.fn() };
  }),
}));

describe("OlpdfEditor", () => {
  it("mounts without crashing", () => {
    const { container } = render(<OlpdfEditor host="https://olpdf.test" documentId="doc_1" token="token" />);
    expect(container).toBeTruthy();
  });
});
