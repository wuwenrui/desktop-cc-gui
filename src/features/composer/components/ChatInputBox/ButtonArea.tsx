import {
  useCallback,
  useId,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import DatabaseZap from 'lucide-react/dist/esm/icons/database-zap';
import X from 'lucide-react/dist/esm/icons/x';
import type { ButtonAreaProps, MemoryReferenceMode, PermissionMode, ReasoningEffort } from './types';
import { ConfigSelect, ModeSelect, ReasoningSelect, ShortcutActionsSelect } from './selectors';

// Stable no-op callbacks to avoid re-renders when optional handlers are not provided
const NOOP_MODE = (_mode: PermissionMode) => {};
const NOOP_REASONING = (_effort: ReasoningEffort | null) => {};
const MEMORY_REFERENCE_POPOVER_WIDTH = 312;
const MEMORY_REFERENCE_POPOVER_GAP = 6;
const MEMORY_REFERENCE_POPOVER_VIEWPORT_MARGIN = 12;

function clampMemoryReferencePopoverPosition(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function ToolGridIcon() {
  return <span className="codicon codicon-extensions selector-tool-icon" aria-hidden="true" />;
}

/**
 * ButtonArea - Bottom toolbar component
 * Contains the compact tool dock, permission/reasoning controls, and send/stop actions.
 */
export const ButtonArea = ({
  disabled = false,
  hasInputContent = false,
  isLoading = false,
  streamActivityPhase = 'idle',
  permissionMode = 'bypassPermissions',
  currentProvider = 'claude',
  providerProfileLabel = null,
  providerAvailability,
  providerVersions,
  reasoningEffort = null,
  reasoningOptions,
  accountRateLimits,
  usageShowRemaining = false,
  onRefreshAccountRateLimits,
  selectedCollaborationModeId,
  onSelectCollaborationMode,
  codexSpeedMode,
  onCodexSpeedModeChange,
  onCodexReviewQuickStart,
  onForkQuickStart,
  memoryReferenceMode = 'off',
  onSetMemoryReferenceMode,
  onSubmit,
  onStop,
  onModeSelect,
  onProviderSelect,
  onReasoningChange,
  alwaysThinkingEnabled = false,
  onToggleThinking,
  streamingEnabled = true,
  onStreamingEnabledChange,
  sendShortcut = 'enter',
  selectedAgent,
  onAgentSelect,
  onOpenAgentSettings,
  shortcutActions,
  mainSurface,
  toolSurface,
  panelToggleSurface,
}: ButtonAreaProps) => {
  const { t } = useTranslation();
  const isPlanModeEnabled = (selectedCollaborationModeId ?? 'code') === 'plan';
  const supportsStreamActivityPhaseFx =
    currentProvider === 'codex' ||
    currentProvider === 'claude' ||
    currentProvider === 'gemini';
  const resolvedStopButtonPhase =
    supportsStreamActivityPhaseFx ? streamActivityPhase : 'idle';

  const [isToolDockOpen, setIsToolDockOpen] = useState(false);
  const [isMemoryReferencePopoverOpen, setIsMemoryReferencePopoverOpen] = useState(false);
  const toolDockId = useId();
  const memoryReferencePopoverId = useId();
  const memoryReferenceRootRef = useRef<HTMLDivElement>(null);
  const memoryReferenceButtonRef = useRef<HTMLButtonElement>(null);
  const memoryReferencePopoverRef = useRef<HTMLDivElement>(null);
  const [memoryReferencePopoverStyle, setMemoryReferencePopoverStyle] =
    useState<CSSProperties | null>(null);
  const isMemoryReferenceEnabled = memoryReferenceMode !== 'off';
  const memoryReferenceStateLabel =
    memoryReferenceMode === 'always'
      ? t('composer.memoryReferenceAlwaysOn')
      : memoryReferenceMode === 'single'
        ? t('composer.memoryReferenceSingleOn')
        : t('composer.memoryReferenceToggle');

  useEffect(() => {
    if (!isToolDockOpen) {
      setIsMemoryReferencePopoverOpen(false);
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsToolDockOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isToolDockOpen]);

  useEffect(() => {
    if (!isMemoryReferencePopoverOpen) {
      return;
    }

    const handlePointerOutside = (event: MouseEvent) => {
      const root = memoryReferenceRootRef.current;
      const popover = memoryReferencePopoverRef.current;
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (
        (root && root.contains(target)) ||
        (popover && popover.contains(target))
      ) {
        return;
      }
      if (root || popover) {
        setIsMemoryReferencePopoverOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMemoryReferencePopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMemoryReferencePopoverOpen]);

  const updateMemoryReferencePopoverPosition = useCallback(() => {
    if (!isMemoryReferencePopoverOpen || typeof window === 'undefined') {
      return;
    }
    const trigger = memoryReferenceButtonRef.current;
    if (!trigger) {
      return;
    }
    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = memoryReferencePopoverRef.current?.getBoundingClientRect();
    const popoverWidth = Math.min(
      MEMORY_REFERENCE_POPOVER_WIDTH,
      Math.max(
        160,
        window.innerWidth - MEMORY_REFERENCE_POPOVER_VIEWPORT_MARGIN * 2,
      ),
    );
    const measuredWidth = popoverRect?.width || popoverWidth;
    const measuredHeight = popoverRect?.height || 140;
    const left = clampMemoryReferencePopoverPosition(
      triggerRect.right - measuredWidth,
      MEMORY_REFERENCE_POPOVER_VIEWPORT_MARGIN,
      window.innerWidth - measuredWidth - MEMORY_REFERENCE_POPOVER_VIEWPORT_MARGIN,
    );
    const preferredTop =
      triggerRect.top - measuredHeight - MEMORY_REFERENCE_POPOVER_GAP;
    const fallbackTop =
      triggerRect.bottom + MEMORY_REFERENCE_POPOVER_GAP;
    const top =
      preferredTop >= MEMORY_REFERENCE_POPOVER_VIEWPORT_MARGIN
        ? preferredTop
        : clampMemoryReferencePopoverPosition(
            fallbackTop,
            MEMORY_REFERENCE_POPOVER_VIEWPORT_MARGIN,
            window.innerHeight - measuredHeight - MEMORY_REFERENCE_POPOVER_VIEWPORT_MARGIN,
          );

    setMemoryReferencePopoverStyle({
      left,
      top,
      width: popoverWidth,
      maxWidth: `calc(100vw - ${MEMORY_REFERENCE_POPOVER_VIEWPORT_MARGIN * 2}px)`,
      maxHeight: `calc(100vh - ${MEMORY_REFERENCE_POPOVER_VIEWPORT_MARGIN * 2}px)`,
    });
  }, [isMemoryReferencePopoverOpen]);

  useLayoutEffect(() => {
    if (!isMemoryReferencePopoverOpen) {
      setMemoryReferencePopoverStyle(null);
      return;
    }
    updateMemoryReferencePopoverPosition();
    const rafId = window.requestAnimationFrame(updateMemoryReferencePopoverPosition);
    return () => window.cancelAnimationFrame(rafId);
  }, [isMemoryReferencePopoverOpen, updateMemoryReferencePopoverPosition]);

  useEffect(() => {
    if (!isMemoryReferencePopoverOpen) {
      return;
    }
    const handleViewportChange = () => updateMemoryReferencePopoverPosition();
    const scrollOptions = { capture: true, passive: true } as const;
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, scrollOptions);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, scrollOptions);
    };
  }, [isMemoryReferencePopoverOpen, updateMemoryReferencePopoverPosition]);

  /**
   * Handle submit button click
   */
  const handleSubmitClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSubmit?.();
  }, [onSubmit]);

  /**
   * Handle stop button click
   */
  const handleStopClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onStop?.();
  }, [onStop]);

  /**
   * Handle provider selection
   */
  const handleProviderSelect = useCallback((providerId: string) => {
    onProviderSelect?.(providerId);
  }, [onProviderSelect]);

  const handlePlanModeToggle = useCallback(() => {
    if (!onSelectCollaborationMode) {
      return;
    }
    onSelectCollaborationMode(isPlanModeEnabled ? 'code' : 'plan');
  }, [isPlanModeEnabled, onSelectCollaborationMode]);

  const handleToolDockToggle = useCallback(() => {
    setIsToolDockOpen((current) => {
      if (current) {
        setIsMemoryReferencePopoverOpen(false);
      }
      return !current;
    });
  }, []);

  const handleMemoryReferenceToggleClick = useCallback(() => {
    if (!onSetMemoryReferenceMode) {
      return;
    }
    if (memoryReferenceMode !== 'off') {
      onSetMemoryReferenceMode('off');
      setIsMemoryReferencePopoverOpen(false);
      return;
    }
    setIsMemoryReferencePopoverOpen((current) => !current);
  }, [memoryReferenceMode, onSetMemoryReferenceMode]);

  const handleSelectMemoryReferenceMode = useCallback((nextMode: MemoryReferenceMode) => {
    if (!onSetMemoryReferenceMode || memoryReferenceMode !== 'off') {
      setIsMemoryReferencePopoverOpen(false);
      return;
    }
    onSetMemoryReferenceMode(nextMode);
    setIsMemoryReferencePopoverOpen(false);
  }, [memoryReferenceMode, onSetMemoryReferenceMode]);

  const toolDockToggleLabel = t('chat.toolDockToggle', {
    defaultValue: isToolDockOpen ? '收起工具' : '展开工具',
  });

  const memoryReferencePopover =
    isMemoryReferencePopoverOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={memoryReferencePopoverRef}
            id={memoryReferencePopoverId}
            className="composer-memory-reference-popover"
            role="dialog"
            aria-label={t('composer.memoryReferenceDialogTitle')}
            style={memoryReferencePopoverStyle ?? undefined}
          >
            <div className="composer-memory-reference-popover-head">
              <div className="composer-memory-reference-popover-title-group">
                <span className="composer-memory-reference-popover-title">
                  {t('composer.memoryReferenceDialogTitle')}
                </span>
              </div>
              <button
                type="button"
                className="composer-memory-reference-popover-close"
                onClick={() => setIsMemoryReferencePopoverOpen(false)}
                aria-label={t('common.close', { defaultValue: '关闭' })}
              >
                <X size={12} aria-hidden />
              </button>
            </div>
            <div className="composer-memory-reference-popover-body">
              <div className="composer-memory-reference-popover-row">
                <span className="composer-memory-reference-popover-label">
                  {t('composer.memoryReferenceMode')}
                </span>
                <span className="composer-memory-reference-popover-value">
                  {t('composer.memoryReferenceModeChoice')}
                </span>
              </div>
              <div className="composer-memory-reference-popover-copy">
                {t('composer.memoryReferenceModeHint')}
              </div>
            </div>
            <div className="composer-memory-reference-popover-actions">
              <button
                type="button"
                className="composer-memory-reference-popover-secondary"
                onClick={() => setIsMemoryReferencePopoverOpen(false)}
              >
                {t('common.cancel', { defaultValue: '取消' })}
              </button>
              <button
                type="button"
                className={`composer-memory-reference-popover-mode${
                  memoryReferenceMode === 'single' ? ' is-selected' : ''
                }`}
                aria-pressed={memoryReferenceMode === 'single'}
                onClick={() => handleSelectMemoryReferenceMode('single')}
              >
                {t('composer.memoryReferenceEnableSingle')}
              </button>
              <button
                type="button"
                className={`composer-memory-reference-popover-mode${
                  memoryReferenceMode === 'always' ? ' is-selected' : ''
                }`}
                aria-pressed={memoryReferenceMode === 'always'}
                onClick={() => handleSelectMemoryReferenceMode('always')}
              >
                {t('composer.memoryReferenceEnableAlways')}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={`button-area${isToolDockOpen ? ' is-tool-dock-open' : ''}`}
      data-provider={currentProvider}
    >
      <div className="button-area-primary-row">
        <div className="button-area-left button-area-left--primary">
          <button
            type="button"
            className="selector-button selector-tool-dock-toggle"
            onClick={handleToolDockToggle}
            title={toolDockToggleLabel}
            aria-label={toolDockToggleLabel}
            aria-expanded={isToolDockOpen}
            aria-controls={toolDockId}
          >
            <ToolGridIcon />
          </button>
          {isToolDockOpen ? (
            <div
              id={toolDockId}
              className="button-area-inline-tools"
              role="group"
              aria-label={toolDockToggleLabel}
            >
              <ConfigSelect
                currentProvider={currentProvider}
                onProviderChange={handleProviderSelect}
                providerAvailability={providerAvailability}
                providerVersions={providerVersions}
                alwaysThinkingEnabled={alwaysThinkingEnabled}
                onToggleThinking={onToggleThinking}
                streamingEnabled={streamingEnabled}
                onStreamingEnabledChange={onStreamingEnabledChange}
                accountRateLimits={accountRateLimits}
                usageShowRemaining={usageShowRemaining}
                onRefreshAccountRateLimits={onRefreshAccountRateLimits}
                selectedCollaborationModeId={selectedCollaborationModeId}
                onSelectCollaborationMode={onSelectCollaborationMode}
                codexSpeedMode={codexSpeedMode}
                onCodexSpeedModeChange={onCodexSpeedModeChange}
                onCodexReviewQuickStart={onCodexReviewQuickStart}
                onForkQuickStart={onForkQuickStart}
                selectedAgent={selectedAgent}
                onAgentSelect={onAgentSelect}
                onOpenAgentSettings={onOpenAgentSettings}
              />
              <ShortcutActionsSelect actions={shortcutActions} />
              <ModeSelect
                value={permissionMode}
                onChange={onModeSelect ?? NOOP_MODE}
                provider={currentProvider}
                selectedCollaborationModeId={selectedCollaborationModeId}
                onSelectCollaborationMode={onSelectCollaborationMode}
              />
              {currentProvider === 'codex' && isPlanModeEnabled && (
                <button
                  className={`selector-button selector-plan-mode-button ${isPlanModeEnabled ? 'active' : ''}`}
                  onClick={handlePlanModeToggle}
                  title={t('composer.planModeToggle')}
                  disabled={!onSelectCollaborationMode}
                >
                  <span className="codicon codicon-git-branch" />
                  <span className="selector-button-text">
                    {t('composer.planModeShort')}
                  </span>
                </button>
              )}
              {toolSurface ? (
                <div className="button-area-tool-surface">
                  {toolSurface}
                </div>
              ) : null}
              {panelToggleSurface}
              {onSetMemoryReferenceMode ? (
                <div
                  ref={memoryReferenceRootRef}
                  className="composer-memory-reference-control"
                >
                  <button
                    ref={memoryReferenceButtonRef}
                    type="button"
                    className={`composer-memory-reference-toggle${
                      isMemoryReferenceEnabled ? ' is-armed' : ''
                    }${
                      memoryReferenceMode === 'always' ? ' is-always' : ''
                    }`}
                    onClick={handleMemoryReferenceToggleClick}
                    aria-pressed={isMemoryReferenceEnabled}
                    aria-expanded={isMemoryReferencePopoverOpen}
                    aria-controls={memoryReferencePopoverId}
                    aria-label={t('composer.memoryReferenceToggle')}
                    title={memoryReferenceStateLabel}
                    disabled={disabled}
                  >
                    <span className="composer-memory-reference-icon" aria-hidden>
                      <DatabaseZap size={17} />
                    </span>
                  </button>
                  {memoryReferencePopover}
                </div>
              ) : null}
              {(currentProvider === 'codex' || currentProvider === 'claude') && (
                <ReasoningSelect
                  value={reasoningEffort}
                  onChange={onReasoningChange ?? NOOP_REASONING}
                  options={reasoningOptions}
                  showDefaultOption={currentProvider === 'claude'}
                  defaultLabel={
                    currentProvider === 'claude'
                      ? t('reasoning.claudeDefault', { defaultValue: 'Claude 默认' })
                      : undefined
                  }
                />
              )}
              {mainSurface ? (
                <div className="button-area-main-surface">
                  {mainSurface}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="button-area-right">
          {providerProfileLabel ? (
            <span className="button-area-provider-tag" title={providerProfileLabel}>
              {providerProfileLabel}
            </span>
          ) : null}
          {isLoading ? (
            <button
              className={`submit-button stop-button is-${resolvedStopButtonPhase}`}
              onClick={handleStopClick}
              title={t('chat.stopGeneration')}
              data-stream-phase={resolvedStopButtonPhase}
            >
              <span className="codicon codicon-debug-stop" />
            </button>
          ) : (
            <button
              className="submit-button"
              onClick={handleSubmitClick}
              disabled={disabled || !hasInputContent}
              title={
                sendShortcut === 'cmdEnter'
                  ? t('chat.sendMessageCmdEnter')
                  : t('chat.sendMessageEnter')
              }
            >
              <span className="codicon codicon-send" />
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default ButtonArea;
