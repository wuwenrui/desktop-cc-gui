// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClaudeProviders,
  getCurrentClaudeConfig,
  reorderClaudeProviders,
} from "../../../services/tauri";
import type { ProviderConfig } from "../types";
import { LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import { useProviderManagement } from "./useProviderManagement";

vi.mock("../../../services/tauri", () => ({
  getClaudeProviders: vi.fn(),
  getCurrentClaudeConfig: vi.fn(),
  addClaudeProvider: vi.fn(),
  updateClaudeProvider: vi.fn(),
  deleteClaudeProvider: vi.fn(),
  switchClaudeProvider: vi.fn(),
  reorderClaudeProviders: vi.fn(),
}));

function provider(
  id: string,
  options: Partial<ProviderConfig> = {},
): ProviderConfig {
  return {
    id,
    name: `Provider ${id.toUpperCase()}`,
    ...options,
  };
}

const localProvider = provider(LOCAL_SETTINGS_PROVIDER_ID, {
  isLocalProvider: true,
});

const initialProviders = [
  localProvider,
  provider("a"),
  provider("b", { isActive: true }),
  provider("c"),
];

describe("useProviderManagement reorder", () => {
  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so a leftover mockResolvedValueOnce in
    // one test cannot leak into the next via the un-drained once-queue.
    vi.resetAllMocks();
    vi.mocked(getCurrentClaudeConfig).mockResolvedValue({
      apiKey: "",
      baseUrl: "",
      authType: "none",
    });
  });

  it("persists reordered provider ids and keeps the optimistic order without refetching", async () => {
    vi.mocked(getClaudeProviders).mockResolvedValue(initialProviders);
    vi.mocked(reorderClaudeProviders).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useProviderManagement());
    await waitFor(() => {
      expect(result.current.providers.map((entry) => entry.id)).toEqual([
        LOCAL_SETTINGS_PROVIDER_ID,
        "a",
        "b",
        "c",
      ]);
    });

    const loadsAfterMount = vi.mocked(getClaudeProviders).mock.calls.length;

    await act(async () => {
      await result.current.handleReorderProviders(["c", "b", "a"]);
    });

    expect(reorderClaudeProviders).toHaveBeenCalledWith(["c", "b", "a"]);
    // No refetch on success: avoids the loading-flag toggle + object-identity
    // churn that caused the drag flicker.
    expect(vi.mocked(getClaudeProviders).mock.calls.length).toEqual(
      loadsAfterMount,
    );
    expect(result.current.providers.map((entry) => entry.id)).toEqual([
      LOCAL_SETTINGS_PROVIDER_ID,
      "c",
      "b",
      "a",
    ]);
  });

  it("reloads providers when reorder persistence fails", async () => {
    vi.mocked(getClaudeProviders)
      .mockResolvedValueOnce(initialProviders)
      .mockResolvedValueOnce(initialProviders);
    vi.mocked(reorderClaudeProviders).mockRejectedValueOnce(
      new Error("write failed"),
    );

    const { result } = renderHook(() => useProviderManagement());
    await waitFor(() => {
      expect(result.current.providers.map((entry) => entry.id)).toEqual([
        LOCAL_SETTINGS_PROVIDER_ID,
        "a",
        "b",
        "c",
      ]);
    });

    await act(async () => {
      await result.current.handleReorderProviders(["c", "b", "a"]);
    });

    expect(reorderClaudeProviders).toHaveBeenCalledWith(["c", "b", "a"]);
    expect(result.current.providers.map((entry) => entry.id)).toEqual([
      LOCAL_SETTINGS_PROVIDER_ID,
      "a",
      "b",
      "c",
    ]);
  });
});
