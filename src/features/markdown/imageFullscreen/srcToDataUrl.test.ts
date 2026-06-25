import { describe, expect, it, vi } from "vitest";
import { resolveImageViewerSrc } from "./srcToDataUrl";

describe("resolveImageViewerSrc", () => {
  it("passes browser-loadable URLs through without bridge conversion", async () => {
    const bridge = vi.fn();

    await expect(resolveImageViewerSrc("https://example.com/a.png", "ws", bridge)).resolves.toEqual({
      finalSrc: "https://example.com/a.png",
      converted: false,
    });
    await expect(resolveImageViewerSrc("data:image/png;base64,AAAA", "ws", bridge)).resolves.toEqual({
      finalSrc: "data:image/png;base64,AAAA",
      converted: false,
    });
    await expect(resolveImageViewerSrc("asset://localhost/repo/a.png", "ws", bridge)).resolves.toEqual({
      finalSrc: "asset://localhost/repo/a.png",
      converted: false,
    });

    expect(bridge).not.toHaveBeenCalled();
  });

  it("uses the bridge for local image paths when workspaceId is available", async () => {
    const bridge = vi.fn().mockResolvedValue("data:image/png;base64,BBBB");

    await expect(resolveImageViewerSrc("file:///repo/a.png", "ws-1", bridge)).resolves.toEqual({
      finalSrc: "data:image/png;base64,BBBB",
      converted: true,
    });

    expect(bridge).toHaveBeenCalledWith("ws-1", "file:///repo/a.png");
  });

  it("falls back to the original src when local bridge conversion fails", async () => {
    const bridge = vi.fn().mockRejectedValue(new Error("bridge unavailable"));

    await expect(resolveImageViewerSrc("./assets/a.png", "ws-1", bridge)).resolves.toEqual({
      finalSrc: "./assets/a.png",
      converted: false,
    });
  });

  it("does not call the bridge for file URLs without workspaceId", async () => {
    const bridge = vi.fn();

    await expect(resolveImageViewerSrc("file:///repo/a.png", null, bridge)).resolves.toEqual({
      finalSrc: "file:///repo/a.png",
      converted: false,
    });

    expect(bridge).not.toHaveBeenCalled();
  });
});
