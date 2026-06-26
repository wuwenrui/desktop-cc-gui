// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCodexProviders,
  reloadCodexRuntimeConfig,
  switchCodexProvider,
} from "../../../services/tauri";
import { STORAGE_KEYS, type CodexProviderConfig } from "../types";
import {
  mergeCodexProviderCustomModelsIntoStore,
  useCodexProviderManagement,
} from "./useCodexProviderManagement";

vi.mock("../../../services/tauri", () => ({
  getCodexProviders: vi.fn(),
  addCodexProvider: vi.fn(),
  updateCodexProvider: vi.fn(),
  deleteCodexProvider: vi.fn(),
  reloadCodexRuntimeConfig: vi.fn(),
  switchCodexProvider: vi.fn(),
}));

function codexProvider(
  id: string,
  options: Partial<CodexProviderConfig> = {},
): CodexProviderConfig {
  return {
    id,
    name: `Provider ${id.toUpperCase()}`,
    ...options,
  };
}

describe("useCodexProviderManagement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    vi.mocked(getCodexProviders).mockResolvedValue([]);
    vi.mocked(switchCodexProvider).mockResolvedValue(undefined);
  });

  it("switches provider profile without reloading the active Codex runtime", async () => {
    const providers = [codexProvider("a"), codexProvider("b", { isActive: true })];
    vi.mocked(getCodexProviders).mockResolvedValue(providers);

    const { result } = renderHook(() => useCodexProviderManagement());
    await waitFor(() => {
      expect(result.current.codexProviders).toEqual(providers);
    });

    await act(async () => {
      await result.current.handleSwitchCodexProvider("a");
    });

    expect(switchCodexProvider).toHaveBeenCalledWith("a");
    expect(reloadCodexRuntimeConfig).not.toHaveBeenCalled();
  });

  it("merges provider custom models into the composer-visible Codex model store", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CODEX_CUSTOM_MODELS,
      JSON.stringify([{ id: "shared-model", label: "Global Label" }]),
    );
    const storageChangeListener = vi.fn();
    window.addEventListener("localStorageChange", storageChangeListener);

    mergeCodexProviderCustomModelsIntoStore([
      codexProvider("a", {
        customModels: [
          { id: "shared-model", label: "Provider Label" },
          { id: "provider-only", label: "Provider Only" },
        ],
      }),
    ]);

    const storedModels = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.CODEX_CUSTOM_MODELS) ?? "[]",
    );

    expect(storedModels).toEqual([
      {
        id: "shared-model",
        label: "Global Label",
        providerProfileId: "a",
      },
      {
        id: "provider-only",
        label: "Provider Only",
        providerProfileId: "a",
      },
    ]);
    expect(storageChangeListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { key: STORAGE_KEYS.CODEX_CUSTOM_MODELS },
      }),
    );
    window.removeEventListener("localStorageChange", storageChangeListener);
  });

  it("enriches existing provider custom models with a unique provider origin", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CODEX_CUSTOM_MODELS,
      JSON.stringify([{ id: "provider-only", label: "Existing Provider Label" }]),
    );

    mergeCodexProviderCustomModelsIntoStore([
      codexProvider("a", {
        customModels: [{ id: "provider-only", label: "Provider Only" }],
      }),
    ]);

    const storedModels = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.CODEX_CUSTOM_MODELS) ?? "[]",
    );

    expect(storedModels).toEqual([
      {
        id: "provider-only",
        label: "Existing Provider Label",
        providerProfileId: "a",
      },
    ]);
  });

  it("does not enrich existing custom models when provider origin is ambiguous", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CODEX_CUSTOM_MODELS,
      JSON.stringify([{ id: "shared-provider-model", label: "Shared Model" }]),
    );

    mergeCodexProviderCustomModelsIntoStore([
      codexProvider("a", {
        customModels: [{ id: "shared-provider-model", label: "Provider A" }],
      }),
      codexProvider("b", {
        customModels: [{ id: "shared-provider-model", label: "Provider B" }],
      }),
    ]);

    const storedModels = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.CODEX_CUSTOM_MODELS) ?? "[]",
    );

    expect(storedModels).toEqual([
      { id: "shared-provider-model", label: "Shared Model" },
    ]);
  });
});
