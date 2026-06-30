import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { EngineIcon } from '../../../engine/components/EngineIcon';
import type { ComposerSendReadiness } from '../../utils/composerSendReadiness';
import type { ModelInfo, ProviderId } from './types';
import type { ProviderModelGroup } from './modelOptions';
import { ModelSelect } from './selectors/ModelSelect';

function parseContextChipCount(chip: string, prefix: string) {
  if (!chip.startsWith(prefix)) {
    return null;
  }
  const count = Number(chip.slice(prefix.length));
  return Number.isFinite(count) && count > 0 ? count : null;
}

type ComposerReadinessBarProps = {
  readiness: ComposerSendReadiness;
  onJumpToRequest?: () => void;
  onToggleContextSources?: () => void;
  contextSourcesExpanded?: boolean;
  selectedModel?: string;
  models?: ModelInfo[];
  modelGroups?: ProviderModelGroup[];
  currentProvider?: string;
  onModelSelect?: (modelId: string) => void;
  onProviderModelSelect?: (providerId: ProviderId, modelId: string) => void;
  onAddModel?: () => void;
  onRefreshModelConfig?: () => Promise<void> | void;
  isModelConfigRefreshing?: boolean;
  rightAccessory?: ReactNode;
};

export function ComposerReadinessBar({
  readiness,
  onJumpToRequest,
  onToggleContextSources,
  contextSourcesExpanded = false,
  selectedModel,
  models,
  modelGroups,
  currentProvider,
  onModelSelect,
  onProviderModelSelect,
  onAddModel,
  onRefreshModelConfig,
  isModelConfigRefreshing,
  rightAccessory,
}: ComposerReadinessBarProps) {
  const { t } = useTranslation();
  const hasContext = readiness.contextSummary.chips.length > 0;
  const contextLabels = readiness.contextSummary.chips.map((chip) => {
    const memoryCount = parseContextChipCount(chip, 'memory:');
    if (memoryCount !== null) {
      return t('composer.manualMemorySelection', { count: memoryCount });
    }
    const noteCount = parseContextChipCount(chip, 'notes:');
    if (noteCount !== null) {
      return t('composer.noteCardSelection', { count: noteCount });
    }
    const fileCount = parseContextChipCount(chip, 'files:');
    if (fileCount !== null) {
      return t('composer.readinessContextFileReference', { count: fileCount });
    }
    const imageCount = parseContextChipCount(chip, 'images:');
    if (imageCount !== null) {
      return t('composer.readinessContextImage', { count: imageCount });
    }
    const ledgerItemCount = parseContextChipCount(chip, 'items:');
    if (ledgerItemCount !== null) {
      return t('composer.contextLedgerSummaryBlocks', { count: ledgerItemCount });
    }
    const ledgerGroupCount = parseContextChipCount(chip, 'groups:');
    if (ledgerGroupCount !== null) {
      return t('composer.contextLedgerSummaryGroups', { count: ledgerGroupCount });
    }
    if (chip.startsWith('agent:')) {
      return t('composer.readinessContextAgent', { name: chip.slice('agent:'.length) });
    }
    return chip;
  });
  const canJumpToRequest =
    Boolean(onJumpToRequest) && readiness.requestPointer?.canJumpToRequest === true;
  const canToggleContextSources = hasContext && Boolean(onToggleContextSources);

  return (
    <div
      className={`composer-readiness-bar composer-readiness-bar--${readiness.activity.severity}`}
      data-activity={readiness.activity.kind}
      data-primary-action={readiness.readiness.primaryAction}
      aria-label={t('composer.readinessAriaLabel', {
        target: readiness.target.providerLabel,
        model: readiness.target.modelLabel,
        activity: readiness.activity.shortLabel,
      })}
    >
      <div className="composer-readiness-target-group" title={readiness.activity.detailLabel}>
        {onModelSelect ? (
          <ModelSelect
            value={selectedModel ?? ''}
            onChange={onModelSelect}
            models={models}
            modelGroups={modelGroups}
            currentProvider={currentProvider ?? readiness.target.engine}
            providerLabel={readiness.target.providerLabel}
            triggerVariant="readiness"
            onProviderModelChange={onProviderModelSelect}
            onAddModel={onAddModel}
            onRefreshConfig={onRefreshModelConfig}
            isRefreshingConfig={Boolean(isModelConfigRefreshing)}
          />
        ) : (
          <div className="composer-readiness-target">
            <span className="composer-readiness-icon" aria-hidden="true">
              <EngineIcon engine={readiness.target.engine} size={17} />
            </span>
            <span className="composer-readiness-provider">
              {readiness.target.providerLabel}
            </span>
            <span className="composer-readiness-divider" aria-hidden="true">
              /
            </span>
            <span className="composer-readiness-model">
              {readiness.target.modelLabel}
            </span>
          </div>
        )}
      </div>

      <div className="composer-readiness-activity" title={readiness.activity.detailLabel}>
        {rightAccessory ? (
          <div className="composer-readiness-right-accessory">
            {rightAccessory}
          </div>
        ) : null}
        {contextLabels.length > 0 ? (
          <span
            className="composer-readiness-context-summary"
            title={readiness.contextSummary.detailLabel}
          >
            {contextLabels.join(' · ')}
          </span>
        ) : null}
        {canJumpToRequest ? (
          <button
            type="button"
            className="composer-readiness-action"
            onClick={onJumpToRequest}
          >
            {t('composer.readinessJumpToRequest')}
          </button>
        ) : null}
        {canToggleContextSources ? (
          <button
            type="button"
            className="composer-readiness-expand"
            onClick={onToggleContextSources}
            aria-expanded={contextSourcesExpanded}
          >
            {contextSourcesExpanded
              ? t('composer.contextLedgerCollapse')
              : t('composer.contextLedgerExpand')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
