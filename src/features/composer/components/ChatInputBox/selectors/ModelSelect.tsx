import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import xuanzhonIcon from '../../../../../assets/xuanzhong.svg';
import type { ModelInfo, ProviderId } from '../types';
import type { ProviderModelGroup } from '../modelOptions';
import type { RuntimeVendorOption } from '../hooks/useActiveVendorByRuntime';
import { EngineIcon } from '../../../../engine/components/EngineIcon';

interface ModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  models?: ModelInfo[];  // Optional dynamic model list
  currentProvider?: string;  // Current provider type
  providerLabel?: string;
  triggerVariant?: 'default' | 'readiness';
  modelGroups?: ProviderModelGroup[];
  runtimeVendorOptions?: Partial<Record<ProviderId, RuntimeVendorOption[]>>;
  onProviderModelChange?: (providerId: ProviderId, modelId: string) => void;
  onRuntimeVendorSwitch?: (providerId: ProviderId, vendorId: string) => Promise<void> | void;
  onAddModel?: (providerId?: string) => void;  // Navigate to current provider config
  onRefreshConfig?: () => Promise<void> | void; // Refresh current provider config
  isRefreshingConfig?: boolean;
}

const MODEL_LABEL_KEYS: Record<string, string> = {
  'gpt-5.5': 'models.codex.gpt55.label',
  'gpt-5.4': 'models.codex.gpt54.label',
  'gpt-5.4-mini': 'models.codex.gpt54mini.label',
  'gpt-5.3-codex': 'models.codex.gpt53codex.label',
  'gpt-5.3-codex-spark': 'models.codex.gpt53codexSpark.label',
  'gpt-5.2': 'models.codex.gpt52.label',
};

const MODEL_DESCRIPTION_KEYS: Record<string, string> = {
  'gpt-5.5': 'models.codex.gpt55.description',
  'gpt-5.4': 'models.codex.gpt54.description',
  'gpt-5.4-mini': 'models.codex.gpt54mini.description',
  'gpt-5.3-codex': 'models.codex.gpt53codex.description',
  'gpt-5.3-codex-spark': 'models.codex.gpt53codexSpark.description',
  'gpt-5.2': 'models.codex.gpt52.description',
};

/**
 * Model icon component - displays different icons based on provider type
 */
const ModelIcon = ({ provider, size = 16 }: { provider?: string; size?: number }) => {
  const imgStyle = { width: size, height: size, flexShrink: 0 } as const;
  switch (provider) {
    case 'codex':
      return <EngineIcon engine="codex" size={size} style={imgStyle} />;
    case 'gemini':
      return <EngineIcon engine="gemini" size={size} style={imgStyle} />;
    case 'opencode':
      return <EngineIcon engine="opencode" size={size} style={imgStyle} />;
    case 'claude':
    default:
      return <EngineIcon engine="claude" size={size} style={imgStyle} />;
  }
};

/**
 * ModelSelect - Model selector component
 * Supports switching between Sonnet 4.5, Opus 4.5, and other models, including Codex models
 */
export const ModelSelect = ({
  value,
  onChange,
  models = [],
  currentProvider = 'claude',
  providerLabel,
  triggerVariant = 'default',
  modelGroups,
  runtimeVendorOptions,
  onProviderModelChange,
  onRuntimeVendorSwitch,
  onRefreshConfig,
  isRefreshingConfig = false,
}: ModelSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [refreshConfigError, setRefreshConfigError] = useState<string | null>(null);
  const [openRuntimeVendorGroup, setOpenRuntimeVendorGroup] = useState<ProviderId | null>(null);
  const [switchingRuntimeVendor, setSwitchingRuntimeVendor] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const effectiveModels = useMemo(() => {
    if (models.length > 0) {
      return models;
    }
    if (currentProvider !== 'claude' && value && value.trim().length > 0) {
      return [{ id: value, label: value }];
    }
    return [] as ModelInfo[];
  }, [currentProvider, models, value]);

  const selectedModelValue = value.trim();
  const currentModel =
    selectedModelValue.length > 0
      ? effectiveModels.find(m => m.id === selectedModelValue) ?? null
      : null;

  const getModelLabel = (model: ModelInfo): string => {
    // The parent owns refreshed provider/model mapping. Keep this selector
    // presentational so manual config refreshes can update labels immediately.
    const labelKey = MODEL_LABEL_KEYS[model.id];

    if (labelKey) {
      return t(labelKey);
    }

    return model.label;
  };

  const getModelDescription = (model: ModelInfo): string | undefined => {
    const descriptionKey = MODEL_DESCRIPTION_KEYS[model.id];
    if (descriptionKey) {
      return t(descriptionKey);
    }
    return model.description;
  };
  const currentModelLabel = currentModel ? getModelLabel(currentModel) : t('models.selectModel');
  const resolvedProviderLabel = providerLabel ?? t(`providers.${currentProvider}.label`);
  const hasGroupedModels = Boolean(modelGroups && modelGroups.length > 0);

  /**
   * Toggle dropdown
   */
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    if (isOpen) {
      setOpenRuntimeVendorGroup(null);
    }
  }, [isOpen]);

  /**
   * Select model
   */
  const handleSelect = useCallback((modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
    setOpenRuntimeVendorGroup(null);
  }, [onChange]);

  const handleGroupedSelect = useCallback((providerId: ProviderId, modelId: string) => {
    if (onProviderModelChange) {
      onProviderModelChange(providerId, modelId);
    } else {
      onChange(modelId);
    }
    setIsOpen(false);
    setOpenRuntimeVendorGroup(null);
  }, [onChange, onProviderModelChange]);

  const handleRuntimeVendorGroupToggle = useCallback((providerId: ProviderId) => {
    setOpenRuntimeVendorGroup((prev) => prev === providerId ? null : providerId);
  }, []);

  const handleRuntimeVendorSelect = useCallback(async (providerId: ProviderId, vendorId: string) => {
    if (!onRuntimeVendorSwitch || switchingRuntimeVendor) {
      return;
    }
    setSwitchingRuntimeVendor(`${providerId}:${vendorId}`);
    setRefreshConfigError(null);
    try {
      await onRuntimeVendorSwitch(providerId, vendorId);
      setIsOpen(false);
      setOpenRuntimeVendorGroup(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setRefreshConfigError(message);
    } finally {
      setSwitchingRuntimeVendor(null);
    }
  }, [onRuntimeVendorSwitch, switchingRuntimeVendor]);

  const handleRefreshConfigClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!onRefreshConfig || isRefreshingConfig) {
      return;
    }
    setRefreshConfigError(null);
    void Promise.resolve(onRefreshConfig()).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setRefreshConfigError(message);
    });
  }, [isRefreshingConfig, onRefreshConfig]);

  /**
   * Close on outside click
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setOpenRuntimeVendorGroup(null);
      }
    };

    // Delay adding event listener to prevent immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      className={triggerVariant === 'readiness' ? 'composer-readiness-model-select' : undefined}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        ref={buttonRef}
        className={triggerVariant === 'readiness' ? 'composer-readiness-target composer-readiness-target-button' : 'selector-button'}
        onClick={handleToggle}
        title={t('chat.currentModel', { model: currentModelLabel })}
        aria-label={t('chat.currentModel', { model: currentModelLabel })}
      >
        {triggerVariant === 'readiness' ? (
          <>
            <span className="composer-readiness-icon" aria-hidden="true">
              <ModelIcon provider={currentProvider} size={17} />
            </span>
            <span className="composer-readiness-provider">
              {resolvedProviderLabel}
            </span>
            <span className="composer-readiness-divider" aria-hidden="true">
              /
            </span>
            <span className="composer-readiness-model">
              {currentModelLabel}
            </span>
          </>
        ) : (
          <>
            <ModelIcon provider={currentProvider} size={12} />
            <span className="selector-button-text">{currentModelLabel}</span>
            <span className={`codicon codicon-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '10px', marginLeft: '2px' }} />
          </>
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="selector-dropdown selector-dropdown--model"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '4px',
            zIndex: 10000,
          }}
        >
          {hasGroupedModels ? (
            <div className="selector-model-groups">
              {modelGroups!.map((group, groupIndex) => (
                <div key={group.providerId} className="selector-model-group">
                  {groupIndex > 0 && <div className="selector-model-group-divider" />}
                  <button
                    type="button"
                    className={`selector-model-group-title selector-model-group-title-button${runtimeVendorOptions?.[group.providerId]?.length ? ' has-vendor-switch' : ''}`}
                    onClick={() => {
                      if (runtimeVendorOptions?.[group.providerId]?.length) {
                        handleRuntimeVendorGroupToggle(group.providerId);
                      }
                    }}
                    disabled={!runtimeVendorOptions?.[group.providerId]?.length}
                  >
                    <span>
                      {group.providerLabel}
                      {group.activeVendorLabel ? (
                        <span className="selector-model-group-vendor">
                          {` (${group.activeVendorLabel})`}
                        </span>
                      ) : null}
                    </span>
                    {runtimeVendorOptions?.[group.providerId]?.length ? (
                      <span className={`codicon codicon-chevron-${openRuntimeVendorGroup === group.providerId ? 'down' : 'right'}`} aria-hidden />
                    ) : null}
                  </button>
                  {openRuntimeVendorGroup === group.providerId && runtimeVendorOptions?.[group.providerId]?.length ? (
                    <div className="selector-runtime-vendor-list">
                      {runtimeVendorOptions[group.providerId]!.map((vendor) => {
                        const switchKey = `${group.providerId}:${vendor.id}`;
                        return (
                          <button
                            key={vendor.id}
                            type="button"
                            className={`selector-option selector-option-button selector-runtime-vendor-option ${vendor.isActive ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRuntimeVendorSelect(group.providerId, vendor.id);
                            }}
                            disabled={switchingRuntimeVendor !== null}
                            aria-busy={switchingRuntimeVendor === switchKey}
                          >
                            <span className="selector-runtime-vendor-label">{vendor.label}</span>
                            {switchingRuntimeVendor === switchKey ? (
                              <span className="codicon codicon-loading selector-refresh-icon-spinning" aria-hidden />
                            ) : vendor.isActive ? (
                              <span className="codicon codicon-check check-mark" aria-hidden />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className={`selector-model-group-options${group.providerId === 'codex' && group.models.length > 3 ? ' selector-model-group-options--scrollable' : ''}`}>
                    {group.models.map((model) => {
                      const isSelected = group.providerId === currentProvider && model.id === value;
                      return (
                        <div
                          key={`${group.providerId}:${model.id}`}
                          className={`selector-option selector-option--model-compact ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleGroupedSelect(group.providerId, model.id)}
                        >
                          <ModelIcon provider={group.providerId} size={18} />
                          <span className="selector-model-label">{getModelLabel(model)}</span>
                          <div className="selector-model-check-slot">
                            {isSelected && (
                              <img src={xuanzhonIcon} aria-hidden />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="selector-dropdown-title">{t('models.selectModel')}</div>
              {effectiveModels.map((model) => (
                <div
                  key={model.id}
                  className={`selector-option ${model.id === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(model.id)}
                >
                  <ModelIcon provider={currentProvider} size={20} />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span>{getModelLabel(model)}</span>
                    {getModelDescription(model) && (
                      <span className="model-description">{getModelDescription(model)}</span>
                    )}
                  </div>
                  <div style={{ width: 20, height: 20, flexShrink: 0, marginLeft: 'auto' }}>
                    {model.id === value && (
                      <img src={xuanzhonIcon} style={{ width: 20, height: 20 }} aria-hidden />
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          {onRefreshConfig && (
            <>
              <div className="selector-divider" />
              <div className="selector-action-footer">
                <button
                  type="button"
                  className="selector-footer-action selector-footer-action-refresh"
                  onClick={handleRefreshConfigClick}
                  disabled={isRefreshingConfig}
                  aria-busy={isRefreshingConfig}
                  title={t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}
                >
                  <span
                    className={`codicon codicon-refresh${isRefreshingConfig ? ' selector-refresh-icon-spinning' : ''}`}
                    aria-hidden
                  />
                  <span>{t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}</span>
                </button>
              </div>
              {refreshConfigError && (
                <div className="selector-refresh-error" role="status">
                  {t('models.refreshConfigFailed', { message: refreshConfigError })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelSelect;
