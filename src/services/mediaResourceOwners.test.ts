import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOwnedObjectUrl,
  getMediaOwnerDiagnostics,
  resetMediaOwnerRegistryForTests,
  revokeOwnedObjectUrl,
} from "./mediaResourceOwners";

describe("mediaResourceOwners", () => {
  afterEach(() => {
    resetMediaOwnerRegistryForTests();
    vi.restoreAllMocks();
  });

  it("tracks and releases object URLs by owner", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const url = createOwnedObjectUrl(new Blob(["image"], { type: "image/png" }), {
      ownerId: "message-image",
    });

    expect(url).toBe("blob:test");
    expect(getMediaOwnerDiagnostics()).toMatchObject({
      activeCount: 1,
      revokedCount: 0,
      retainedBytes: 5,
      evidenceClass: "proxy",
    });

    expect(revokeOwnedObjectUrl(url)).toBe(true);
    expect(revokeSpy).toHaveBeenCalledWith("blob:test");
    expect(getMediaOwnerDiagnostics()).toMatchObject({
      activeCount: 0,
      revokedCount: 1,
      retainedBytes: 0,
    });
  });
});
