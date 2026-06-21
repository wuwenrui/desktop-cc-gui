import { useState, useCallback, useEffect } from "react";
import type { ClaudeCurrentConfig, ProviderConfig } from "../types";
import { LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import {
  getClaudeProviders,
  addClaudeProvider,
  updateClaudeProvider,
  deleteClaudeProvider,
  switchClaudeProvider,
  reorderClaudeProviders,
  getCurrentClaudeConfig,
} from "../../../services/tauri";
import { STORAGE_KEYS } from "../../models/constants";

export interface ProviderDialogState {
  isOpen: boolean;
  provider: ProviderConfig | null;
}

export interface DeleteConfirmState {
  isOpen: boolean;
  provider: ProviderConfig | null;
}

export function useProviderManagement() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<ClaudeCurrentConfig | null>(
    null,
  );
  const [currentConfigLoading, setCurrentConfigLoading] = useState(false);

  const [providerDialog, setProviderDialog] = useState<ProviderDialogState>({
    isOpen: false,
    provider: null,
  });

  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    isOpen: false,
    provider: null,
  });

  const syncActiveProviderModelMapping = useCallback(
    (provider?: ProviderConfig | null) => {
      if (typeof window === "undefined" || !window.localStorage) return;
      const storageKey = STORAGE_KEYS.CLAUDE_MODEL_MAPPING;
      const legacyStorageKeys = [
        "mossx-claude-model-mapping",
        "codemoss-claude-model-mapping",
      ];
      if (!provider?.settingsConfig?.env) {
        try {
          window.localStorage.removeItem(storageKey);
          for (const key of legacyStorageKeys) {
            window.localStorage.removeItem(key);
          }
          window.dispatchEvent(
            new CustomEvent("localStorageChange", {
              detail: { key: storageKey },
            }),
          );
          for (const key of legacyStorageKeys) {
            window.dispatchEvent(
              new CustomEvent("localStorageChange", {
                detail: { key },
              }),
            );
          }
        } catch {
          // ignore
        }
        return;
      }
      const env = provider.settingsConfig.env as Record<string, any>;
      const mapping = {
        main: env.ANTHROPIC_MODEL ?? "",
        haiku: env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? "",
        sonnet: env.ANTHROPIC_DEFAULT_SONNET_MODEL ?? "",
        opus: env.ANTHROPIC_DEFAULT_OPUS_MODEL ?? "",
      };
      const hasValue = Object.values(mapping).some(
        (v) => v && String(v).trim().length > 0,
      );
      try {
        if (hasValue) {
          const serialized = JSON.stringify(mapping);
          window.localStorage.setItem(storageKey, serialized);
          for (const key of legacyStorageKeys) {
            window.localStorage.setItem(key, serialized);
          }
          // Dispatch custom event so useModels picks it up in the same tab
          window.dispatchEvent(
            new CustomEvent("localStorageChange", {
              detail: { key: storageKey },
            }),
          );
          for (const key of legacyStorageKeys) {
            window.dispatchEvent(
              new CustomEvent("localStorageChange", {
                detail: { key },
              }),
            );
          }
        } else {
          window.localStorage.removeItem(storageKey);
          for (const key of legacyStorageKeys) {
            window.localStorage.removeItem(key);
          }
          window.dispatchEvent(
            new CustomEvent("localStorageChange", {
              detail: { key: storageKey },
            }),
          );
          for (const key of legacyStorageKeys) {
            window.dispatchEvent(
              new CustomEvent("localStorageChange", {
                detail: { key },
              }),
            );
          }
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getClaudeProviders();
      setProviders(list);
      const active = list.find((p: ProviderConfig) => p.isActive);
      syncActiveProviderModelMapping(active ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [syncActiveProviderModelMapping]);

  const loadCurrentConfig = useCallback(async () => {
    setCurrentConfigLoading(true);
    try {
      const config = await getCurrentClaudeConfig();
      setCurrentConfig(config as ClaudeCurrentConfig);
    } catch {
      setCurrentConfig(null);
    } finally {
      setCurrentConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadProviders(), loadCurrentConfig()]);
  }, [loadProviders, loadCurrentConfig]);

  const handleEditProvider = useCallback((provider: ProviderConfig) => {
    setProviderDialog({ isOpen: true, provider });
  }, []);

  const handleAddProvider = useCallback(() => {
    setProviderDialog({ isOpen: true, provider: null });
  }, []);

  const handleCloseProviderDialog = useCallback(() => {
    setProviderDialog({ isOpen: false, provider: null });
  }, []);

  const handleSaveProvider = useCallback(
    async (data: {
      providerName: string;
      remark: string;
      apiKey: string;
      apiUrl: string;
      jsonConfig: string;
    }) => {
      if (!data.providerName) return false;

      let parsedConfig;
      try {
        parsedConfig = JSON.parse(data.jsonConfig || "{}");
      } catch {
        return false;
      }

      const updates = {
        name: data.providerName,
        remark: data.remark,
        websiteUrl: null,
        settingsConfig: parsedConfig,
      };

      const isAdding = !providerDialog.provider;

      try {
        if (isAdding) {
          const newProvider = {
            id: crypto.randomUUID
              ? crypto.randomUUID()
              : Date.now().toString(),
            ...updates,
          };
          await addClaudeProvider(newProvider);
        } else {
          const providerId = providerDialog.provider!.id;
          const currentProvider =
            providers.find((p) => p.id === providerId) ||
            providerDialog.provider!;
          const isActive = currentProvider.isActive;

          await updateClaudeProvider(providerId, {
            ...currentProvider,
            ...updates,
          });

          if (isActive) {
            syncActiveProviderModelMapping({
              ...currentProvider,
              settingsConfig: parsedConfig,
            });
          }
        }

        setProviderDialog({ isOpen: false, provider: null });
        await Promise.all([loadProviders(), loadCurrentConfig()]);
        return true;
      } catch {
        return false;
      }
    },
    [
      providerDialog.provider,
      providers,
      syncActiveProviderModelMapping,
      loadProviders,
      loadCurrentConfig,
    ],
  );

  const handleSwitchProvider = useCallback(
    async (id: string) => {
      try {
        await switchClaudeProvider(id);
        // Sync model mapping only after backend succeeds
        const target = providers.find((p) => p.id === id);
        if (target) {
          syncActiveProviderModelMapping(target);
        }
        await Promise.all([loadProviders(), loadCurrentConfig()]);
      } catch {
        // ignore
      }
    },
    [providers, syncActiveProviderModelMapping, loadProviders, loadCurrentConfig],
  );

  const handleReorderProviders = useCallback(
    async (orderedIds: string[]) => {
      const localProviders = providers.filter(
        (provider) =>
          provider.id === LOCAL_SETTINGS_PROVIDER_ID || provider.isLocalProvider,
      );
      const regularById = new Map(
        providers
          .filter(
            (provider) =>
              provider.id !== LOCAL_SETTINGS_PROVIDER_ID &&
              !provider.isLocalProvider,
          )
          .map((provider) => [provider.id, provider]),
      );
      const orderedRegularProviders = orderedIds
        .map((id) => regularById.get(id))
        .filter((provider): provider is ProviderConfig => Boolean(provider));

      setProviders([...localProviders, ...orderedRegularProviders]);

      try {
        await reorderClaudeProviders(orderedIds);
        // Success: the optimistic order already matches what the backend
        // persisted (reorder only writes sortOrder, never changes the active
        // provider), so keep it as-is. Refetching here would toggle the loading
        // flag and replace every provider object reference right after the drop
        // settles, causing a visible flicker on each reorder.
      } catch {
        // Persistence failed: reload from backend to roll back the optimistic order.
        await loadProviders();
      }
    },
    [providers, loadProviders],
  );

  const handleDeleteProvider = useCallback((provider: ProviderConfig) => {
    setDeleteConfirm({ isOpen: true, provider });
  }, []);

  const confirmDeleteProvider = useCallback(async () => {
    const provider = deleteConfirm.provider;
    if (!provider) return;

    try {
      await deleteClaudeProvider(provider.id);
      await Promise.all([loadProviders(), loadCurrentConfig()]);
    } catch {
      // ignore
    }
    setDeleteConfirm({ isOpen: false, provider: null });
  }, [deleteConfirm.provider, loadProviders, loadCurrentConfig]);

  const cancelDeleteProvider = useCallback(() => {
    setDeleteConfirm({ isOpen: false, provider: null });
  }, []);

  return {
    providers,
    loading,
    currentConfig,
    currentConfigLoading,
    providerDialog,
    deleteConfirm,
    loadProviders,
    loadCurrentConfig,
    handleEditProvider,
    handleAddProvider,
    handleCloseProviderDialog,
    handleSaveProvider,
    handleSwitchProvider,
    handleReorderProviders,
    handleDeleteProvider,
    confirmDeleteProvider,
    cancelDeleteProvider,
  };
}

export type UseProviderManagementReturn = ReturnType<
  typeof useProviderManagement
>;
