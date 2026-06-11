import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import RefreshCcw from "lucide-react/dist/esm/icons/refresh-ccw";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";

import type { EngineType, WorkspaceInfo } from "../../../types";
import {
  normalizeEngineType,
  useProjectMapGenerationOptions,
} from "../hooks/useProjectMapGenerationOptions";
import type { ProjectMapDataset } from "../types";

export function ProjectMapSettingsPanel({
  activeWorkspace,
  dataset,
  disabled,
  onUpdate,
}: {
  activeWorkspace: WorkspaceInfo | null;
  dataset: ProjectMapDataset;
  disabled: boolean;
  onUpdate: (updater: (dataset: ProjectMapDataset) => ProjectMapDataset) => Promise<void>;
}) {
  const { t } = useTranslation();
  const settings = dataset.autoIngestionSettings;
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [isSavingEnablement, setIsSavingEnablement] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<EngineType>(() =>
    normalizeEngineType(settings.engine),
  );
  const [selectedModel, setSelectedModel] = useState(settings.model);
  const generationOptions = useProjectMapGenerationOptions({
    workspace: activeWorkspace,
    selectedEngine,
  });

  useEffect(() => {
    if (isConfiguratorOpen) {
      return;
    }
    setSelectedEngine(normalizeEngineType(settings.engine));
    setSelectedModel(settings.model);
  }, [isConfiguratorOpen, settings.engine, settings.model]);

  useEffect(() => {
    if (!isConfiguratorOpen || generationOptions.modelsLoading) {
      return;
    }
    if (generationOptions.models.length === 0) {
      setSelectedModel("");
      return;
    }
    const selectedModelStillExists = generationOptions.models.some(
      (model) => model.model === selectedModel || model.id === selectedModel,
    );
    if (selectedModelStillExists) {
      return;
    }
    const defaultModel =
      generationOptions.models.find((model) => model.isDefault) ?? generationOptions.models[0];
    setSelectedModel(defaultModel?.model ?? "");
  }, [generationOptions.models, generationOptions.modelsLoading, isConfiguratorOpen, selectedModel]);

  const selectedModelOption =
    generationOptions.models.find((model) => model.model === selectedModel) ??
    generationOptions.models.find((model) => model.id === selectedModel) ??
    null;
  const canEnableAutoIngestion =
    !disabled &&
    !isSavingEnablement &&
    !generationOptions.modelsLoading &&
    generationOptions.models.length > 0 &&
    Boolean(selectedModelOption);

  const closeConfigurator = () => {
    setIsConfiguratorOpen(false);
    setSelectedEngine(normalizeEngineType(settings.engine));
    setSelectedModel(settings.model);
  };

  return (
    <section className="project-map-settings" aria-label={t("projectMap.settings.title")}>
      <div>
        <strong>{t("projectMap.settings.title")}</strong>
        <span>{t("projectMap.settings.subtitle")}</span>
      </div>
      <label>
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={disabled}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            if (enabled) {
              setSelectedEngine(normalizeEngineType(settings.engine));
              setSelectedModel(settings.model);
              setIsConfiguratorOpen(true);
              return;
            }
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                enabled: false,
              },
            }));
          }}
        />
        {t("projectMap.settings.autoIngestion")}
      </label>
      <label>
        {t("projectMap.settings.threshold")}
        <input
          type="number"
          aria-label={t("projectMap.settings.threshold")}
          min={1}
          max={50}
          value={settings.newSessionThreshold}
          disabled={disabled}
          onChange={(event) => {
            const nextThreshold = Math.max(1, Math.min(50, Number(event.currentTarget.value) || 5));
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                newSessionThreshold: nextThreshold,
              },
            }));
          }}
        />
        <span className="project-map-settings-unit" aria-hidden>
          {t("projectMap.settings.thresholdUnit")}
        </span>
      </label>
      <label>
        {t("projectMap.settings.interval")}
        <input
          type="number"
          aria-label={t("projectMap.settings.interval")}
          min={5}
          max={1440}
          value={settings.checkIntervalMinutes}
          disabled={disabled}
          onChange={(event) => {
            const nextInterval = Math.max(5, Math.min(1440, Number(event.currentTarget.value) || 30));
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                checkIntervalMinutes: nextInterval,
              },
            }));
          }}
        />
        <span className="project-map-settings-unit" aria-hidden>
          {t("projectMap.settings.intervalUnit")}
        </span>
      </label>
      <label>
        {t("projectMap.settings.applyMode")}
        <select
          value={settings.applyMode}
          disabled={disabled}
          onChange={(event) => {
            const applyMode =
              event.currentTarget.value === "autoApplyEvidenceBacked"
                ? "autoApplyEvidenceBacked"
                : "createCandidate";
            void onUpdate((current) => ({
              ...current,
              autoIngestionSettings: {
                ...current.autoIngestionSettings,
                applyMode,
              },
            }));
          }}
        >
          <option value="createCandidate">{t("projectMap.settings.createCandidate")}</option>
          <option value="autoApplyEvidenceBacked">{t("projectMap.settings.autoApplyEvidenceBacked")}</option>
        </select>
      </label>
      {isConfiguratorOpen ? (
        <div className="project-map-auto-ingestion-popover" role="presentation">
          <section
            className="project-map-auto-ingestion-dialog"
            role="dialog"
            aria-label={t("projectMap.settings.configureAutoIngestion")}
          >
            <header>
              <h3>{t("projectMap.settings.configureAutoIngestion")}</h3>
              <p>{t("projectMap.settings.configureAutoIngestionSubtitle")}</p>
            </header>
            <div className="project-map-auto-ingestion-fields">
              <div className="project-map-auto-ingestion-field">
                <label htmlFor="project-map-auto-ingestion-engine">
                  {t("projectMap.settings.engine")}
                </label>
                <div className="project-map-auto-ingestion-control">
                  <select
                    id="project-map-auto-ingestion-engine"
                    className="project-map-dialog-control"
                    value={selectedEngine}
                    aria-label={t("projectMap.settings.engine")}
                    onChange={(event) => setSelectedEngine(normalizeEngineType(event.currentTarget.value))}
                  >
                    {generationOptions.engines.map((engine) => (
                      <option key={engine.id} value={engine.id} disabled={!engine.installed}>
                        {engine.label}
                      </option>
                    ))}
                  </select>
                  {generationOptions.enginesLoading ? (
                    <span className="project-map-dialog-hint">{t("projectMap.confirmation.loadingEngines")}</span>
                  ) : null}
                  {generationOptions.enginesError ? (
                    <span className="project-map-dialog-warning">{generationOptions.enginesError}</span>
                  ) : null}
                </div>
              </div>
              <div className="project-map-auto-ingestion-field">
                <label htmlFor="project-map-auto-ingestion-model">
                  {t("projectMap.settings.model")}
                </label>
                <div className="project-map-auto-ingestion-control project-map-auto-ingestion-model-control">
                  <div className="project-map-auto-ingestion-model-row">
                    <select
                      id="project-map-auto-ingestion-model"
                      className="project-map-dialog-control"
                      value={selectedModel}
                      aria-label={t("projectMap.settings.model")}
                      onChange={(event) => setSelectedModel(event.currentTarget.value)}
                      disabled={generationOptions.modelsLoading || generationOptions.models.length === 0}
                    >
                      {generationOptions.models.map((model) => (
                        <option key={`${model.id}-${model.model}`} value={model.model}>
                          {model.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="project-map-dialog-refresh"
                      type="button"
                      onClick={() => void generationOptions.refreshModels()}
                      disabled={generationOptions.modelsLoading}
                    >
                      <RefreshCcw aria-hidden />
                      {t("projectMap.confirmation.refreshModels")}
                    </button>
                  </div>
                  {generationOptions.modelsLoading ? (
                    <span className="project-map-dialog-hint">{t("projectMap.confirmation.loadingModels")}</span>
                  ) : null}
                  {!generationOptions.modelsLoading && generationOptions.models.length === 0 ? (
                    <span className="project-map-dialog-warning">
                      {generationOptions.modelsError ?? t("projectMap.confirmation.noModels")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <footer>
              <button type="button" onClick={closeConfigurator} disabled={isSavingEnablement}>
                {t("projectMap.settings.cancelEnable")}
              </button>
              <button
                className="project-map-primary-button"
                type="button"
                disabled={!canEnableAutoIngestion}
                onClick={() => {
                  const resolvedModel = selectedModelOption?.model ?? selectedModel.trim();
                  setIsSavingEnablement(true);
                  void onUpdate((current) => ({
                    ...current,
                    autoIngestionSettings: {
                      ...current.autoIngestionSettings,
                      enabled: true,
                      engine: selectedEngine,
                      model: resolvedModel,
                    },
                  }))
                    .then(() => setIsConfiguratorOpen(false))
                    .finally(() => setIsSavingEnablement(false));
                }}
              >
                <Sparkles aria-hidden />
                {isSavingEnablement
                  ? t("projectMap.settings.enablingAutoIngestion")
                  : t("projectMap.settings.confirmEnable")}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
