import { Fragment, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckIcon from 'lucide-react/dist/esm/icons/check';
import type { ModelInfo, ProviderId } from '../types';
import type { ProviderModelGroup } from '../modelOptions';
import { EngineIcon } from '../../../../engine/components/EngineIcon';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ModelSelectProps {
  value: string;
  onChange: (modelId: string) => void;
  models?: ModelInfo[];  // Optional dynamic model list
  currentProvider?: string;  // Current provider type
  providerLabel?: string;
  triggerVariant?: 'default' | 'readiness';
  modelGroups?: ProviderModelGroup[];
  onProviderModelChange?: (providerId: ProviderId, modelId: string) => void;
  onAddModel?: () => void;  // Navigate to model management
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
  triggerVariant = 'default',
  modelGroups,
  onProviderModelChange,
  onAddModel,
  onRefreshConfig,
  isRefreshingConfig = false,
}: ModelSelectProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [refreshConfigError, setRefreshConfigError] = useState<string | null>(null);

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
  const hasGroupedModels = Boolean(modelGroups && modelGroups.length > 0);

  /**
   * Select model
   */
  const handleSelect = useCallback((modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
  }, [onChange]);

  const handleGroupedSelect = useCallback((providerId: ProviderId, modelId: string) => {
    if (onProviderModelChange) {
      onProviderModelChange(providerId, modelId);
    } else {
      onChange(modelId);
    }
    setIsOpen(false);
  }, [onChange, onProviderModelChange]);

  const handleAddModel = useCallback(() => {
    onAddModel?.();
    setIsOpen(false);
  }, [onAddModel]);

  // Refresh keeps the menu open so the spinner / error stay visible.
  const handleRefreshConfig = useCallback(() => {
    if (!onRefreshConfig || isRefreshingConfig) {
      return;
    }
    setRefreshConfigError(null);
    void Promise.resolve(onRefreshConfig()).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setRefreshConfigError(message);
    });
  }, [isRefreshingConfig, onRefreshConfig]);

  const trigger = (
    <button
      className={triggerVariant === 'readiness' ? 'composer-readiness-target composer-readiness-target-button' : 'selector-button'}
      title={t('chat.currentModel', { model: currentModelLabel })}
      aria-label={t('chat.currentModel', { model: currentModelLabel })}
    >
      {triggerVariant === 'readiness' ? (
        <>
          <span className="composer-readiness-icon" aria-hidden="true">
            <ModelIcon provider={currentProvider} size={16} />
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
  );

  const menu = (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={4}
        className="max-h-[380px] w-64 overflow-y-auto"
      >
        {hasGroupedModels ? (
          modelGroups!.map((group, groupIndex) => (
            <Fragment key={group.providerId}>
              {groupIndex > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-muted-foreground">
                {group.providerLabel}
              </DropdownMenuLabel>
              {group.models.map((model) => {
                const isSelected = group.providerId === currentProvider && model.id === value;
                return (
                  <DropdownMenuItem
                    key={`${group.providerId}:${model.id}`}
                    data-model-id={model.id}
                    data-selected={isSelected ? 'true' : undefined}
                    onSelect={(event) => {
                      event.preventDefault();
                      handleGroupedSelect(group.providerId, model.id);
                    }}
                    className="gap-2"
                  >
                    <ModelIcon provider={group.providerId} size={18} />
                    <span className="min-w-0 flex-1 truncate">{getModelLabel(model)}</span>
                    {isSelected && <CheckIcon className="size-4 shrink-0" aria-hidden />}
                  </DropdownMenuItem>
                );
              })}
            </Fragment>
          ))
        ) : (
          <>
            <DropdownMenuLabel className="text-muted-foreground">
              {t('models.selectModel')}
            </DropdownMenuLabel>
            {effectiveModels.map((model) => (
              <DropdownMenuItem
                key={model.id}
                data-model-id={model.id}
                data-selected={model.id === value ? 'true' : undefined}
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelect(model.id);
                }}
                className="items-start gap-2"
              >
                <ModelIcon provider={currentProvider} size={20} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm">{getModelLabel(model)}</span>
                  {getModelDescription(model) && (
                    <span className="text-xs text-muted-foreground whitespace-normal">
                      {getModelDescription(model)}
                    </span>
                  )}
                </div>
                {model.id === value && <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {(onAddModel || onRefreshConfig) && (
          <>
            <DropdownMenuSeparator />
            {onAddModel && (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  handleAddModel();
                }}
              >
                {t('models.addModel')}
              </DropdownMenuItem>
            )}
            {onRefreshConfig && (
              <DropdownMenuItem
                disabled={isRefreshingConfig}
                onSelect={(event) => {
                  event.preventDefault();
                  handleRefreshConfig();
                }}
                title={t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}
                className="gap-2"
              >
                <span
                  className={`codicon codicon-refresh${isRefreshingConfig ? ' selector-refresh-icon-spinning' : ''}`}
                  aria-hidden
                />
                <span>{t(isRefreshingConfig ? 'models.refreshingConfig' : 'models.refreshConfig')}</span>
              </DropdownMenuItem>
            )}
            {refreshConfigError && (
              <div className="px-2 py-1 text-xs text-destructive" role="status">
                {t('models.refreshConfigFailed', { message: refreshConfigError })}
              </div>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return triggerVariant === 'readiness' ? (
    <div className="composer-readiness-model-select">{menu}</div>
  ) : (
    menu
  );
};

export default ModelSelect;
