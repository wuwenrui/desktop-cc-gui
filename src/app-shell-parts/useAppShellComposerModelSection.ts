import { useCallback, useEffect, useMemo, useState } from "react";
import { useCollaborationModeSelection } from "../features/collaboration/hooks/useCollaborationModeSelection";
import { useComposerMenuActions } from "../features/composer/hooks/useComposerMenuActions";
import { useComposerShortcuts } from "../features/composer/hooks/useComposerShortcuts";
import { usePersistComposerSettings } from "../features/app/hooks/usePersistComposerSettings";
import {
  getEffectiveModels,
  getEffectiveReasoningOptions,
  getEffectiveReasoningSupported,
  getEffectiveSelectedEffort,
  getEffectiveSelectedModelId,
  getNextEngineSelectedModelId,
  getReasoningOptionsForModel,
  upsertEngineSelectedModelId,
} from "./modelSelection";

export function useAppShellComposerModelSection({
  accessMode,
  activeEngine,
  activeThreadId,
  activeWorkspaceId,
  appSettings,
  appSettingsLoading,
  applySelectedCollaborationMode,
  collaborationModes,
  composerInputRef,
  composerSelectionResolverRef,
  engineModelCatalogsAsOptions,
  engineModelsAsOptions,
  globalSelectionReady,
  handleSelectComposerSelection,
  handleSetAccessMode,
  models,
  modelsReady,
  persistComposerSelectionForThread,
  queueSaveSettings,
  selectedCollaborationMode,
  selectedCollaborationModeId,
  selectedComposerSelection,
  selectedEffort,
  selectedModelId,
  setAppSettings,
  setSelectedEffort,
  setSelectedModelId,
}: any) {
  const [engineSelectedModelIdByType, setEngineSelectedModelIdByType] =
    useState<Record<string, string | null>>({});
  const activeEngineSelectedModelId = engineSelectedModelIdByType[activeEngine] ?? null;
  const effectiveModels = useMemo(() => {
    return getEffectiveModels(activeEngine, models, engineModelsAsOptions);
  }, [activeEngine, models, engineModelsAsOptions]);
  const providerModelCatalogs = useMemo(
    () => ({
      ...(engineModelCatalogsAsOptions ?? {}),
      codex: models,
    }),
    [engineModelCatalogsAsOptions, models],
  );

  useEffect(() => {
    const nextDefault = getNextEngineSelectedModelId({
      activeEngine,
      engineModelsAsOptions,
      currentSelection: activeEngineSelectedModelId,
    });
    if (!nextDefault) {
      return;
    }
    setEngineSelectedModelIdByType((prev) => {
      return upsertEngineSelectedModelId({
        activeEngine,
        nextModelId: nextDefault,
        previousSelectionByEngine: prev,
      });
    });
  }, [activeEngine, engineModelsAsOptions, activeEngineSelectedModelId]);

  const hasActiveComposerThread = activeThreadId !== null;
  const effectiveSelectedModelId = useMemo(() => {
    return getEffectiveSelectedModelId({
      activeEngine,
      selectedModelId,
      activeThreadSelectedModelId: selectedComposerSelection?.modelId ?? null,
      hasActiveThread: hasActiveComposerThread,
      codexModels: models,
      engineModelsAsOptions,
      engineSelectedModelIdByType,
    });
  }, [
    activeEngine,
    models,
    engineModelsAsOptions,
    engineSelectedModelIdByType,
    hasActiveComposerThread,
    selectedComposerSelection,
    selectedModelId,
  ]);
  const effectiveSelectedModel = useMemo(() => {
    return effectiveModels.find((model) => model.id === effectiveSelectedModelId) ?? null;
  }, [effectiveModels, effectiveSelectedModelId]);
  const persistedGlobalComposerModelId = useMemo(() => {
    return getEffectiveSelectedModelId({
      activeEngine: "codex",
      selectedModelId,
      activeThreadSelectedModelId: null,
      hasActiveThread: false,
      codexModels: models,
      engineModelsAsOptions: [],
      engineSelectedModelIdByType: {},
    });
  }, [models, selectedModelId]);
  const persistedGlobalComposerModel = useMemo(() => {
    return (
      models.find((model: any) => model.id === persistedGlobalComposerModelId) ?? null
    );
  }, [models, persistedGlobalComposerModelId]);
  const persistedGlobalComposerReasoningOptions = useMemo(() => {
    return getReasoningOptionsForModel(persistedGlobalComposerModel);
  }, [persistedGlobalComposerModel]);
  const persistedGlobalComposerEffort = useMemo(() => {
    return getEffectiveSelectedEffort({
      activeEngine: "codex",
      hasActiveThread: false,
      selectedEffort,
      activeThreadSelection: null,
      reasoningOptions: persistedGlobalComposerReasoningOptions,
    });
  }, [persistedGlobalComposerReasoningOptions, selectedEffort]);
  const modelReasoningOptions = useMemo(() => {
    return getReasoningOptionsForModel(effectiveSelectedModel);
  }, [effectiveSelectedModel]);
  const effectiveReasoningOptions = useMemo(() => {
    return getEffectiveReasoningOptions(activeEngine, modelReasoningOptions);
  }, [activeEngine, modelReasoningOptions]);
  const effectiveReasoningSupported = useMemo(() => {
    return getEffectiveReasoningSupported(activeEngine, modelReasoningOptions.length > 0);
  }, [activeEngine, modelReasoningOptions.length]);
  const effectiveSelectedEffort = useMemo(() => {
    return getEffectiveSelectedEffort({
      activeEngine,
      hasActiveThread: hasActiveComposerThread,
      selectedEffort,
      activeThreadSelection: selectedComposerSelection,
      reasoningOptions: effectiveReasoningOptions,
    });
  }, [
    activeEngine,
    effectiveReasoningOptions,
    hasActiveComposerThread,
    selectedEffort,
    selectedComposerSelection,
  ]);
  const resolvedModel = effectiveSelectedModel?.model ?? effectiveSelectedModelId ?? null;
  const resolvedModelSource = effectiveSelectedModel?.source ?? "unknown";
  const resolvedEffort = effectiveReasoningSupported ? effectiveSelectedEffort : null;
  const handleSelectModel = useCallback(
    (id: string | null) => {
      if (id === null) {
        return;
      }
      const nextSelectedModel =
        effectiveModels.find((model) => model.id === id) ?? null;
      if (!nextSelectedModel) {
        return;
      }
      const nextSelectedEffort =
        getEffectiveSelectedEffort({
          activeEngine,
          hasActiveThread: hasActiveComposerThread,
          selectedEffort: effectiveSelectedEffort,
          activeThreadSelection:
            hasActiveComposerThread || activeEngine === "claude"
              ? {
                  modelId: nextSelectedModel.id,
                  effort: effectiveSelectedEffort,
                }
              : null,
          reasoningOptions: getEffectiveReasoningOptions(
            activeEngine,
            getReasoningOptionsForModel(nextSelectedModel),
          ),
        });
      if (import.meta.env.DEV) {
        console.info("[model/select]", {
          activeEngine,
          selectedModelId: nextSelectedModel.id,
        });
      }
      if (activeEngine === "codex" && !hasActiveComposerThread) {
        setSelectedModelId(nextSelectedModel.id);
      } else if (activeEngine !== "codex") {
        setEngineSelectedModelIdByType((prev) => ({
          ...prev,
          [activeEngine]: nextSelectedModel.id,
        }));
      }
      handleSelectComposerSelection({
        modelId: nextSelectedModel.id,
        effort: nextSelectedEffort,
      });
    },
    [
      activeEngine,
      effectiveModels,
      effectiveSelectedEffort,
      handleSelectComposerSelection,
      hasActiveComposerThread,
      setSelectedModelId,
    ],
  );
  const handleSelectComposerEffort = useCallback(
    (effort: string | null) => {
      const nextEffort = getEffectiveSelectedEffort({
        activeEngine,
        hasActiveThread: hasActiveComposerThread,
        selectedEffort: effort,
        activeThreadSelection:
          hasActiveComposerThread || activeEngine === "claude"
            ? {
                modelId: effectiveSelectedModelId,
                effort,
              }
            : null,
        reasoningOptions: effectiveReasoningOptions,
      });
      if (activeEngine === "codex" && !hasActiveComposerThread) {
        setSelectedEffort(nextEffort);
      }
      handleSelectComposerSelection({
        modelId: effectiveSelectedModelId,
        effort: nextEffort,
      });
    },
    [
      activeEngine,
      effectiveSelectedModelId,
      effectiveReasoningOptions,
      handleSelectComposerSelection,
      hasActiveComposerThread,
      setSelectedEffort,
    ],
  );
  const { collaborationModePayload } = useCollaborationModeSelection({
    selectedCollaborationMode,
    selectedCollaborationModeId,
    selectedEffort: resolvedEffort,
    resolvedModel,
  });
  const threadAccessMode = accessMode;
  composerSelectionResolverRef.current = {
    id: effectiveSelectedModelId,
    model: resolvedModel,
    source: resolvedModelSource,
    effort: resolvedEffort,
    collaborationMode: collaborationModePayload,
  };
  useEffect(() => {
    if (
      activeEngine !== "codex" ||
      !activeThreadId ||
      !selectedComposerSelection ||
      !modelsReady
    ) {
      return;
    }
    const needsModelRepair =
      selectedComposerSelection.modelId !== null &&
      selectedComposerSelection.modelId !== effectiveSelectedModelId;
    const needsEffortRepair =
      selectedComposerSelection.effort !== effectiveSelectedEffort;
    if (!needsModelRepair && !needsEffortRepair) {
      return;
    }
    persistComposerSelectionForThread(activeWorkspaceId, activeThreadId, {
      modelId: effectiveSelectedModelId,
      effort: effectiveSelectedEffort,
    });
  }, [
    activeEngine,
    activeThreadId,
    activeWorkspaceId,
    effectiveSelectedEffort,
    effectiveSelectedModelId,
    modelsReady,
    persistComposerSelectionForThread,
    selectedComposerSelection,
  ]);
  usePersistComposerSettings({
    enabled: !hasActiveComposerThread,
    appSettingsLoading,
    selectionReady: globalSelectionReady,
    selectedModelId: persistedGlobalComposerModelId,
    selectedEffort: persistedGlobalComposerEffort,
    setAppSettings,
    queueSaveSettings,
  });
  useComposerShortcuts({
    textareaRef: composerInputRef,
    modelShortcut: appSettings.composerModelShortcut,
    accessShortcut: appSettings.composerAccessShortcut,
    reasoningShortcut: appSettings.composerReasoningShortcut,
    collaborationShortcut: appSettings.composerCollaborationShortcut,
    models: effectiveModels,
    collaborationModes,
    selectedModelId: effectiveSelectedModelId,
    onSelectModel: handleSelectModel,
    selectedCollaborationModeId,
    onSelectCollaborationMode: applySelectedCollaborationMode,
    accessMode,
    onSelectAccessMode: handleSetAccessMode,
    reasoningOptions: effectiveReasoningOptions,
    selectedEffort: effectiveSelectedEffort,
    onSelectEffort: handleSelectComposerEffort,
    reasoningSupported: effectiveReasoningSupported,
  });
  useComposerMenuActions({
    models: effectiveModels,
    selectedModelId: effectiveSelectedModelId,
    onSelectModel: handleSelectModel,
    collaborationModes,
    selectedCollaborationModeId,
    onSelectCollaborationMode: applySelectedCollaborationMode,
    accessMode,
    onSelectAccessMode: handleSetAccessMode,
    reasoningOptions: effectiveReasoningOptions,
    selectedEffort: effectiveSelectedEffort,
    onSelectEffort: handleSelectComposerEffort,
    reasoningSupported: effectiveReasoningSupported,
    onFocusComposer: () => composerInputRef.current?.focus(),
  });

  return {
    collaborationModePayload,
    effectiveModels,
    effectiveReasoningOptions,
    effectiveReasoningSupported,
    effectiveSelectedEffort,
    effectiveSelectedModel,
    effectiveSelectedModelId,
    engineSelectedModelIdByType,
    handleSelectComposerEffort,
    handleSelectModel,
    providerModelCatalogs,
    resolvedEffort,
    resolvedModel,
    setEngineSelectedModelIdByType,
    threadAccessMode,
  };
}
