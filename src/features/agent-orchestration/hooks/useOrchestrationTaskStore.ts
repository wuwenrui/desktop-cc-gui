import { useEffect, useState } from "react";
import type { OrchestrationTaskStoreData } from "../types";
import { loadOrchestrationTaskStore } from "../utils/taskStore";

const DEFAULT_REFRESH_INTERVAL_MS = 2_000;

function areOrchestrationTaskStoresEqual(
  left: OrchestrationTaskStoreData,
  right: OrchestrationTaskStoreData,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useOrchestrationTaskStore(options?: {
  refreshIntervalMs?: number;
}): OrchestrationTaskStoreData {
  const refreshIntervalMs = options?.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
  const [store, setStore] = useState<OrchestrationTaskStoreData>(() =>
    loadOrchestrationTaskStore(),
  );

  useEffect(() => {
    const refresh = () => {
      const nextStore = loadOrchestrationTaskStore();
      setStore((currentStore) =>
        areOrchestrationTaskStoresEqual(currentStore, nextStore) ? currentStore : nextStore,
      );
    };

    refresh();

    if (refreshIntervalMs <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(refresh, refreshIntervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshIntervalMs]);

  return store;
}
