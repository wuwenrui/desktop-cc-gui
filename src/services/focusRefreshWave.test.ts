// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getFocusRefreshWaveDiagnostics,
  registerFocusRefreshSource,
  resetFocusRefreshWaveForTests,
} from "./focusRefreshWave";

describe("focusRefreshWave", () => {
  afterEach(() => {
    resetFocusRefreshWaveForTests();
  });

  it("coalesces focus and visibility refresh into one wave", async () => {
    const refresh = vi.fn();
    const cleanup = registerFocusRefreshSource({
      id: "workspace-refresh",
      owner: "workspace",
      refresh,
    });

    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getFocusRefreshWaveDiagnostics()).toMatchObject({
      activeSourceCount: 1,
      waveCount: 1,
      coalescedCount: 1,
    });

    cleanup();
    expect(getFocusRefreshWaveDiagnostics().activeSourceCount).toBe(0);
  });
});
