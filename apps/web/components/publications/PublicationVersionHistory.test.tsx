import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PublicationVersionHistory from "./PublicationVersionHistory";

vi.mock("@/lib/publications", () => ({
  listPublicationVersions: vi.fn(async () => [
    { slug: "abc", version: 2, title: "Doc", description: "", visibility: "unlisted", snapshot: { blocks: [{ id: "a" }, { id: "b" }] }, published_at: "2026-05-15T10:00:00Z", artifact_links: [], status: "published" },
    { slug: "abc", version: 1, title: "Doc", description: "", visibility: "unlisted", snapshot: { blocks: [{ id: "a" }] }, published_at: "2026-05-15T09:00:00Z", artifact_links: [], status: "published" },
  ]),
  createPublicationVersion: vi.fn(async () => ({ slug: "abc", version: 3, url: "/p/abc", title: "Doc", visibility: "unlisted", status: "published", artifact_count: 0 })),
}));

describe("PublicationVersionHistory", () => {
  it("renders versions with diff summary", async () => {
    render(<PublicationVersionHistory slug="abc" currentSourceId="doc-1" />);
    expect(await screen.findByText("Version 2")).toBeTruthy();
    expect(screen.getByText("+1 block")).toBeTruthy();
  });

  it("rolls back by creating a new version from an older snapshot", async () => {
    render(<PublicationVersionHistory slug="abc" currentSourceId="doc-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /restore version 1/i }));
    await waitFor(() => expect(screen.getByText(/restored as version 3/i)).toBeTruthy());
  });
});
