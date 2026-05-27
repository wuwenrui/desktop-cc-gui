// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../types";
import { usePluginModels } from "./usePluginModels";

describe("usePluginModels", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("reads Claude custom models through shape-only normalization", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CLAUDE_CUSTOM_MODELS,
      JSON.stringify([
        { id: "Haiku 4.5", label: "Haiku 4.5" },
        { id: "x".repeat(300), label: "Long Claude Model" },
        { id: "   ", label: "Blank" },
        { label: "Missing id" },
      ]),
    );

    const { result } = renderHook(() =>
      usePluginModels(STORAGE_KEYS.CLAUDE_CUSTOM_MODELS),
    );

    expect(result.current.models).toEqual([
      { id: "Haiku 4.5", label: "Haiku 4.5", description: undefined },
      { id: "x".repeat(300), label: "Long Claude Model", description: undefined },
    ]);
  });

  it("keeps existing validation for non-Claude custom model storage", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CODEX_CUSTOM_MODELS,
      JSON.stringify([
        { id: "gpt-5.4", label: "GPT 5.4" },
        { id: "x".repeat(300), label: "Too Long" },
      ]),
    );

    const { result } = renderHook(() =>
      usePluginModels(STORAGE_KEYS.CODEX_CUSTOM_MODELS),
    );

    expect(result.current.models).toEqual([{ id: "gpt-5.4", label: "GPT 5.4" }]);
  });
});
