import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicationVersion, listPublicationVersions, unpublishPublication, updatePublicationVisibility } from "./publications";

describe("publications client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists publication versions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ slug: "abc", version: 2 }] }));
    await expect(listPublicationVersions("abc")).resolves.toEqual([{ slug: "abc", version: 2 }]);
    expect(fetch).toHaveBeenCalledWith("/api/bff/publications/abc/versions");
  });

  it("creates publication versions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ slug: "abc", version: 3 }) }));
    await expect(createPublicationVersion("abc", { source_type: "document", source_id: "doc", title: "Doc", snapshot: {} })).resolves.toMatchObject({ version: 3 });
  });

  it("updates visibility", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(updatePublicationVisibility("abc", "public")).resolves.toBeUndefined();
  });

  it("unpublishes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await expect(unpublishPublication("abc")).resolves.toBeUndefined();
  });
});
