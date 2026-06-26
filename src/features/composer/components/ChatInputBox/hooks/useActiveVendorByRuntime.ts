import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getClaudeProviders,
  getCodexProviders,
  reloadCodexRuntimeConfig,
  switchClaudeProvider,
  switchCodexProvider,
} from '../../../../../services/tauri';
import type { ProviderId } from '../types';
import { LOCAL_SETTINGS_PROVIDER_ID } from '../../../../vendors/types';

export type ActiveVendorByRuntime = Partial<Record<ProviderId, string>>;

export type RuntimeVendorOption = {
  id: string;
  label: string;
  isActive: boolean;
};

export type RuntimeVendorOptionsByProvider = Partial<Record<ProviderId, RuntimeVendorOption[]>>;

type RuntimeVendorSnapshot = {
  activeVendorByProvider: ActiveVendorByRuntime;
  runtimeVendorOptions: RuntimeVendorOptionsByProvider;
};

type ClaudeProviderLike = {
  id?: string;
  name?: string;
  isActive?: boolean;
  isLocalProvider?: boolean;
};

type CodexProviderLike = {
  id?: string;
  name?: string;
  isActive?: boolean;
};

let cachedSnapshot: RuntimeVendorSnapshot | null = null;
let cachedLocalProviderLabel = '';
let inflightSnapshotPromise: Promise<RuntimeVendorSnapshot> | null = null;

function resolveClaudeVendorName(
  providers: ClaudeProviderLike[],
  localProviderLabel: string,
): string | undefined {
  const active = providers.find((provider) => provider?.isActive);
  if (!active) {
    return undefined;
  }
  if (active.isLocalProvider || active.id === LOCAL_SETTINGS_PROVIDER_ID) {
    return localProviderLabel;
  }
  const name = active.name?.trim();
  return name && name.length > 0 ? name : undefined;
}

function resolveCodexVendorName(providers: CodexProviderLike[]): string | undefined {
  const active = providers.find((provider) => provider?.isActive);
  const name = active?.name?.trim();
  return name && name.length > 0 ? name : undefined;
}

function mapClaudeVendorOptions(
  providers: ClaudeProviderLike[],
  localProviderLabel: string,
): RuntimeVendorOption[] {
  return providers
    .map((provider) => {
      const id = provider.id?.trim() ?? '';
      if (!id) {
        return null;
      }
      const isLocalProvider = provider.isLocalProvider || id === LOCAL_SETTINGS_PROVIDER_ID;
      const label = isLocalProvider
        ? localProviderLabel
        : provider.name?.trim() || id;
      return {
        id,
        label,
        isActive: Boolean(provider.isActive),
      };
    })
    .filter((option): option is RuntimeVendorOption => Boolean(option));
}

function mapCodexVendorOptions(providers: CodexProviderLike[]): RuntimeVendorOption[] {
  return providers
    .map((provider) => {
      const id = provider.id?.trim() ?? '';
      if (!id) {
        return null;
      }
      return {
        id,
        label: provider.name?.trim() || id,
        isActive: Boolean(provider.isActive),
      };
    })
    .filter((option): option is RuntimeVendorOption => Boolean(option));
}

async function fetchRuntimeVendorSnapshot(
  localProviderLabel: string,
): Promise<RuntimeVendorSnapshot> {
  const [claudeResult, codexResult] = await Promise.allSettled([
    getClaudeProviders() as Promise<ClaudeProviderLike[]>,
    getCodexProviders() as Promise<CodexProviderLike[]>,
  ]);

  const nextActive: ActiveVendorByRuntime = {};
  const nextOptions: RuntimeVendorOptionsByProvider = {};

  if (claudeResult.status === 'fulfilled') {
    const providers = claudeResult.value ?? [];
    const name = resolveClaudeVendorName(providers, localProviderLabel);
    if (name) {
      nextActive.claude = name;
    }
    nextOptions.claude = mapClaudeVendorOptions(providers, localProviderLabel);
  }

  if (codexResult.status === 'fulfilled') {
    const providers = codexResult.value ?? [];
    const name = resolveCodexVendorName(providers);
    if (name) {
      nextActive.codex = name;
    }
    nextOptions.codex = mapCodexVendorOptions(providers);
  }

  return {
    activeVendorByProvider: nextActive,
    runtimeVendorOptions: nextOptions,
  };
}

function loadRuntimeVendorSnapshot(
  localProviderLabel: string,
  forceRefresh = false,
): Promise<RuntimeVendorSnapshot> {
  if (
    !forceRefresh &&
    cachedSnapshot &&
    cachedLocalProviderLabel === localProviderLabel
  ) {
    return Promise.resolve(cachedSnapshot);
  }

  if (!forceRefresh && inflightSnapshotPromise) {
    return inflightSnapshotPromise;
  }

  inflightSnapshotPromise = fetchRuntimeVendorSnapshot(localProviderLabel)
    .then((snapshot) => {
      cachedSnapshot = snapshot;
      cachedLocalProviderLabel = localProviderLabel;
      return snapshot;
    })
    .finally(() => {
      inflightSnapshotPromise = null;
    });

  return inflightSnapshotPromise;
}

export function useActiveVendorByRuntime(): {
  activeVendorByProvider: ActiveVendorByRuntime;
  runtimeVendorOptions: RuntimeVendorOptionsByProvider;
  refresh: () => void;
  switchRuntimeVendor: (providerId: ProviderId, vendorId: string) => Promise<void>;
} {
  const { t } = useTranslation();
  const localProviderLabel = t('settings.vendor.localProviderName');
  const [activeVendorByProvider, setActiveVendorByProvider] =
    useState<ActiveVendorByRuntime>(() => cachedSnapshot?.activeVendorByProvider ?? {});
  const [runtimeVendorOptions, setRuntimeVendorOptions] =
    useState<RuntimeVendorOptionsByProvider>(() => cachedSnapshot?.runtimeVendorOptions ?? {});
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTick((value) => value + 1);
  }, []);

  const switchRuntimeVendor = useCallback(async (providerId: ProviderId, vendorId: string) => {
    if (providerId === 'claude') {
      await switchClaudeProvider(vendorId);
    } else if (providerId === 'codex') {
      await switchCodexProvider(vendorId);
      await reloadCodexRuntimeConfig();
    } else {
      return;
    }

    const snapshot = await loadRuntimeVendorSnapshot(localProviderLabel, true);
    setActiveVendorByProvider(snapshot.activeVendorByProvider);
    setRuntimeVendorOptions(snapshot.runtimeVendorOptions);
    setRefreshTick((value) => value + 1);
  }, [localProviderLabel]);

  useEffect(() => {
    let cancelled = false;

    if (cachedSnapshot) {
      setActiveVendorByProvider(cachedSnapshot.activeVendorByProvider);
      setRuntimeVendorOptions(cachedSnapshot.runtimeVendorOptions);
    }

    const load = async () => {
      const snapshot = await loadRuntimeVendorSnapshot(localProviderLabel, refreshTick > 0);
      if (cancelled) {
        return;
      }
      setActiveVendorByProvider(snapshot.activeVendorByProvider);
      setRuntimeVendorOptions(snapshot.runtimeVendorOptions);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [localProviderLabel, refreshTick]);

  return { activeVendorByProvider, runtimeVendorOptions, refresh, switchRuntimeVendor };
}
