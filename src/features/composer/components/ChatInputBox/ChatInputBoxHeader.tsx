import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import type { ComposerSendReadiness } from '../../utils/composerSendReadiness';
import type { Attachment, ModelInfo, ProviderId, QueuedMessage } from './types.js';
import type { ProviderModelGroup } from './modelOptions.js';
import type { RuntimeVendorOption } from './hooks/useActiveVendorByRuntime.js';
import { AttachmentList } from './AttachmentList.js';
import { ComposerReadinessBar } from './ComposerReadinessBar.js';
import { MessageQueue } from './MessageQueue.js';

export function ChatInputBoxHeader({
  sdkStatusLoading,
  sdkInstalled,
  currentProvider,
  onInstallSdk,
  t,
  attachments,
  onRemoveAttachment,
  messageQueue,
  onRemoveFromQueue,
  onFuseFromQueue,
  canFuseFromQueue = false,
  fusingQueueMessageId = null,
  sendReadiness,
  onJumpToRequest,
  onToggleContextSources,
  contextSourcesExpanded,
  selectedModel,
  models,
  modelGroups,
  onModelSelect,
  onProviderModelSelect,
  runtimeVendorOptions,
  onRuntimeVendorSwitch,
  onAddModel,
  onRefreshModelConfig,
  isModelConfigRefreshing,
  rightAccessory,
  showOpenSourceBanner,
  onDismissOpenSourceBanner,
}: {
  sdkInstalled: boolean;
  sdkStatusLoading: boolean;
  currentProvider: string;
  onInstallSdk?: () => void;
  t: TFunction;
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  messageQueue?: QueuedMessage[];
  onRemoveFromQueue?: (id: string) => void;
  onFuseFromQueue?: (id: string) => void;
  canFuseFromQueue?: boolean;
  fusingQueueMessageId?: string | null;
  sendReadiness?: ComposerSendReadiness | null;
  onJumpToRequest?: () => void;
  onToggleContextSources?: () => void;
  contextSourcesExpanded?: boolean;
  selectedModel?: string;
  models?: ModelInfo[];
  modelGroups?: ProviderModelGroup[];
  onModelSelect?: (modelId: string) => void;
  onProviderModelSelect?: (providerId: ProviderId, modelId: string) => void;
  runtimeVendorOptions?: Partial<Record<ProviderId, RuntimeVendorOption[]>>;
  onRuntimeVendorSwitch?: (providerId: ProviderId, vendorId: string) => Promise<void> | void;
  onAddModel?: () => void;
  onRefreshModelConfig?: () => Promise<void> | void;
  isModelConfigRefreshing?: boolean;
  rightAccessory?: ReactNode;
  showOpenSourceBanner?: boolean;
  onDismissOpenSourceBanner?: () => void;
}) {
  // Check if there's any content to render
  const hasContent =
    showOpenSourceBanner ||
    sdkStatusLoading ||
    !sdkInstalled ||
    Boolean(sendReadiness) ||
    (messageQueue && messageQueue.length > 0) ||
    attachments.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <>
      {/* Open source banner */}
      {showOpenSourceBanner && (
        <div className="open-source-banner">
          <span className="banner-text">{t('chat.openSourceBanner')}</span>
          <button
            className="banner-close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              onDismissOpenSourceBanner?.();
            }}
          >
            &#x2715;
          </button>
        </div>
      )}

      {/* SDK status loading or not installed warning bar */}
      {(sdkStatusLoading || !sdkInstalled) && (
        <div className={`sdk-warning-bar ${sdkStatusLoading ? 'sdk-loading' : ''}`}>
          <span
            className={`codicon ${sdkStatusLoading ? 'codicon-loading codicon-modifier-spin' : 'codicon-warning'}`}
          />
          <span className="sdk-warning-text">
            {sdkStatusLoading
              ? t('chat.sdkStatusLoading')
              : t('chat.sdkNotInstalled', {
                  provider: currentProvider === 'codex' ? 'Codex' : 'Claude Code',
                })}
          </span>
          {!sdkStatusLoading && (
            <button
              className="sdk-install-btn"
              onClick={(e) => {
                e.stopPropagation();
                onInstallSdk?.();
              }}
            >
              {t('chat.goInstallSdk')}
            </button>
          )}
        </div>
      )}

      {sendReadiness && (
        <ComposerReadinessBar
          readiness={sendReadiness}
          onJumpToRequest={onJumpToRequest}
          onToggleContextSources={onToggleContextSources}
          contextSourcesExpanded={contextSourcesExpanded}
          selectedModel={selectedModel}
          models={models}
          modelGroups={modelGroups}
          currentProvider={currentProvider}
          onModelSelect={onModelSelect}
          onProviderModelSelect={onProviderModelSelect}
          runtimeVendorOptions={runtimeVendorOptions}
          onRuntimeVendorSwitch={onRuntimeVendorSwitch}
          onAddModel={onAddModel}
          onRefreshModelConfig={onRefreshModelConfig}
          isModelConfigRefreshing={isModelConfigRefreshing}
          rightAccessory={rightAccessory}
        />
      )}

      {/* Message queue */}
      {messageQueue && messageQueue.length > 0 && (
        <MessageQueue
          queue={messageQueue}
          onRemove={onRemoveFromQueue ?? (() => {})}
          onFuse={onFuseFromQueue}
          canFuse={canFuseFromQueue}
          fusingMessageId={fusingQueueMessageId}
        />
      )}

      {/* Attachment list */}
      {attachments.length > 0 && (
        <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
      )}
    </>
  );
}
