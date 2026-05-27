import { useCallback, useEffect, useState } from "react";
import type { CodexCustomModel } from "../types";
import { STORAGE_KEYS, validateCodexCustomModels } from "../types";
import { normalizeClaudeCustomModels } from "../../models/claudeCustomModels";

const LEGACY_STORAGE_KEY_ALIASES: Record<string, string[]> = {
  "claude-custom-models": [
    "mossx-claude-custom-models",
    "codemoss-claude-custom-models",
  ],
  "codex-custom-models": [
    "mossx-codex-custom-models",
    "codemoss-codex-custom-models",
  ],
  "gemini-custom-models": [
    "mossx-gemini-custom-models",
    "codemoss-gemini-custom-models",
  ],
};

function parseModels(storageKey: string, value: string | null): CodexCustomModel[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (storageKey === STORAGE_KEYS.CLAUDE_CUSTOM_MODELS) {
      return normalizeClaudeCustomModels(parsed).map((model) => ({
        id: model.id,
        label: model.label,
        description: model.description,
      }));
    }
    return validateCodexCustomModels(parsed);
  } catch {
    return [];
  }
}

function readPluginModels(storageKey: string): CodexCustomModel[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  const canonicalRaw = window.localStorage.getItem(storageKey);
  const canonical = parseModels(storageKey, canonicalRaw);
  if (canonicalRaw !== null) {
    return canonical;
  }

  const legacyKeys = LEGACY_STORAGE_KEY_ALIASES[storageKey] ?? [];
  for (const legacyKey of legacyKeys) {
    const legacyModels = parseModels(storageKey, window.localStorage.getItem(legacyKey));
    if (legacyModels.length === 0) {
      continue;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(legacyModels));
      window.dispatchEvent(
        new CustomEvent("localStorageChange", { detail: { key: storageKey } }),
      );
    } catch {
      // ignore migration write failure
    }
    return legacyModels;
  }
  return [];
}

function writePluginModels(storageKey: string, models: CodexCustomModel[]) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(models));
    window.dispatchEvent(
      new CustomEvent("localStorageChange", { detail: { key: storageKey } }),
    );
  } catch {
    // ignore localStorage write errors
  }
}

export function usePluginModels(storageKey: string) {
  const [models, setModels] = useState<CodexCustomModel[]>(() =>
    readPluginModels(storageKey),
  );

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setModels(readPluginModels(storageKey));
      }
    };
    const handleCustomChange = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key === storageKey) {
        setModels(readPluginModels(storageKey));
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("localStorageChange", handleCustomChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("localStorageChange", handleCustomChange);
    };
  }, [storageKey]);

  const updateModels = useCallback(
    (nextModels: CodexCustomModel[]) => {
      setModels(nextModels);
      writePluginModels(storageKey, nextModels);
    },
    [storageKey],
  );

  return {
    models,
    updateModels,
  };
}
