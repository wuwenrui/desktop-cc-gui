import { useState, useCallback, useEffect } from "react";
import {
  STORAGE_KEYS,
  validateCodexCustomModels,
  type CodexProviderConfig,
  type CodexCustomModel,
} from "../types";
import {
  getCodexProviders,
  addCodexProvider,
  updateCodexProvider,
  deleteCodexProvider,
  switchCodexProvider,
} from "../../../services/tauri";

export interface CodexProviderDialogState {
  isOpen: boolean;
  provider: CodexProviderConfig | null;
}

export interface DeleteCodexConfirmState {
  isOpen: boolean;
  provider: CodexProviderConfig | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  return fallback;
}

function readStoredCodexCustomModels(): CodexCustomModel[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  const rawValue = window.localStorage.getItem(STORAGE_KEYS.CODEX_CUSTOM_MODELS);
  if (!rawValue) {
    return [];
  }
  try {
    return validateCodexCustomModels(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

function normalizeProviderCustomModels(
  providers: CodexProviderConfig[],
): CodexCustomModel[] {
  const mergedModels: CodexCustomModel[] = [];
  const seenIds = new Set<string>();

  for (const provider of providers) {
    const providerModels = validateCodexCustomModels(provider.customModels ?? []);
    for (const providerModel of providerModels) {
      const id = providerModel.id.trim();
      if (!id || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      const label = providerModel.label?.trim() || id;
      const description = providerModel.description?.trim();
      const providerProfileId = provider.id.trim();
      mergedModels.push({
        id,
        label,
        description:
          description && description.length > 0 ? description : undefined,
        providerProfileId:
          providerProfileId.length > 0 ? providerProfileId : undefined,
      });
    }
  }

  return mergedModels;
}

function indexProviderModelOrigins(
  providers: CodexProviderConfig[],
): Map<string, string> {
  const originsByModelId = new Map<string, string>();
  const ambiguousModelIds = new Set<string>();

  for (const provider of providers) {
    const providerProfileId = provider.id.trim();
    if (!providerProfileId) {
      continue;
    }
    const providerModels = validateCodexCustomModels(provider.customModels ?? []);
    for (const providerModel of providerModels) {
      const id = providerModel.id.trim();
      if (!id) {
        continue;
      }
      const existingProviderProfileId = originsByModelId.get(id);
      if (
        existingProviderProfileId &&
        existingProviderProfileId !== providerProfileId
      ) {
        ambiguousModelIds.add(id);
        originsByModelId.delete(id);
        continue;
      }
      if (!ambiguousModelIds.has(id)) {
        originsByModelId.set(id, providerProfileId);
      }
    }
  }

  return originsByModelId;
}

export function mergeCodexProviderCustomModelsIntoStore(
  providers: CodexProviderConfig[],
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const providerModels = normalizeProviderCustomModels(providers);
  if (providerModels.length === 0) {
    return;
  }

  const storedModels = readStoredCodexCustomModels();
  const providerOriginByModelId = indexProviderModelOrigins(providers);
  const enrichedStoredModels = storedModels.map((model) => {
    if (model.providerProfileId?.trim()) {
      return model;
    }
    const providerProfileId = providerOriginByModelId.get(model.id.trim());
    return providerProfileId ? { ...model, providerProfileId } : model;
  });
  const storedIds = new Set(storedModels.map((model) => model.id.trim()));
  const missingProviderModels = providerModels.filter(
    (model) => !storedIds.has(model.id.trim()),
  );

  const didEnrichStoredModels = enrichedStoredModels.some(
    (model, index) =>
      model.providerProfileId !== storedModels[index]?.providerProfileId,
  );
  if (missingProviderModels.length === 0 && !didEnrichStoredModels) {
    return;
  }

  const nextModels = [...enrichedStoredModels, ...missingProviderModels];
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.CODEX_CUSTOM_MODELS,
      JSON.stringify(nextModels),
    );
    window.dispatchEvent(
      new CustomEvent("localStorageChange", {
        detail: { key: STORAGE_KEYS.CODEX_CUSTOM_MODELS },
      }),
    );
  } catch {
    // localStorage can be unavailable in restricted WebViews; provider save still succeeds.
  }
}

export function useCodexProviderManagement() {
  const [codexProviders, setCodexProviders] = useState<CodexProviderConfig[]>(
    [],
  );
  const [codexLoading, setCodexLoading] = useState(false);
  const [codexProviderError, setCodexProviderError] = useState<string | null>(null);

  const [codexProviderDialog, setCodexProviderDialog] =
    useState<CodexProviderDialogState>({
      isOpen: false,
      provider: null,
    });

  const [deleteCodexConfirm, setDeleteCodexConfirm] =
    useState<DeleteCodexConfirmState>({
      isOpen: false,
      provider: null,
    });

  const loadCodexProviders = useCallback(async () => {
    setCodexLoading(true);
    try {
      const list = await getCodexProviders();
      setCodexProviders(list);
      mergeCodexProviderCustomModelsIntoStore(list);
      setCodexProviderError(null);
    } catch (error) {
      setCodexProviderError(
        getErrorMessage(error, "Failed to load Codex providers."),
      );
    } finally {
      setCodexLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCodexProviders();
  }, [loadCodexProviders]);

  const handleAddCodexProvider = useCallback(() => {
    setCodexProviderDialog({ isOpen: true, provider: null });
  }, []);

  const handleEditCodexProvider = useCallback(
    (provider: CodexProviderConfig) => {
      setCodexProviderDialog({ isOpen: true, provider });
    },
    [],
  );

  const handleCloseCodexProviderDialog = useCallback(() => {
    setCodexProviderDialog({ isOpen: false, provider: null });
  }, []);

  const handleSaveCodexProvider = useCallback(
    async (providerData: CodexProviderConfig) => {
      const isAdding = !codexProviderDialog.provider;

      try {
        if (isAdding) {
          await addCodexProvider(providerData);
        } else {
          await updateCodexProvider(providerData.id, providerData);
        }

        setCodexProviderDialog({ isOpen: false, provider: null });
        setCodexProviderError(null);
        await loadCodexProviders();
      } catch (error) {
        setCodexProviderError(
          getErrorMessage(error, "Failed to save Codex provider."),
        );
      }
    },
    [codexProviderDialog.provider, loadCodexProviders],
  );

  const handleSwitchCodexProvider = useCallback(
    async (id: string) => {
      try {
        await switchCodexProvider(id);
        setCodexProviderError(null);
        await loadCodexProviders();
      } catch (error) {
        setCodexProviderError(
          getErrorMessage(error, "Failed to switch Codex provider."),
        );
      }
    },
    [loadCodexProviders],
  );

  const handleDeleteCodexProvider = useCallback(
    (provider: CodexProviderConfig) => {
      setDeleteCodexConfirm({ isOpen: true, provider });
    },
    [],
  );

  const confirmDeleteCodexProvider = useCallback(async () => {
    const provider = deleteCodexConfirm.provider;
    if (!provider) return;

    try {
      await deleteCodexProvider(provider.id);
      setCodexProviderError(null);
      await loadCodexProviders();
    } catch (error) {
      setCodexProviderError(
        getErrorMessage(error, "Failed to delete Codex provider."),
      );
    }
    setDeleteCodexConfirm({ isOpen: false, provider: null });
  }, [deleteCodexConfirm.provider, loadCodexProviders]);

  const cancelDeleteCodexProvider = useCallback(() => {
    setDeleteCodexConfirm({ isOpen: false, provider: null });
  }, []);

  return {
    codexProviders,
    codexLoading,
    codexProviderError,
    codexProviderDialog,
    deleteCodexConfirm,
    loadCodexProviders,
    handleAddCodexProvider,
    handleEditCodexProvider,
    handleCloseCodexProviderDialog,
    handleSaveCodexProvider,
    handleSwitchCodexProvider,
    handleDeleteCodexProvider,
    confirmDeleteCodexProvider,
    cancelDeleteCodexProvider,
  };
}

export type UseCodexProviderManagementReturn = ReturnType<
  typeof useCodexProviderManagement
>;
