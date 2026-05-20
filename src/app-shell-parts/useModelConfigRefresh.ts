import { useCallback, useRef, useState } from "react";
import type { DebugEntry, EngineType } from "../types";
import { refreshCodexModelConfig } from "../features/models/refreshCodexModelConfig";
import { resolveModelConfigEngine } from "./modelConfigEngine";

type UseModelConfigRefreshParams = {
  activeEngine: EngineType;
  addDebugEntry: (entry: DebugEntry) => void;
  refreshEngineModels: (
    engineType: EngineType,
    options?: { forceRefresh?: boolean },
  ) => Promise<void> | void;
  refreshModels: () => Promise<void> | void;
};

export function useModelConfigRefresh({
  activeEngine,
  addDebugEntry,
  refreshEngineModels,
  refreshModels,
}: UseModelConfigRefreshParams) {
  const [modelConfigRefreshingByEngine, setModelConfigRefreshingByEngine] =
    useState<Partial<Record<EngineType, boolean>>>({});
  const modelConfigRefreshInFlightRef =
    useRef<Partial<Record<EngineType, boolean>>>({});

  const handleRefreshModelConfig = useCallback(
    async (providerId?: string) => {
      const targetEngine = resolveModelConfigEngine(providerId, activeEngine);
      if (!targetEngine || modelConfigRefreshInFlightRef.current[targetEngine]) {
        return;
      }
      modelConfigRefreshInFlightRef.current = {
        ...modelConfigRefreshInFlightRef.current,
        [targetEngine]: true,
      };
      setModelConfigRefreshingByEngine((current) => ({
        ...current,
        [targetEngine]: true,
      }));
      addDebugEntry({
        id: `${Date.now()}-model-config-refresh-start`,
        timestamp: Date.now(),
        source: "client",
        label: "model/config refresh start",
        payload: { engine: targetEngine },
      });
      try {
        if (targetEngine === "codex") {
          await refreshCodexModelConfig({ refreshModels });
        } else {
          await refreshEngineModels(targetEngine, { forceRefresh: true });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addDebugEntry({
          id: `${Date.now()}-model-config-refresh-error`,
          timestamp: Date.now(),
          source: "error",
          label: "model/config refresh error",
          payload: { engine: targetEngine, error: message },
        });
        throw error;
      } finally {
        modelConfigRefreshInFlightRef.current = {
          ...modelConfigRefreshInFlightRef.current,
          [targetEngine]: false,
        };
        setModelConfigRefreshingByEngine((current) => ({
          ...current,
          [targetEngine]: false,
        }));
      }
    },
    [activeEngine, addDebugEntry, refreshEngineModels, refreshModels],
  );

  return {
    handleRefreshModelConfig,
    isModelConfigRefreshing: Boolean(modelConfigRefreshingByEngine[activeEngine]),
  };
}
