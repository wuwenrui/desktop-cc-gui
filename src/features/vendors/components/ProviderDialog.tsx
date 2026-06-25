import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import Shield from "lucide-react/dist/esm/icons/shield";
import { fetchClaudeProviderModels } from "../../../services/tauri";
import type { ProviderConfig } from "../types";
import { CLAUDE_PROVIDER_PRESETS } from "../types";

type ClaudeProviderSettingsTemplate = {
  alwaysThinkingEnabled: boolean;
  autoDreamEnabled: boolean;
  cleanupPeriodDays: number;
  effortLevel: string;
  env: Record<string, string>;
  hasCompletedOnboarding: boolean;
  language: string;
  model: string;
  skipAutoPermissionPrompt: boolean;
  teammateMode: string;
  tui: string;
};

interface ProviderDialogProps {
  isOpen: boolean;
  provider: ProviderConfig | null;
  onClose: () => void;
  onSave: (data: {
    providerName: string;
    remark: string;
    apiKey: string;
    apiUrl: string;
    jsonConfig: string;
  }) => void;
}

export function buildDefaultClaudeProviderSettingsConfig(): ClaudeProviderSettingsTemplate {
  return {
    alwaysThinkingEnabled: true,
    autoDreamEnabled: true,
    cleanupPeriodDays: 720,
    effortLevel: "xhigh",
    env: {
      ANTHROPIC_AUTH_TOKEN: "",
      ANTHROPIC_BASE_URL: "",
      ANTHROPIC_BETAS: "context-1m-2025-08-07",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5-20251001",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus-4-8",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4-6",
      ANTHROPIC_SMALL_FAST_MODEL: "claude-haiku-4-5-20251001",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
      CLAUDE_CODE_NEW_INIT: "1",
      DISABLE_ERROR_REPORTING: "1",
      DISABLE_TELEMETRY: "1",
      ENABLE_TOOL_SEARCH: "1",
      MAX_THINKING_TOKENS: "31999",
      MCP_TIMEOUT: "60000",
    },
    hasCompletedOnboarding: true,
    language: "简体中文",
    model: "opus",
    skipAutoPermissionPrompt: true,
    teammateMode: "in-process",
    tui: "fullscreen",
  };
}

export function defaultConfigJson() {
  return JSON.stringify(buildDefaultClaudeProviderSettingsConfig(), null, 2);
}

export function ProviderDialog({
  isOpen,
  provider,
  onClose,
  onSave,
}: ProviderDialogProps) {
  const { t } = useTranslation();
  const isAdding = !provider;

  const [providerName, setProviderName] = useState("");
  const [remark, setRemark] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [haikuModel, setHaikuModel] = useState("");
  const [sonnetModel, setSonnetModel] = useState("");
  const [opusModel, setOpusModel] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [jsonConfig, setJsonConfig] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [activePreset, setActivePreset] = useState("custom");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState("");

  const resetFetchedModels = () => {
    setFetchedModels([]);
    setIsFetchingModels(false);
    setModelFetchError("");
  };

  const updateEnvField = (key: string, value: string) => {
    try {
      const parsed = jsonConfig ? JSON.parse(jsonConfig) : {};
      const prevEnv = (parsed.env || {}) as Record<string, unknown>;
      const trimmed = value.trim();

      let nextEnv: Record<string, unknown>;
      if (!trimmed) {
        nextEnv = { ...prevEnv };
        delete nextEnv[key];
      } else {
        nextEnv = { ...prevEnv, [key]: value };
      }

      const nextConfig = Object.keys(nextEnv).length > 0
        ? { ...parsed, env: nextEnv }
        : Object.fromEntries(Object.entries(parsed).filter(([configKey]) => configKey !== "env"));

      setJsonConfig(JSON.stringify(nextConfig, null, 2));
      setJsonError("");
    } catch {
      // ignore
    }
  };

  const detectMatchingPreset = (env: Record<string, string | undefined>) => {
    for (const preset of CLAUDE_PROVIDER_PRESETS) {
      if (preset.id === "custom") continue;
      const baseUrl = env.ANTHROPIC_BASE_URL || "";
      const presetBaseUrl = preset.env.ANTHROPIC_BASE_URL || "";
      if (baseUrl && presetBaseUrl && baseUrl === presetBaseUrl) {
        return preset.id;
      }
    }
    return "custom";
  };

  const handlePresetClick = (presetId: string) => {
    const preset = CLAUDE_PROVIDER_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setActivePreset(presetId);
    resetFetchedModels();

    if (presetId === "custom") {
      setApiKey("");
      setApiUrl("");
      setHaikuModel("");
      setSonnetModel("");
      setOpusModel("");
      setJsonConfig(defaultConfigJson());
      setJsonError("");
      return;
    }

    const config = { env: { ...preset.env } };
    setJsonConfig(JSON.stringify(config, null, 2));
    setApiUrl(preset.env.ANTHROPIC_BASE_URL || "");
    setApiKey(preset.env.ANTHROPIC_AUTH_TOKEN || "");
    setHaikuModel(preset.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || "");
    setSonnetModel(preset.env.ANTHROPIC_DEFAULT_SONNET_MODEL || "");
    setOpusModel(preset.env.ANTHROPIC_DEFAULT_OPUS_MODEL || "");
    setJsonError("");
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (provider) {
      setProviderName(provider.name || "");
      setRemark(provider.remark || provider.websiteUrl || "");
      setApiKey(
        provider.settingsConfig?.env?.ANTHROPIC_AUTH_TOKEN ||
          provider.settingsConfig?.env?.ANTHROPIC_API_KEY ||
          "",
      );
      setApiUrl(provider.settingsConfig?.env?.ANTHROPIC_BASE_URL || "");
      const env = provider.settingsConfig?.env || {};
      setHaikuModel(env.ANTHROPIC_DEFAULT_HAIKU_MODEL || "");
      setSonnetModel(env.ANTHROPIC_DEFAULT_SONNET_MODEL || "");
      setOpusModel(env.ANTHROPIC_DEFAULT_OPUS_MODEL || "");
      setActivePreset(detectMatchingPreset(env));
      setJsonConfig(JSON.stringify(provider.settingsConfig || { env: {} }, null, 2));
    } else {
      setProviderName("");
      setRemark("");
      setApiKey("");
      setApiUrl("");
      setHaikuModel("");
      setSonnetModel("");
      setOpusModel("");
      setActivePreset("custom");
      setJsonConfig(defaultConfigJson());
    }
    setShowApiKey(false);
    setJsonError("");
    setFetchedModels([]);
    setIsFetchingModels(false);
    setModelFetchError("");
  }, [isOpen, provider]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleJsonChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newJson = event.target.value;
    setJsonConfig(newJson);
    try {
      const parsed = JSON.parse(newJson);
      const env = parsed.env || {};
      setApiKey(env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || "");
      setApiUrl(env.ANTHROPIC_BASE_URL || "");
      setHaikuModel(env.ANTHROPIC_DEFAULT_HAIKU_MODEL || "");
      setSonnetModel(env.ANTHROPIC_DEFAULT_SONNET_MODEL || "");
      setOpusModel(env.ANTHROPIC_DEFAULT_OPUS_MODEL || "");
      setActivePreset(detectMatchingPreset(env));
      setJsonError("");
    } catch {
      setJsonError(t("settings.vendor.dialog.jsonError"));
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonConfig);
      setJsonConfig(JSON.stringify(parsed, null, 2));
      setJsonError("");
    } catch {
      setJsonError(t("settings.vendor.dialog.jsonError"));
    }
  };

  const handleFetchModels = async () => {
    const baseUrl = apiUrl.trim();
    if (!baseUrl) {
      setModelFetchError(t("settings.vendor.dialog.fetchModelsNeedUrl"));
      return;
    }

    setIsFetchingModels(true);
    setModelFetchError("");
    try {
      const result = await fetchClaudeProviderModels(baseUrl, apiKey);
      setFetchedModels(result.models);
      setModelFetchError(
        result.models.length === 0
          ? t("settings.vendor.dialog.fetchModelsEmpty")
          : "",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : t("settings.vendor.dialog.fetchModelsError");
      setModelFetchError(message || t("settings.vendor.dialog.fetchModelsError"));
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSave = () => {
    onSave({ providerName, remark, apiKey, apiUrl, jsonConfig });
  };

  if (!isOpen) return null;

  return (
    <div className="vendor-dialog-overlay" onClick={onClose}>
      <div
        className="vendor-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vendor-dialog-header">
          <h3>
            {isAdding
              ? t("settings.vendor.dialog.addTitle")
              : t("settings.vendor.dialog.editTitle")}
          </h3>
          <button type="button" className="vendor-dialog-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="vendor-dialog-body">
          <p className="vendor-dialog-description">
            {isAdding
              ? t("settings.vendor.dialog.addDescription")
              : t("settings.vendor.dialog.editDescription")}
          </p>

          <div className="vendor-security-notice">
            <Shield size={14} />
            <span>{t("settings.vendor.dialog.securityNotice")}</span>
          </div>

          <div className="vendor-preset-group">
            <div className="vendor-preset-title">
              {t("settings.vendor.dialog.presetGroup")}
            </div>
            <div className="vendor-preset-buttons">
              {CLAUDE_PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`vendor-preset-btn ${
                    activePreset === preset.id ? "active" : ""
                  }`}
                  onClick={() => handlePresetClick(preset.id)}
                >
                  {t(preset.nameKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="vendor-form-group">
            <label>
              {t("settings.vendor.dialog.providerName")}
              <span className="vendor-required">
                {t("settings.vendor.dialog.required")}
              </span>
            </label>
            <input
              type="text"
              className="vendor-input"
              placeholder={t("settings.vendor.dialog.providerNamePlaceholder")}
              value={providerName}
              onChange={(event) => setProviderName(event.target.value)}
            />
          </div>

          <div className="vendor-form-group">
            <label>{t("settings.vendor.dialog.remark")}</label>
            <input
              type="text"
              className="vendor-input"
              placeholder={t("settings.vendor.dialog.remarkPlaceholder")}
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
            />
          </div>

          <div className="vendor-form-group">
            <label>
              {t("settings.vendor.dialog.apiKey")}
              <span className="vendor-required">
                {t("settings.vendor.dialog.required")}
              </span>
            </label>
            <div className="vendor-input-row">
              <input
                type={showApiKey ? "text" : "password"}
                className="vendor-input"
                placeholder={t("settings.vendor.dialog.apiKeyPlaceholder")}
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  updateEnvField("ANTHROPIC_AUTH_TOKEN", event.target.value);
                }}
              />
              <button
                type="button"
                className="vendor-btn-icon"
                onClick={() => setShowApiKey((current) => !current)}
                title={showApiKey ? t("settings.vendor.hide") : t("settings.vendor.show")}
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <small className="vendor-hint">
              {t("settings.vendor.dialog.apiKeyHint")}
            </small>
          </div>

          <div className="vendor-form-group">
            <label>
              {t("settings.vendor.dialog.apiUrl")}
              <span className="vendor-required">
                {t("settings.vendor.dialog.required")}
              </span>
            </label>
            <input
              type="text"
              className="vendor-input"
              placeholder={t("settings.vendor.dialog.apiUrlPlaceholder")}
              value={apiUrl}
              onChange={(event) => {
                setApiUrl(event.target.value);
                updateEnvField("ANTHROPIC_BASE_URL", event.target.value);
              }}
            />
            <small className="vendor-hint">
              {t("settings.vendor.dialog.apiUrlHint")}
            </small>
          </div>

          <div className="vendor-form-group">
            <label>{t("settings.vendor.dialog.modelMapping")}</label>
            <div className="vendor-model-fetch">
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetchingModels || !apiUrl.trim()}
              >
                {isFetchingModels
                  ? t("settings.vendor.dialog.fetchModelsLoading")
                  : t("settings.vendor.dialog.fetchModels")}
              </button>
              {modelFetchError ? (
                <span className="vendor-model-fetch-error">{modelFetchError}</span>
              ) : fetchedModels.length > 0 ? (
                <span className="vendor-hint">
                  {t("settings.vendor.dialog.fetchModelsCount", {
                    count: fetchedModels.length,
                  })}
                </span>
              ) : null}
            </div>
            <datalist id="vendor-fetched-models">
              {fetchedModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
            <div className="vendor-model-grid">
              <div>
                <label>{t("settings.vendor.dialog.sonnetModel")}</label>
                <input
                  type="text"
                  list="vendor-fetched-models"
                  className="vendor-input"
                  placeholder={t("settings.vendor.dialog.sonnetModelPlaceholder")}
                  value={sonnetModel}
                  onChange={(event) => {
                    setSonnetModel(event.target.value);
                    updateEnvField(
                      "ANTHROPIC_DEFAULT_SONNET_MODEL",
                      event.target.value,
                    );
                  }}
                />
              </div>
              <div>
                <label>{t("settings.vendor.dialog.opusModel")}</label>
                <input
                  type="text"
                  list="vendor-fetched-models"
                  className="vendor-input"
                  placeholder={t("settings.vendor.dialog.opusModelPlaceholder")}
                  value={opusModel}
                  onChange={(event) => {
                    setOpusModel(event.target.value);
                    updateEnvField(
                      "ANTHROPIC_DEFAULT_OPUS_MODEL",
                      event.target.value,
                    );
                  }}
                />
              </div>
              <div>
                <label>{t("settings.vendor.dialog.haikuModel")}</label>
                <input
                  type="text"
                  list="vendor-fetched-models"
                  className="vendor-input"
                  placeholder={t("settings.vendor.dialog.haikuModelPlaceholder")}
                  value={haikuModel}
                  onChange={(event) => {
                    setHaikuModel(event.target.value);
                    updateEnvField(
                      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
                      event.target.value,
                    );
                  }}
                />
              </div>
            </div>
            <small className="vendor-hint">
              {t("settings.vendor.dialog.modelMappingHint")}
            </small>
          </div>

          <details className="vendor-advanced" open>
            <summary>{t("settings.vendor.dialog.jsonConfig")}</summary>
            <div className="vendor-json-section">
              <p className="vendor-hint vendor-json-description">
                {t("settings.vendor.dialog.jsonConfigDescription")}
              </p>
              <div className="vendor-json-toolbar">
                <button type="button" onClick={handleFormatJson}>
                  {t("settings.vendor.dialog.formatJson")}
                </button>
              </div>
              <textarea
                className="vendor-json-editor"
                value={jsonConfig}
                onChange={handleJsonChange}
                rows={12}
              />
              {jsonError && (
                <div className="vendor-json-error">{jsonError}</div>
              )}
            </div>
          </details>
        </div>

        <div className="vendor-dialog-footer">
          <button type="button" className="vendor-btn-cancel" onClick={onClose}>
            {t("settings.vendor.cancel")}
          </button>
          <button
            type="button"
            className="vendor-btn-save"
            onClick={handleSave}
            disabled={!providerName.trim()}
          >
            {isAdding
              ? t("settings.vendor.dialog.confirmAdd")
              : t("settings.vendor.dialog.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}
