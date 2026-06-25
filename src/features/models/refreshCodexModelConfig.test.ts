import { describe, expect, it, vi } from "vitest";

import { refreshCodexModelConfig } from "./refreshCodexModelConfig";

describe("refreshCodexModelConfig", () => {
  it("refreshes Codex model catalog without reloading runtime config", async () => {
    const refreshModels = vi.fn(async () => {});

    await refreshCodexModelConfig({ refreshModels });

    expect(refreshModels).toHaveBeenCalledTimes(1);
  });

  it("propagates model catalog refresh failures", async () => {
    const refreshError = new Error("refresh failed");
    const refreshModels = vi.fn(async () => {
      throw refreshError;
    });

    await expect(
      refreshCodexModelConfig({ refreshModels }),
    ).rejects.toThrow(refreshError);

    expect(refreshModels).toHaveBeenCalledTimes(1);
  });
});
