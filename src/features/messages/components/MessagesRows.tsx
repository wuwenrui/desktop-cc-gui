import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Copy from "lucide-react/dist/esm/icons/copy";
import Terminal from "lucide-react/dist/esm/icons/terminal";
import { AgentIcon } from "../../../components/AgentIcon";
import { hydrateClaudeDeferredImage } from "../../../services/tauri";
import { appendMessageRowRenderBudgetDiagnostic } from "../../../services/rendererDiagnostics";
import {
  createOwnedObjectUrl,
  revokeOwnedObjectUrl,
} from "../../../services/mediaResourceOwners";
import type { ConversationItem, QueuedMessage } from "../../../types";
import { DiffBlock } from "../../git/components/DiffBlock";
import type { StreamActivityPhase } from "../../threads/hooks/useStreamActivityPhase";
import {
  noteThreadLiveRowRenderMeasured,
  type StreamMitigationProfile,
} from "../../threads/utils/streamLatencyDiagnostics";
import { ProxyStatusBadge } from "../../../components/ProxyStatusBadge";
import { EngineTaskOutputInspector } from "../../engine-task-output/components/EngineTaskOutputInspector";
import { useEngineTaskOutputSnapshot } from "../../engine-task-output/hooks/useEngineTaskOutputSnapshot";
import type { EngineTaskOutputSnapshot } from "../../engine-task-output/types";
import {
  buildEngineTaskOutputSnapshot,
  buildTaskOutputSourceFromNotification,
} from "../../engine-task-output/utils/engineTaskOutputProjection";
import { languageFromPath } from "../../../utils/syntax";
import type { PresentationProfile } from "../presentation/presentationProfile";
import { parseAgentTaskNotification } from "../utils/agentTaskNotification";
import {
  BrowserContextSummaryCard,
  parseBrowserContextPrompt,
  stripBrowserContextPrompt,
} from "../../browser-agent";
import {
  CollapsibleUserTextBlock,
  parseUserTextContent,
  UserCodeAnnotationContextBlock,
} from "./CollapsibleUserTextBlock";
import { ImageLightbox, MessageImageGrid, type MessageImage } from "./MessageMediaBlocks";
import { LocalImage } from "./LocalImage";
import { Markdown } from "./Markdown";
import {
  parseIntentCanvasContextSummaries,
} from "../../intent-canvas/utils/messageContext";
import { IntentCanvasContextSummaryCard } from "./IntentCanvasContextSummaryCard";
import { NoteCardContextSummaryCard } from "./NoteCardContextSummaryCard";
import { parseMemoryContextSummary } from "./messagesMemoryContext";
import {
  parseNoteCardContextSummary,
} from "./messagesNoteCardContext";
import { parseReasoning } from "./messagesReasoning";
import {
  analyzeStreamingMarkdownComplexity,
  analyzeStreamingMarkdownComplexityDelta,
  EMPTY_STREAMING_MARKDOWN_COMPLEXITY,
  resolveAssistantMessageStreamingThrottleMs,
  resolveReasoningStreamingThrottleMs,
  type StreamingMarkdownComplexity,
} from "./messagesStreamingComplexity";
import { resolveUserMessagePresentation } from "./messagesUserPresentation";
import { RuntimeReconnectCard } from "./RuntimeReconnectCard";
import {
  resolveAssistantRuntimeReconnectHint,
  type RuntimeReconnectRecoveryCallbackResult,
} from "./runtimeReconnect";
import {
  basenameFromPath,
  formatDurationMs,
  MessagesEngine,
  normalizeAgentTaskStatus,
  normalizeMessageImageSrc,
  OPENCODE_NON_STREAMING_HINT_DELAY_MS,
  resolveAgentTaskDisplaySummary,
  resolveProvenanceEngineLabel,
  shouldDisplayWorkingActivityLabel,
} from "./messagesRenderUtils";

type WorkingIndicatorProps = {
  isThinking: boolean;
  proxyEnabled?: boolean;
  proxyUrl?: string | null;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
  heartbeatPulse?: number;
  hasItems: boolean;
  reasoningLabel?: string | null;
  activityLabel?: string | null;
  activeEngine?: MessagesEngine;
  waitingForFirstChunk?: boolean;
  presentationProfile?: PresentationProfile | null;
  streamActivityPhase?: StreamActivityPhase;
  primaryLabel?: string | null;
};

type MessageRowProps = {
  item: Extract<ConversationItem, { kind: "message" }>;
  workspaceId?: string | null;
  threadId?: string | null;
  isStreaming?: boolean;
  activeEngine?: MessagesEngine;
  activeCollaborationModeId?: string | null;
  enableCollaborationBadge?: boolean;
  presentationProfile?: PresentationProfile | null;
  showRuntimeReconnectCard?: boolean;
  onRecoverThreadRuntime?: (
    workspaceId: string,
    threadId: string,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  onRecoverThreadRuntimeAndResend?: (
    workspaceId: string,
    threadId: string,
    message: Pick<QueuedMessage, "text" | "images">,
  ) => Promise<RuntimeReconnectRecoveryCallbackResult> | RuntimeReconnectRecoveryCallbackResult;
  onThreadRecoveryFork?: () => Promise<void> | void;
  retryMessage?: Pick<QueuedMessage, "text" | "images"> | null;
  isCopied: boolean;
  onCopy: (
    item: Extract<ConversationItem, { kind: "message" }>,
    copyText?: string,
  ) => void;
  codeBlockCopyUseModifier?: boolean;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
  streamMitigationProfile?: StreamMitigationProfile | null;
  onAssistantVisibleTextRender?: (payload: {
    itemId: string;
    visibleText: string;
  }) => void;
  suppressMemorySummaryCard?: boolean;
  suppressNoteCardSummaryCard?: boolean;
};

type DeferredImageState = {
  status: "idle" | "loading" | "loaded" | "error";
  src?: string;
  transient?: boolean;
  error?: string;
};

function deferredImageKey(
  image: NonNullable<Extract<ConversationItem, { kind: "message" }>["deferredImages"]>[number],
) {
  const locator = image.locator;
  return [
    locator.sessionId,
    locator.lineIndex,
    locator.blockIndex,
    locator.messageId ?? "",
    locator.mediaType,
  ].join(":");
}

function formatDeferredImageSize(byteSize: number) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return "unknown size";
  }
  if (byteSize >= 1024 * 1024) {
    return `${(byteSize / 1024 / 1024).toFixed(1)} MB`;
  }
  if (byteSize >= 1024) {
    return `${Math.round(byteSize / 1024)} KB`;
  }
  return `${Math.round(byteSize)} B`;
}

function isTransientImageObjectUrl(src: string | undefined, transient: boolean | undefined) {
  return Boolean(transient && src?.startsWith("blob:"));
}

function revokeDeferredImageState(state: DeferredImageState | undefined) {
  const objectUrl = isTransientImageObjectUrl(state?.src, state?.transient)
    ? state?.src
    : null;
  if (objectUrl) {
    revokeOwnedObjectUrl(objectUrl);
  }
}

async function createTransientImageObjectUrl(dataUrl: string) {
  if (!dataUrl.toLowerCase().startsWith("data:image/")) {
    return { src: dataUrl, transient: false };
  }
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return {
      src: createOwnedObjectUrl(blob, {
        ownerId: "message-deferred-image",
      }),
      transient: true,
    };
  } catch {
    return { src: dataUrl, transient: false };
  }
}

type ReasoningRowProps = {
  item: Extract<ConversationItem, { kind: "reasoning" }>;
  workspaceId?: string | null;
  parsed: ReturnType<typeof parseReasoning>;
  isExpanded: boolean;
  isLive: boolean;
  activeEngine?: MessagesEngine;
  onToggle: (id: string) => void;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
  presentationProfile?: PresentationProfile | null;
  streamMitigationProfile?: StreamMitigationProfile | null;
};

type ReviewRowProps = {
  item: Extract<ConversationItem, { kind: "review" }>;
  workspaceId?: string | null;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
};

type DiffRowProps = {
  item: Extract<ConversationItem, { kind: "diff" }>;
};

type ExploreRowProps = {
  item: Extract<ConversationItem, { kind: "explore" }>;
  isExpanded: boolean;
  onToggle: (id: string) => void;
};

type GeneratedImageRowProps = {
  item: Extract<ConversationItem, { kind: "generatedImage" }>;
  workspaceId?: string | null;
};

type MemoryPayloadPackView = {
  source: string;
  count: number;
  cleanedContext: string;
  rawPayload: string;
};

function areMessageImagesEqual(
  previous: Extract<ConversationItem, { kind: "message" }>["images"],
  next: Extract<ConversationItem, { kind: "message" }>["images"],
) {
  if (previous === next) {
    return true;
  }
  if (!previous?.length && !next?.length) {
    return true;
  }
  if (!previous || !next || previous.length !== next.length) {
    return false;
  }
  return previous.every((image, index) => image === next[index]);
}

function areDeferredMessageImagesEqual(
  previous: Extract<ConversationItem, { kind: "message" }>["deferredImages"],
  next: Extract<ConversationItem, { kind: "message" }>["deferredImages"],
) {
  if (previous === next) {
    return true;
  }
  if (!previous?.length && !next?.length) {
    return true;
  }
  if (!previous || !next || previous.length !== next.length) {
    return false;
  }
  return previous.every((image, index) => {
    const nextImage = next[index];
    return (
      nextImage?.workspacePath === image.workspacePath &&
      nextImage.mediaType === image.mediaType &&
      nextImage.estimatedByteSize === image.estimatedByteSize &&
      nextImage.reason === image.reason &&
      nextImage.locator.sessionId === image.locator.sessionId &&
      nextImage.locator.lineIndex === image.locator.lineIndex &&
      nextImage.locator.blockIndex === image.locator.blockIndex &&
      nextImage.locator.messageId === image.locator.messageId &&
      nextImage.locator.mediaType === image.locator.mediaType
    );
  });
}

function areMessageItemsEqual(
  previous: Extract<ConversationItem, { kind: "message" }>,
  next: Extract<ConversationItem, { kind: "message" }>,
) {
  return (
    previous === next ||
    (
      previous.id === next.id &&
      previous.role === next.role &&
      previous.text === next.text &&
      previous.engineSource === next.engineSource &&
      previous.isFinal === next.isFinal &&
      previous.finalCompletedAt === next.finalCompletedAt &&
      previous.finalDurationMs === next.finalDurationMs &&
      previous.selectedAgentName === next.selectedAgentName &&
      previous.selectedAgentIcon === next.selectedAgentIcon &&
      areMessageImagesEqual(previous.images, next.images) &&
      areDeferredMessageImagesEqual(previous.deferredImages, next.deferredImages)
    )
  );
}

function readHighResolutionNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function areMessageRowPropsEqual(
  previous: MessageRowProps,
  next: MessageRowProps,
) {
  return (
    areMessageItemsEqual(previous.item, next.item) &&
    previous.workspaceId === next.workspaceId &&
    previous.threadId === next.threadId &&
    previous.isStreaming === next.isStreaming &&
    previous.activeEngine === next.activeEngine &&
    previous.activeCollaborationModeId === next.activeCollaborationModeId &&
    previous.enableCollaborationBadge === next.enableCollaborationBadge &&
    previous.presentationProfile === next.presentationProfile &&
    previous.showRuntimeReconnectCard === next.showRuntimeReconnectCard &&
    previous.onRecoverThreadRuntime === next.onRecoverThreadRuntime &&
    previous.onRecoverThreadRuntimeAndResend === next.onRecoverThreadRuntimeAndResend &&
    previous.onThreadRecoveryFork === next.onThreadRecoveryFork &&
    previous.retryMessage?.text === next.retryMessage?.text &&
    areMessageImagesEqual(previous.retryMessage?.images, next.retryMessage?.images) &&
    previous.isCopied === next.isCopied &&
    previous.onCopy === next.onCopy &&
    previous.codeBlockCopyUseModifier === next.codeBlockCopyUseModifier &&
    previous.onOpenFileLink === next.onOpenFileLink &&
    previous.onOpenFileLinkMenu === next.onOpenFileLinkMenu &&
    previous.streamMitigationProfile === next.streamMitigationProfile &&
    previous.onAssistantVisibleTextRender === next.onAssistantVisibleTextRender &&
    previous.suppressMemorySummaryCard === next.suppressMemorySummaryCard &&
    previous.suppressNoteCardSummaryCard === next.suppressNoteCardSummaryCard
  );
}

function shouldUsePlainTextStreamingSurface(
  item: Extract<ConversationItem, { kind: "message" }>,
  isStreaming: boolean,
  activeEngine: MessagesEngine,
  mitigationProfile: StreamMitigationProfile | null | undefined,
) {
  return (
    item.role === "assistant" &&
    isStreaming &&
    activeEngine !== "codex" &&
    mitigationProfile?.renderPlainTextWhileStreaming === true
  );
}

function shouldUseLightweightStreamingMarkdown(
  item: Extract<ConversationItem, { kind: "message" }>,
  isStreaming: boolean,
  activeEngine: MessagesEngine,
  presentationProfile: PresentationProfile | null | undefined,
  complexity: StreamingMarkdownComplexity,
) {
  if (item.role !== "assistant" || !isStreaming) {
    return false;
  }
  const useStagedMarkdownThrottle =
    presentationProfile?.useCodexStagedMarkdownThrottle ?? activeEngine === "codex";
  if (!useStagedMarkdownThrottle) {
    return false;
  }
  if (!complexity.trimmedText) {
    return false;
  }
  return (
    complexity.isStructuredHeavy ||
    complexity.isMedium
  );
}

function shouldUseLongFoldedMarkdownStreamingSurface(
  item: Extract<ConversationItem, { kind: "message" }>,
  isStreaming: boolean,
  activeEngine: MessagesEngine,
  text: string,
) {
  return (
    item.role === "assistant" &&
    isStreaming &&
    activeEngine === "claude" &&
    text.length > STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD
  );
}

const STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD = 20_000;
const STREAMING_PLAIN_TEXT_HEAD_CHARS = 4_000;
const STREAMING_PLAIN_TEXT_TAIL_CHARS = 2_000;

function resolveStreamingPlainTextCollapsedView({
  text,
  omittedChars,
  marker,
}: {
  text: string;
  omittedChars: number;
  marker: string;
}) {
  if (text.length <= STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD) {
    return text;
  }
  if (omittedChars <= 0) {
    return text;
  }
  return [
    text.slice(0, STREAMING_PLAIN_TEXT_HEAD_CHARS),
    `\n\n${marker}\n\n`,
    text.slice(-STREAMING_PLAIN_TEXT_TAIL_CHARS),
  ].join("");
}

function areGeneratedImageItemsEqual(
  previous: Extract<ConversationItem, { kind: "generatedImage" }>,
  next: Extract<ConversationItem, { kind: "generatedImage" }>,
) {
  if (previous === next) {
    return true;
  }
  if (
    previous.id !== next.id ||
    previous.status !== next.status ||
    previous.promptText !== next.promptText ||
    previous.fallbackText !== next.fallbackText ||
    previous.anchorUserMessageId !== next.anchorUserMessageId ||
    previous.images.length !== next.images.length
  ) {
    return false;
  }
  return previous.images.every((image, index) => {
    const nextImage = next.images[index];
    return (
      nextImage?.src === image.src &&
      nextImage.localPath === image.localPath
    );
  });
}

function normalizeNoteCardImageIdentity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const hasWindowsDrivePrefix = (candidate: string) => /^[A-Za-z][:|][\\/]/.test(candidate);
  const hasWindowsDriveHost = (candidate: string) => /^[A-Za-z][:|]/.test(candidate);
  const decodePath = (candidate: string) => {
    try {
      return decodeURIComponent(candidate);
    } catch {
      return candidate;
    }
  };

  let withoutFileScheme = trimmed;
  const lowerCased = trimmed.toLowerCase();
  if (lowerCased.startsWith("asset://localhost")) {
    withoutFileScheme = trimmed.slice("asset://localhost".length);
    if (!withoutFileScheme.startsWith("/")) {
      withoutFileScheme = `/${withoutFileScheme}`;
    }
    if (withoutFileScheme.startsWith("//")) {
      withoutFileScheme = withoutFileScheme.slice(1);
    }
    withoutFileScheme = decodePath(withoutFileScheme);
  } else if (lowerCased.startsWith("file://")) {
    const remainder = trimmed.slice("file://".length).trim();
    if (!remainder) {
      return "";
    }
    if (/^localhost\//i.test(remainder)) {
      withoutFileScheme = decodePath(remainder.replace(/^localhost\//i, ""));
    } else if (
      !remainder.startsWith("/")
      && !hasWindowsDrivePrefix(remainder)
      && !hasWindowsDriveHost(remainder)
    ) {
      const slashIndex = remainder.indexOf("/");
      if (slashIndex === -1) {
        withoutFileScheme = `//${remainder}`;
      } else {
        const host = remainder.slice(0, slashIndex);
        const tail = remainder.slice(slashIndex);
        withoutFileScheme = `//${host}${decodePath(tail)}`;
      }
    } else {
      withoutFileScheme = decodePath(remainder.replace(/\|/g, ":"));
    }
    if (
      !withoutFileScheme.startsWith("/")
      && !hasWindowsDrivePrefix(withoutFileScheme)
      && !hasWindowsDriveHost(withoutFileScheme)
    ) {
      withoutFileScheme = `/${withoutFileScheme}`;
    }
  }
  const normalized = withoutFileScheme.replace(/\\/g, "/");
  if (/^\/[A-Za-z]:\//.test(normalized)) {
    return normalized.slice(1).toLowerCase();
  }
  if (/^[A-Za-z]:\//.test(normalized)) {
    return normalized.toLowerCase();
  }
  return normalized;
}

export const WorkingIndicator = memo(function WorkingIndicator({
  isThinking,
  proxyEnabled = false,
  proxyUrl = null,
  processingStartedAt = null,
  lastDurationMs = null,
  heartbeatPulse = 0,
  hasItems,
  reasoningLabel = null,
  activityLabel = null,
  activeEngine = "claude",
  waitingForFirstChunk = false,
  presentationProfile = null,
  streamActivityPhase = "idle",
  primaryLabel = null,
}: WorkingIndicatorProps) {
  const { t } = useTranslation();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!isThinking || !processingStartedAt) {
      setElapsedMs(0);
      return undefined;
    }
    setElapsedMs(Date.now() - processingStartedAt);
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - processingStartedAt);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isThinking, processingStartedAt]);

  const showNonStreamingHint =
    (presentationProfile?.heartbeatWaitingHint ?? activeEngine === "opencode") &&
    isThinking &&
    waitingForFirstChunk &&
    elapsedMs >= OPENCODE_NON_STREAMING_HINT_DELAY_MS;
  const showActivityLabel = shouldDisplayWorkingActivityLabel(
    reasoningLabel,
    activityLabel,
  );
  const supportsStreamActivityPhaseFx =
    activeEngine === "codex" || activeEngine === "claude" || activeEngine === "gemini";
  const streamPhaseClass =
    supportsStreamActivityPhaseFx && streamActivityPhase !== "idle"
      ? ` is-${streamActivityPhase}`
      : "";
  const nonStreamingHintText = t("messages.nonStreamingHint");
  const resolvedNonStreamingHint =
    nonStreamingHintText === "messages.nonStreamingHint"
      ? "This model may return non-streaming output, or the network may be unreachable. Please wait..."
      : nonStreamingHintText;
  const heartbeatHints = useMemo(() => {
    const keys = [
      "messages.opencodeHeartbeatHint1",
      "messages.opencodeHeartbeatHint2",
      "messages.opencodeHeartbeatHint3",
      "messages.opencodeHeartbeatHint4",
      "messages.opencodeHeartbeatHint5",
    ];
    const translated = keys
      .map((key) => t(key))
      .filter((value, index) => value !== keys[index]);
    if (translated.length > 0) {
      return translated;
    }
    return [resolvedNonStreamingHint];
  }, [resolvedNonStreamingHint, t]);
  const [heartbeatHintText, setHeartbeatHintText] = useState("");
  const heartbeatStateRef = useRef<{ lastPulse: number; lastIndex: number }>({
    lastPulse: 0,
    lastIndex: -1,
  });

  useEffect(() => {
    if (!showNonStreamingHint) {
      heartbeatStateRef.current = { lastPulse: 0, lastIndex: -1 };
      setHeartbeatHintText("");
      return;
    }
    if (heartbeatPulse <= 0 || heartbeatPulse === heartbeatStateRef.current.lastPulse) {
      return;
    }
    heartbeatStateRef.current.lastPulse = heartbeatPulse;
    let randomIndex = Math.floor(Math.random() * heartbeatHints.length);
    if (heartbeatHints.length > 1 && randomIndex === heartbeatStateRef.current.lastIndex) {
      randomIndex = (randomIndex + 1) % heartbeatHints.length;
    }
    heartbeatStateRef.current.lastIndex = randomIndex;
    const pulseText = t("messages.opencodeHeartbeatPulse", {
      pulse: heartbeatPulse,
      hint: heartbeatHints[randomIndex],
    });
    setHeartbeatHintText(
      pulseText === "messages.opencodeHeartbeatPulse"
        ? `Heartbeat ${heartbeatPulse}: ${heartbeatHints[randomIndex]}`
        : pulseText,
    );
  }, [heartbeatHints, heartbeatPulse, showNonStreamingHint, t]);

  return (
    <>
      {isThinking && (
        <div className={`working${streamPhaseClass}`}>
          {proxyEnabled && (
            <ProxyStatusBadge
              proxyUrl={proxyUrl}
              label={t("messages.proxyBadge")}
              variant="prominent"
              animated
              className="working-proxy-badge"
            />
          )}
          <span className="working-spinner" aria-hidden />
          <div className="working-timer">
            <span className="working-timer-clock">{formatDurationMs(elapsedMs)}</span>
          </div>
          <span className="working-text">
            {primaryLabel || reasoningLabel || t("messages.generatingResponse")}
          </span>
          {showActivityLabel && <span className="working-activity">{activityLabel}</span>}
          {showNonStreamingHint && (
            <span className="working-hint">
              {heartbeatHintText || resolvedNonStreamingHint}
            </span>
          )}
        </div>
      )}
      {!isThinking && lastDurationMs !== null && hasItems && (
        <div className="turn-complete" aria-live="polite">
          <span className="turn-complete-line" aria-hidden />
          <span className="turn-complete-label">
            {t("messages.doneIn", { duration: formatDurationMs(lastDurationMs) })}
          </span>
          <span className="turn-complete-line" aria-hidden />
        </div>
      )}
    </>
  );
});

export const MessageRow = memo(function MessageRow({
  item,
  workspaceId = null,
  threadId = null,
  isStreaming = false,
  activeEngine = "claude",
  enableCollaborationBadge = false,
  presentationProfile = null,
  showRuntimeReconnectCard = false,
  onRecoverThreadRuntime,
  onRecoverThreadRuntimeAndResend,
  onThreadRecoveryFork,
  retryMessage = null,
  isCopied,
  onCopy,
  codeBlockCopyUseModifier,
  onOpenFileLink,
  onOpenFileLinkMenu,
  streamMitigationProfile = null,
  onAssistantVisibleTextRender,
  suppressMemorySummaryCard = false,
  suppressNoteCardSummaryCard = false,
}: MessageRowProps) {
  const renderStartedAtMs = readHighResolutionNowMs();
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const { t } = useTranslation();
  const lastLongLiveRenderDiagnosticRef = useRef<{
    itemId: string;
    textLength: number;
  }>({ itemId: "", textLength: 0 });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deferredImageStates, setDeferredImageStates] = useState<Record<string, DeferredImageState>>({});
  const deferredImageObjectUrlsRef = useRef(new Set<string>());
  const isMountedRef = useRef(true);
  const [memorySummaryExpanded, setMemorySummaryExpanded] = useState(false);
  const [memoryPayloadDialogOpen, setMemoryPayloadDialogOpen] = useState(false);
  const [isAgentBadgeExpanded, setIsAgentBadgeExpanded] = useState(false);
  const [inspectedTaskOutput, setInspectedTaskOutput] =
    useState<EngineTaskOutputSnapshot | null>(null);
  const inspectedTaskOutputState = useEngineTaskOutputSnapshot({
    workspaceId,
    snapshot: inspectedTaskOutput,
  });
  useEffect(() => {
    if (!memoryPayloadDialogOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMemoryPayloadDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [memoryPayloadDialogOpen]);
  const userMessagePresentation = useMemo(
    () => (
      item.role === "user"
        ? resolveUserMessagePresentation({
            text: item.text,
            selectedAgentName: item.selectedAgentName,
            selectedAgentIcon: item.selectedAgentIcon,
            enableCollaborationBadge,
          })
        : null
    ),
    [
      enableCollaborationBadge,
      item.role,
      item.selectedAgentIcon,
      item.selectedAgentName,
      item.text,
    ],
  );
  const memorySummary = useMemo(
    () =>
      item.role === "assistant"
        ? parseMemoryContextSummary(item.text)
        : userMessagePresentation?.memorySummary ?? null,
    [item.role, item.text, userMessagePresentation?.memorySummary],
  );
  const noteCardSummary = useMemo(
    () =>
      item.role === "assistant"
        ? parseNoteCardContextSummary(item.text)
        : userMessagePresentation?.noteCardSummary ?? null,
    [item.role, item.text, userMessagePresentation?.noteCardSummary],
  );
  const resolvedMemorySummary = suppressMemorySummaryCard ? null : memorySummary;
  const resolvedNoteCardSummary = suppressNoteCardSummaryCard ? null : noteCardSummary;
  const memorySummaryRecords = resolvedMemorySummary?.records ?? [];
  const memorySummaryRawPayload = resolvedMemorySummary?.rawPayload?.trim() ?? "";
  const memoryPayloadPacks: MemoryPayloadPackView[] =
    resolvedMemorySummary?.memoryPacks ?? [];
  const agentTaskNotification = useMemo(
    () => parseAgentTaskNotification(item.text),
    [item.text],
  );
  const browserContextSummary = useMemo(() => {
    if (item.role !== "user") {
      return null;
    }
    return item.browserContextAttachment ?? parseBrowserContextPrompt(item.text);
  }, [item]);
  const intentCanvasContextSummary = useMemo(() => {
    if (item.role !== "user") {
      return null;
    }
    const attachedSummaries = item.intentCanvasContextAttachments ?? [];
    if (attachedSummaries.length > 0) {
      return attachedSummaries;
    }
    return parseIntentCanvasContextSummaries(item.text);
  }, [item.intentCanvasContextAttachments, item.role, item.text]);
  const shouldHideSuppressedInjectedContextText =
    item.role === "user" &&
    !agentTaskNotification &&
    (
      (
        suppressMemorySummaryCard &&
        Boolean(userMessagePresentation?.memorySummary) &&
        (userMessagePresentation?.stickyCandidateText ?? "").trim().length === 0
      ) ||
      (
        suppressNoteCardSummaryCard &&
        Boolean(userMessagePresentation?.noteCardSummary) &&
        (userMessagePresentation?.stickyCandidateText ?? "").trim().length === 0
      )
    );
  const displayText = agentTaskNotification
    ? agentTaskNotification.resultText
    : item.role === "user"
      ? (
          shouldHideSuppressedInjectedContextText
            ? ""
            : stripBrowserContextPrompt(userMessagePresentation?.displayText ?? item.text)
        )
      : resolvedMemorySummary || resolvedNoteCardSummary
        ? ""
        : item.text;
  const messageRowSubtype = agentTaskNotification
    ? "agent-task"
    : item.role === "assistant"
      ? "assistant"
      : "user";
  useEffect(() => {
    appendMessageRowRenderBudgetDiagnostic({
      threadId,
      itemId: item.id,
      role: item.role,
      subtype: messageRowSubtype,
      evidenceKind: "proxy",
      renderCount: renderCountRef.current,
      isStreaming,
      textLength: displayText.length,
    });
  });
  const selectedAgentName = userMessagePresentation?.selectedAgentName ?? null;
  const selectedAgentIcon = userMessagePresentation?.selectedAgentIcon ?? null;
  const hasInjectedAgentPromptBlock =
    userMessagePresentation?.hasInjectedAgentPromptBlock ?? false;
  const hasExternalAgentBadge =
    item.role === "user"
    && !agentTaskNotification
    && (Boolean(selectedAgentName) || hasInjectedAgentPromptBlock);
  const agentTaskDisplay = useMemo(() => {
    if (!agentTaskNotification) {
      return null;
    }
    return {
      ...resolveAgentTaskDisplaySummary(agentTaskNotification.summary),
      status: normalizeAgentTaskStatus(agentTaskNotification.status),
      outputFileName: basenameFromPath(agentTaskNotification.outputFile),
    };
  }, [agentTaskNotification]);
  const agentTaskOutputSnapshot = useMemo(() => {
    if (!agentTaskNotification || !agentTaskDisplay) {
      return null;
    }
    return buildEngineTaskOutputSnapshot(
      buildTaskOutputSourceFromNotification({
        itemId: item.id,
        engine: activeEngine,
        title: agentTaskDisplay.title,
        notification: agentTaskNotification,
      }),
      null,
    );
  }, [activeEngine, agentTaskDisplay, agentTaskNotification, item.id]);
  useEffect(() => {
    setIsAgentBadgeExpanded(false);
  }, [item.id, selectedAgentIcon, selectedAgentName]);
  useEffect(() => {
    setInspectedTaskOutput(null);
  }, [item.id]);
  const handleToggleAgentBadge = useCallback(() => {
    setIsAgentBadgeExpanded((current) => !current);
  }, []);
  const hasText = displayText.trim().length > 0;
  const parsedUserTextContent = useMemo(
    () => (
      item.role === "user" && !agentTaskNotification && hasText
        ? parseUserTextContent(displayText)
        : null
    ),
    [agentTaskNotification, displayText, hasText, item.role],
  );
  const noteCardImagePathSet = useMemo(
    () =>
      new Set(
        (noteCardSummary?.imagePaths ?? []).map((path) =>
          normalizeNoteCardImageIdentity(path),
        ),
      ),
    [noteCardSummary?.imagePaths],
  );
  const imageItems = useMemo(() => {
    if (!item.images || item.images.length === 0) {
      return [];
    }
    return item.images
      .filter((image) => !noteCardImagePathSet.has(normalizeNoteCardImageIdentity(image)))
      .map((image, index) => {
        const src = normalizeMessageImageSrc(image);
        if (!src) {
          return null;
        }
        return { src, label: `Image ${index + 1}` };
      })
      .filter(Boolean) as MessageImage[];
  }, [item.images, noteCardImagePathSet]);
  const deferredImageItems = item.deferredImages ?? [];
  const revokeTrackedDeferredImageState = useCallback((state: DeferredImageState | undefined) => {
    const objectUrl = isTransientImageObjectUrl(state?.src, state?.transient)
      ? state?.src ?? null
      : null;
    revokeDeferredImageState(state);
    if (objectUrl) {
      deferredImageObjectUrlsRef.current.delete(objectUrl);
    }
  }, []);
  const handleLoadDeferredImage = useCallback(
    async (
      image: NonNullable<Extract<ConversationItem, { kind: "message" }>["deferredImages"]>[number],
    ) => {
      const key = deferredImageKey(image);
      if (!image.workspacePath) {
        setDeferredImageStates((current) => {
          revokeTrackedDeferredImageState(current[key]);
          return {
            ...current,
            [key]: {
              status: "error",
              error: "Missing workspace path for this Claude image.",
            },
          };
        });
        return;
      }
      setDeferredImageStates((current) => {
        revokeTrackedDeferredImageState(current[key]);
        return {
          ...current,
          [key]: { status: "loading" },
        };
      });
      try {
        const hydrated = await hydrateClaudeDeferredImage(
          image.workspacePath,
          image.locator,
        );
        const transientImage = await createTransientImageObjectUrl(hydrated.src);
        const loadedState: DeferredImageState = {
          status: "loaded",
          src: transientImage.src,
          transient: transientImage.transient,
        };
        const loadedObjectUrl = isTransientImageObjectUrl(
          loadedState.src,
          loadedState.transient,
        )
          ? loadedState.src
          : null;
        if (loadedObjectUrl) {
          deferredImageObjectUrlsRef.current.add(loadedObjectUrl);
        }
        if (!isMountedRef.current) {
          revokeDeferredImageState(loadedState);
          if (loadedObjectUrl) {
            deferredImageObjectUrlsRef.current.delete(loadedObjectUrl);
          }
          return;
        }
        setDeferredImageStates((current) => {
          revokeTrackedDeferredImageState(current[key]);
          return {
            ...current,
            [key]: loadedState,
          };
        });
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }
        setDeferredImageStates((current) => {
          revokeTrackedDeferredImageState(current[key]);
          return {
            ...current,
            [key]: {
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            },
          };
        });
      }
    },
    [revokeTrackedDeferredImageState],
  );
  const deferredImageStatesRef = useRef(deferredImageStates);
  useEffect(() => {
    deferredImageStatesRef.current = deferredImageStates;
  }, [deferredImageStates]);
  useEffect(() => () => {
    isMountedRef.current = false;
    Object.values(deferredImageStatesRef.current).forEach(revokeTrackedDeferredImageState);
    deferredImageObjectUrlsRef.current.forEach((objectUrl) => {
      revokeOwnedObjectUrl(objectUrl);
    });
    deferredImageObjectUrlsRef.current.clear();
  }, [revokeTrackedDeferredImageState]);
  const hideCopyButton = (
    !hasText
    && imageItems.length === 0
    && deferredImageItems.length === 0
  ) || (
    item.role === "assistant"
    && (Boolean(resolvedMemorySummary) || Boolean(resolvedNoteCardSummary))
    && !hasText
    && imageItems.length === 0
    && deferredImageItems.length === 0
  );
  const shouldRenderMessageActions = !hideCopyButton && item.role !== "assistant";
  const useCodexCanvasMarkdown = presentationProfile
    ? presentationProfile.codexCanvasMarkdown
    : activeEngine === "codex";
  const useStagedMarkdownThrottle =
    presentationProfile?.useCodexStagedMarkdownThrottle ?? activeEngine === "codex";
  const markdownClassName =
    item.role === "assistant" && useCodexCanvasMarkdown
      ? "markdown markdown-codex-canvas"
      : "markdown";
  const resolvedMarkdownClassName = isStreaming
    ? `${markdownClassName} markdown-live-streaming`
    : markdownClassName;
  const streamingMarkdownComplexityCacheRef = useRef<{
    value: string;
    complexity: StreamingMarkdownComplexity;
  } | null>(null);
  const streamingMarkdownComplexity = useMemo(
    () => {
      if (
        item.role !== "assistant" ||
        !isStreaming ||
        !useStagedMarkdownThrottle
      ) {
        streamingMarkdownComplexityCacheRef.current = null;
        return EMPTY_STREAMING_MARKDOWN_COMPLEXITY;
      }
      const previousCache = streamingMarkdownComplexityCacheRef.current;
      if (previousCache) {
        // chat-stream-render-isolation-2026-06 task 3.1: prefer the delta
        // path when displayText strictly extends the cached prefix, so
        // long streaming bursts avoid re-scanning the full prefix.
        if (displayText === previousCache.value) {
          return previousCache.complexity;
        }
        if (displayText.startsWith(previousCache.value)) {
          const deltaText = displayText.slice(previousCache.value.length);
          const nextComplexity = analyzeStreamingMarkdownComplexityDelta(
            previousCache.complexity,
            previousCache.value,
            deltaText,
          );
          streamingMarkdownComplexityCacheRef.current = {
            value: displayText,
            complexity: nextComplexity,
          };
          return nextComplexity;
        }
        if (previousCache.complexity.isHuge) {
          return previousCache.complexity;
        }
      }
      const nextComplexity = analyzeStreamingMarkdownComplexity(displayText);
      streamingMarkdownComplexityCacheRef.current = {
        value: displayText,
        complexity: nextComplexity,
      };
      return nextComplexity;
    },
    [displayText, isStreaming, item.role, useStagedMarkdownThrottle],
  );
  const usePlainTextStreamingSurface = shouldUsePlainTextStreamingSurface(
    item,
    isStreaming,
    activeEngine,
    streamMitigationProfile,
  );
  const useLongFoldedMarkdownStreamingSurface = shouldUseLongFoldedMarkdownStreamingSurface(
    item,
    isStreaming,
    activeEngine,
    displayText,
  );
  const useLightweightStreamingMarkdown = !usePlainTextStreamingSurface && (
    useLongFoldedMarkdownStreamingSurface ||
    shouldUseLightweightStreamingMarkdown(
      item,
      isStreaming,
      activeEngine,
      presentationProfile,
      streamingMarkdownComplexity,
    )
  );
  const livePlainTextClassName = `${resolvedMarkdownClassName} markdown-live-plain-text`;
  const streamingPlainTextCollapsedOmittedChars = useMemo(() => {
    if (!useLongFoldedMarkdownStreamingSurface) {
      return 0;
    }
    const omitted = displayText.length - (
      STREAMING_PLAIN_TEXT_HEAD_CHARS + STREAMING_PLAIN_TEXT_TAIL_CHARS
    );
    return Math.max(omitted, 0);
  }, [displayText.length, useLongFoldedMarkdownStreamingSurface]);
  const liveFoldedStreamingSurfaceText = useMemo(() => {
    if (!useLongFoldedMarkdownStreamingSurface || streamingPlainTextCollapsedOmittedChars <= 0) {
      return displayText;
    }
    return resolveStreamingPlainTextCollapsedView({
      text: displayText,
      omittedChars: streamingPlainTextCollapsedOmittedChars,
      marker: t("messages.streamingPlainTextCollapsed", {
        omittedChars: streamingPlainTextCollapsedOmittedChars,
      }),
    });
  }, [displayText, streamingPlainTextCollapsedOmittedChars, t, useLongFoldedMarkdownStreamingSurface]);
  const handleRenderedAssistantValue = useCallback(
    (visibleText: string) => {
      if (item.role !== "assistant" || !isStreaming) {
        return;
      }
      onAssistantVisibleTextRender?.({
        itemId: item.id,
        visibleText,
      });
    },
    [isStreaming, item.id, item.role, onAssistantVisibleTextRender],
  );
  const handleMarkdownRenderedAssistantValue = useCallback(
    (visibleText: string) => {
      handleRenderedAssistantValue(
        useLongFoldedMarkdownStreamingSurface ? displayText : visibleText,
      );
    },
    [displayText, handleRenderedAssistantValue, useLongFoldedMarkdownStreamingSurface],
  );
  useEffect(() => {
    if (!usePlainTextStreamingSurface) {
      return;
    }
    handleRenderedAssistantValue(displayText);
  }, [
    displayText,
    handleRenderedAssistantValue,
    usePlainTextStreamingSurface,
  ]);
  useEffect(() => {
    if (
      !threadId ||
      item.role !== "assistant" ||
      !isStreaming ||
      displayText.length <= STREAMING_PLAIN_TEXT_COLLAPSE_THRESHOLD
    ) {
      return;
    }
    const previousDiagnostic = lastLongLiveRenderDiagnosticRef.current;
    if (
      previousDiagnostic.itemId === item.id &&
      displayText.length - previousDiagnostic.textLength < 2_048
    ) {
      return;
    }
    lastLongLiveRenderDiagnosticRef.current = {
      itemId: item.id,
      textLength: displayText.length,
    };
    noteThreadLiveRowRenderMeasured(threadId, {
      itemId: item.id,
      textLength: displayText.length,
      renderCostMs: readHighResolutionNowMs() - renderStartedAtMs,
    });
  }, [displayText.length, isStreaming, item.id, item.role, renderStartedAtMs, threadId]);
  const provenanceLabel = resolveProvenanceEngineLabel(item.engineSource);
  const runtimeReconnectHint = useMemo(
    () => (
      item.role === "assistant"
        ? resolveAssistantRuntimeReconnectHint(item, Boolean(agentTaskNotification))
        : null
    ),
    [agentTaskNotification, item],
  );

  const bubbleNode = (
    <div className={`bubble message-bubble${agentTaskNotification ? " message-bubble-agent-task" : ""}`}>
      {item.role === "assistant" && provenanceLabel ? (
        <div className="message-provenance-row">
          <span className="message-provenance-badge">{provenanceLabel}</span>
        </div>
      ) : null}
      {agentTaskNotification && agentTaskDisplay ? (
        <div className="message-agent-task-card">
          <div className="message-agent-task-header">
            <div className="message-agent-task-avatar" aria-hidden>
              <AgentIcon
                seed={agentTaskDisplay.title || agentTaskNotification.taskId || item.id}
                fallback="codicon-hubot"
                className="message-agent-task-avatar-icon"
                size={18}
              />
            </div>
            <div className="message-agent-task-heading">
              <span className="message-agent-task-eyebrow">Agent session</span>
              <strong className="message-agent-task-title">{agentTaskDisplay.title}</strong>
              {agentTaskDisplay.subtitle ? (
                <span className="message-agent-task-subtitle">{agentTaskDisplay.subtitle}</span>
              ) : null}
            </div>
            <span className={`message-agent-task-status is-${agentTaskDisplay.status.tone}`}>
              {agentTaskDisplay.status.label}
            </span>
          </div>
          <div className="message-agent-task-meta">
            {agentTaskNotification.taskId ? (
              <span className="message-agent-task-chip">task {agentTaskNotification.taskId}</span>
            ) : null}
            {agentTaskNotification.toolUseId ? (
              <span className="message-agent-task-chip">tool {agentTaskNotification.toolUseId}</span>
            ) : null}
            {agentTaskDisplay.outputFileName ? (
              <span className="message-agent-task-chip">{agentTaskDisplay.outputFileName}</span>
            ) : null}
          </div>
          {agentTaskOutputSnapshot ? (
            <button
              type="button"
              className="engine-task-output-card-action"
              onClick={() => setInspectedTaskOutput(agentTaskOutputSnapshot)}
            >
              {t("engineTaskOutput.inspect")}
            </button>
          ) : null}
          {inspectedTaskOutput ? (
            <div className="engine-task-output-inline">
              <EngineTaskOutputInspector
                snapshot={inspectedTaskOutputState.snapshot ?? inspectedTaskOutput}
                refreshState={inspectedTaskOutputState.refreshState}
                onRefresh={inspectedTaskOutputState.refresh}
                onClose={() => setInspectedTaskOutput(null)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {imageItems.length > 0 && (
        <MessageImageGrid
          images={imageItems}
          onOpen={setLightboxIndex}
          hasText={hasText}
        />
      )}
      {deferredImageItems.length > 0 ? (
        <div className="message-deferred-image-list" role="list">
          {deferredImageItems.map((image, index) => {
            const key = deferredImageKey(image);
            const state = deferredImageStates[key] ?? { status: "idle" };
            return (
              <div
                key={key}
                className={`message-deferred-image is-${state.status}`}
                role="listitem"
              >
                {state.status === "loaded" && state.src ? (
                  <div
                    className="message-deferred-image-preview"
                  >
                    <img src={state.src} alt={`Deferred Claude image ${index + 1}`} loading="lazy" />
                  </div>
                ) : (
                  <>
                    <div className="message-deferred-image-copy">
                      <span className="message-deferred-image-title">
                        Claude history image available on demand
                      </span>
                      <span className="message-deferred-image-meta">
                        {image.mediaType} · {formatDeferredImageSize(image.estimatedByteSize)}
                      </span>
                      {state.status === "error" && state.error ? (
                        <span className="message-deferred-image-error">{state.error}</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="message-deferred-image-action"
                      onClick={() => void handleLoadDeferredImage(image)}
                      disabled={state.status === "loading"}
                    >
                      {state.status === "loading" ? "Loading..." : "Load image"}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      {runtimeReconnectHint && showRuntimeReconnectCard ? (
        <RuntimeReconnectCard
          hint={runtimeReconnectHint}
          workspaceId={workspaceId}
          threadId={threadId}
          onRecoverThreadRuntime={onRecoverThreadRuntime}
          retryMessage={retryMessage}
          onRecoverThreadRuntimeAndResend={onRecoverThreadRuntimeAndResend}
          onThreadRecoveryFork={onThreadRecoveryFork}
        />
      ) : null}
      {hasText && (
        item.role === "user" && !agentTaskNotification ? (
          <CollapsibleUserTextBlock
            content={displayText}
            parsedContent={parsedUserTextContent ?? undefined}
          />
        ) : runtimeReconnectHint && showRuntimeReconnectCard ? null : usePlainTextStreamingSurface ? (
          <div className={livePlainTextClassName}>
            {useLongFoldedMarkdownStreamingSurface ? liveFoldedStreamingSurfaceText : displayText}
          </div>
        ) : (
          <Markdown
            value={useLongFoldedMarkdownStreamingSurface ? liveFoldedStreamingSurfaceText : displayText}
            className={resolvedMarkdownClassName}
            workspaceId={workspaceId}
            codeBlockStyle="message"
            codeBlockCopyUseModifier={codeBlockCopyUseModifier}
            streamingThrottleMs={resolveAssistantMessageStreamingThrottleMs(
              item,
              isStreaming,
              activeEngine,
              streamMitigationProfile,
              presentationProfile,
              streamingMarkdownComplexity,
            )}
            onOpenFileLink={onOpenFileLink}
            onOpenFileLinkMenu={onOpenFileLinkMenu}
            liveRenderMode={useLightweightStreamingMarkdown ? "lightweight" : "full"}
            progressiveReveal={useLightweightStreamingMarkdown}
            onRenderedValueChange={handleMarkdownRenderedAssistantValue}
          />
        )
      )}
      {lightboxIndex !== null && imageItems.length > 0 && (
        <ImageLightbox
          images={imageItems}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      {shouldRenderMessageActions && (
        <div
          className="message-action-bar message-action-bar-overlay"
          aria-label={t("messages.messageActions")}
        >
          <button
            type="button"
            className={`ghost message-action-button message-copy-button${isCopied ? " is-copied" : ""}`}
            onClick={() => onCopy(item, displayText || item.text)}
            aria-label={t("messages.copyMessage")}
            title={t("messages.copyMessage")}
          >
            <span className="message-copy-icon" aria-hidden>
              <Copy className="message-copy-icon-copy" size={12} />
              <Check className="message-copy-icon-check" size={12} />
            </span>
          </button>
        </div>
      )}
    </div>
  );
  const codeAnnotationContextNode =
    parsedUserTextContent && parsedUserTextContent.codeAnnotations.length > 0 ? (
      <UserCodeAnnotationContextBlock annotations={parsedUserTextContent.codeAnnotations} />
    ) : null;
  const noteCardSummaryNode = resolvedNoteCardSummary ? (
    <NoteCardContextSummaryCard
      summary={resolvedNoteCardSummary}
      workspaceId={workspaceId}
      codeBlockCopyUseModifier={codeBlockCopyUseModifier}
      onOpenFileLink={onOpenFileLink}
      onOpenFileLinkMenu={onOpenFileLinkMenu}
    />
  ) : null;
  const browserContextSummaryNode = browserContextSummary ? (
    <BrowserContextSummaryCard attachment={browserContextSummary} />
  ) : null;
  const intentCanvasContextSummaryNode =
    intentCanvasContextSummary && intentCanvasContextSummary.length > 0 ? (
      <>
        {intentCanvasContextSummary.map((summary) => (
          <IntentCanvasContextSummaryCard
            key={summary.attachmentId}
            summary={summary}
          />
        ))}
      </>
    ) : null;
  const shouldRenderBubble =
    agentTaskNotification
    || imageItems.length > 0
    || deferredImageItems.length > 0
    || (Boolean(runtimeReconnectHint) && showRuntimeReconnectCard)
    || hasText
    || shouldRenderMessageActions;
  const memoryPayloadDialogNode =
    memoryPayloadDialogOpen && memorySummaryRawPayload && typeof document !== "undefined"
      ? createPortal(
        <div
          className="memory-context-payload-dialog-overlay"
          role="presentation"
          onClick={() => setMemoryPayloadDialogOpen(false)}
        >
          <div
            className="memory-context-payload-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${item.id}-memory-payload-title`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="memory-context-payload-dialog-header">
              <div>
                <h3 id={`${item.id}-memory-payload-title`}>
                  {t("messages.memoryContextSentDetailsTitle")}
                </h3>
                <p>{t("messages.memoryContextSentDetailsHint")}</p>
              </div>
              <button
                type="button"
                className="memory-context-payload-dialog-close"
                aria-label={t("messages.memoryContextCloseDetails")}
                onClick={() => setMemoryPayloadDialogOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="memory-context-payload-dialog-body">
              {memoryPayloadPacks.length > 0 ? (
                <div className="memory-context-payload-pack-list">
                  {memoryPayloadPacks.map((pack, packIndex) => (
                    <section
                      key={`${item.id}-memory-payload-pack-${packIndex}`}
                      className="memory-context-payload-pack"
                    >
                      <div className="memory-context-payload-pack-header">
                        <span className="memory-context-payload-pack-title">
                          {t("messages.memoryContextPayloadPackTitle", {
                            index: packIndex + 1,
                          })}
                        </span>
                        <span className="memory-context-payload-pack-meta">
                          {t("messages.memoryContextPayloadPackMeta", {
                            source: pack.source || t("messages.memoryContextSourceUnknown"),
                            count: Number(pack.count),
                          })}
                        </span>
                      </div>
                      <div className="memory-context-payload-section-label">
                        {t("messages.memoryContextPayloadCleanedContext")}
                      </div>
                      <Markdown
                        value={pack.cleanedContext}
                        className="markdown memory-context-payload-markdown"
                        workspaceId={workspaceId}
                        codeBlockStyle="message"
                        codeBlockCopyUseModifier={codeBlockCopyUseModifier}
                        onOpenFileLink={onOpenFileLink}
                        onOpenFileLinkMenu={onOpenFileLinkMenu}
                      />
                    </section>
                  ))}
                </div>
              ) : (
                <Markdown
                  value={memorySummaryRawPayload}
                  className="markdown memory-context-payload-markdown"
                  workspaceId={workspaceId}
                  codeBlockStyle="message"
                  codeBlockCopyUseModifier={codeBlockCopyUseModifier}
                  onOpenFileLink={onOpenFileLink}
                  onOpenFileLinkMenu={onOpenFileLinkMenu}
                />
              )}
              <details className="memory-context-payload-raw">
                <summary>{t("messages.memoryContextPayloadRaw")}</summary>
                <pre className="memory-context-payload-dialog-code">
                  <code>{memorySummaryRawPayload}</code>
                </pre>
              </details>
            </div>
          </div>
        </div>,
        document.body,
      )
      : null;
  const memorySummaryNode = resolvedMemorySummary ? (
    <>
      <div className="memory-context-summary-card">
        <button
          type="button"
          className="memory-context-summary-toggle"
          onClick={() => setMemorySummaryExpanded((current) => !current)}
          aria-expanded={memorySummaryExpanded}
        >
          <span className="memory-context-summary-title">
            {t("messages.memoryContextSummary")}
          </span>
          <span className="memory-context-summary-count">
            {t("messages.memoryContextSummaryCount", {
              count: resolvedMemorySummary.lines.length,
            })}
          </span>
          {memorySummaryExpanded ? (
            <ChevronUp size={14} aria-hidden />
          ) : (
            <ChevronDown size={14} aria-hidden />
          )}
        </button>
        {memorySummaryExpanded && (
          <div className="memory-context-summary-content">
            {memorySummaryRecords.length > 0 ? (
              <div className="memory-context-summary-record-list">
                {memorySummaryRecords.map((record) => {
                  const sourceLabel = record.source === "manual-selection"
                    ? t("messages.memoryContextSourceManual")
                    : record.source === "memory-scout"
                      ? t("messages.memoryContextSourceMemoryReference")
                      : (record.source || t("messages.memoryContextSourceUnknown"));
                  return (
                    <div
                      key={`${item.id}-${record.displayIndex}-${record.index}-${record.memoryId}`}
                      className="memory-context-summary-record"
                    >
                      <span className="memory-context-summary-record-index">
                        {record.displayIndex}
                      </span>
                      <span className="memory-context-summary-record-copy">
                        <span className="memory-context-summary-record-title">
                          {record.title || record.memoryId}
                        </span>
                        <span className="memory-context-summary-record-meta">
                          {t("messages.memoryContextRecordMeta", {
                            source: sourceLabel,
                            index: record.index,
                          })}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Markdown
                value={resolvedMemorySummary.markdown ?? resolvedMemorySummary.lines.join("\n\n")}
                className="markdown memory-context-summary-markdown"
                workspaceId={workspaceId}
                codeBlockStyle="message"
                codeBlockCopyUseModifier={codeBlockCopyUseModifier}
                onOpenFileLink={onOpenFileLink}
                onOpenFileLinkMenu={onOpenFileLinkMenu}
              />
            )}
            {memorySummaryRawPayload ? (
              <button
                type="button"
                className="memory-context-summary-detail-button"
                onClick={() => setMemoryPayloadDialogOpen(true)}
              >
                {t("messages.memoryContextViewSentDetails")}
              </button>
            ) : null}
          </div>
        )}
      </div>
      {memoryPayloadDialogNode}
    </>
  ) : null;
  if (!memorySummaryNode && !noteCardSummaryNode && !browserContextSummaryNode && !intentCanvasContextSummaryNode && !codeAnnotationContextNode && !shouldRenderBubble) {
    return null;
  }
  const stackedContent = memorySummaryNode || noteCardSummaryNode || browserContextSummaryNode || intentCanvasContextSummaryNode || codeAnnotationContextNode ? (
    <div className={`message-context-stack${item.role === "user" ? " is-user" : ""}`}>
      {memorySummaryNode}
      {codeAnnotationContextNode}
      {browserContextSummaryNode}
      {intentCanvasContextSummaryNode}
      {noteCardSummaryNode}
      {shouldRenderBubble ? bubbleNode : null}
    </div>
  ) : bubbleNode;

  const agentBadgeNode = hasExternalAgentBadge ? (
    <div className={`message-user-agent-rail${isAgentBadgeExpanded ? " is-open" : ""}`}>
      <button
        type="button"
        className="message-agent-icon-button"
        onClick={handleToggleAgentBadge}
        aria-expanded={isAgentBadgeExpanded}
        aria-label={
          selectedAgentName
            ? t("messages.agentBadgeWithNameAriaLabel", { name: selectedAgentName })
            : t("messages.agentBadgeAriaLabel")
        }
        title={selectedAgentName ?? undefined}
      >
        <AgentIcon
          icon={selectedAgentIcon}
          seed={selectedAgentName ?? item.id}
          fallback="codicon-hubot"
          className="message-agent-icon-glyph"
          size={30}
        />
      </button>
      {isAgentBadgeExpanded && selectedAgentName && (
        <div className="message-agent-reveal is-visible" role="status">
          <span className="message-agent-tag-text">{selectedAgentName}</span>
        </div>
      )}
    </div>
  ) : null;

  const messageClassName = [
    "message",
    item.role,
    agentTaskNotification ? "message-agent-task" : "",
    item.role === "assistant" && isStreaming ? "is-live-streaming" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={messageClassName}>
      {hasExternalAgentBadge ? (
        <div className="message-user-layout">
          {agentBadgeNode}
          {stackedContent}
        </div>
      ) : stackedContent}
    </div>
  );
}, areMessageRowPropsEqual);

export const ReasoningRow = memo(function ReasoningRow({
  item,
  workspaceId = null,
  parsed,
  isExpanded,
  isLive,
  activeEngine,
  onToggle,
  onOpenFileLink,
  onOpenFileLinkMenu,
  presentationProfile = null,
  streamMitigationProfile = null,
}: ReasoningRowProps) {
  const { t } = useTranslation();
  const { bodyText } = parsed;
  const shouldPreferRawClaudeContent =
    activeEngine === "claude" &&
    item.summary.trim().length > 0 &&
    item.content.trim().length > 0 &&
    item.summary.trim() === item.content.trim() &&
    item.content.includes("\n");
  const thinkingText = shouldPreferRawClaudeContent
    ? item.content
    : bodyText || item.content || item.summary || "";
  if (activeEngine === "codex" && thinkingText.trim() === "Encrypted reasoning") {
    return null;
  }
  const title = activeEngine === "claude"
    ? t("messages.thinkingLabel")
    : isLive
      ? t("messages.thinkingProcess")
      : t("messages.thinkingLabel");
  const provenanceLabel = resolveProvenanceEngineLabel(item.engineSource);
  return (
    <div className={`thinking-block${isExpanded ? " is-expanded" : ""}${isLive ? " is-live" : ""}`}>
      <button
        type="button"
        className="thinking-header"
        onClick={() => onToggle(item.id)}
      >
        <span className="thinking-header-copy">
          <span className="codicon codicon-thinking thinking-glyph" aria-hidden />
          <span className="thinking-title">{title}</span>
          {provenanceLabel ? (
            <span className="message-provenance-badge thinking-provenance-badge">
              {provenanceLabel}
            </span>
          ) : null}
        </span>
        <span
          className={`codicon thinking-icon ${isExpanded ? "codicon-chevron-down" : "codicon-chevron-right"}`}
          aria-hidden
        />
      </button>
      <div
        className="thinking-content"
        style={{ display: isExpanded ? "block" : "none" }}
      >
        {thinkingText ? (
          <div className="reasoning-markdown-surface">
            <Markdown
              value={thinkingText}
              className={`markdown reasoning-markdown${isLive ? " markdown-live-streaming" : ""}`}
              workspaceId={workspaceId}
              codeBlockStyle="message"
              streamingThrottleMs={resolveReasoningStreamingThrottleMs(
                isLive,
                streamMitigationProfile,
                presentationProfile,
              )}
              onOpenFileLink={onOpenFileLink}
              onOpenFileLinkMenu={onOpenFileLinkMenu}
            />
          </div>
        ) : (
          <span>{t("messages.noThinkingContent")}</span>
        )}
      </div>
    </div>
  );
});

export const GeneratedImageRow = memo(function GeneratedImageRow({
  item,
  workspaceId = null,
}: GeneratedImageRowProps) {
  const { t } = useTranslation();
  const generatedImageTitle = t("messages.generatedImageTitle");
  const generatedImageProcessingLabel = t("messages.generatedImageProcessing");
  const generatedImageCompletedLabel = t("messages.generatedImageCompleted");
  const generatedImageDegradedLabel = t("messages.generatedImageDegraded");
  const generatedImageProcessingHint = t("messages.generatedImageProcessingHint");
  const generatedImageDegradedHint = t("messages.generatedImageDegradedHint");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const imageItems = useMemo(
    () =>
      item.images.map((image, index) => ({
        src: image.src,
        label: t("messages.generatedImagePreviewLabel", {
          index: index + 1,
        }),
        localPath: image.localPath ?? null,
      })),
    [item.images, t],
  );
  const statusLabel =
    item.status === "processing"
      ? generatedImageProcessingLabel
      : item.status === "completed"
        ? generatedImageCompletedLabel
        : generatedImageDegradedLabel;
  const statusClassName =
    item.status === "processing"
      ? "is-processing"
      : item.status === "completed"
        ? "is-completed"
        : "is-degraded";

  return (
    <div
      className="message-generated-image-card"
      data-generated-image-anchor={item.anchorUserMessageId ?? undefined}
    >
      <div className="message-generated-image-header">
        <div className="message-generated-image-title-group">
          <span className="message-generated-image-eyebrow">
            {generatedImageTitle}
          </span>
          {item.promptText ? (
            <div className="message-generated-image-prompt">{item.promptText}</div>
          ) : null}
        </div>
        <span className={`message-generated-image-status ${statusClassName}`}>
          {statusLabel}
        </span>
      </div>
      {item.status === "processing" ? (
        <div className="message-generated-image-hint">
          {generatedImageProcessingHint}
        </div>
      ) : null}
      {imageItems.length > 0 ? (
        <div className="message-generated-image-grid" role="list">
          {imageItems.map((image, index) => (
            <button
              key={`${item.id}-${index}`}
              type="button"
              className="message-generated-image-thumb"
              onClick={() => setLightboxIndex(index)}
              aria-label={image.label}
            >
              <LocalImage
                src={image.src}
                localPath={image.localPath}
                workspaceId={workspaceId}
                alt={image.label}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
      {item.status === "degraded" ? (
        <div className="message-generated-image-hint">
          {item.fallbackText || generatedImageDegradedHint}
        </div>
      ) : null}
      {lightboxIndex !== null && imageItems.length > 0 ? (
        <ImageLightbox
          images={imageItems.map(({ src, label }) => ({ src, label }))}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </div>
  );
}, (previous, next) => (
  previous.workspaceId === next.workspaceId
  && areGeneratedImageItemsEqual(previous.item, next.item)
));

export const ReviewRow = memo(function ReviewRow({
  item,
  workspaceId = null,
  onOpenFileLink,
  onOpenFileLinkMenu,
}: ReviewRowProps) {
  const title = item.state === "started" ? "Review started" : "Review completed";
  return (
    <div className="item-card review">
      <div className="review-header">
        <span className="review-title">{title}</span>
        <span
          className={`review-badge ${item.state === "started" ? "active" : "done"}`}
        >
          Review
        </span>
      </div>
      {item.text && (
        <Markdown
          value={item.text}
          className="item-text markdown"
          workspaceId={workspaceId}
          onOpenFileLink={onOpenFileLink}
          onOpenFileLinkMenu={onOpenFileLinkMenu}
        />
      )}
    </div>
  );
});

export const DiffRow = memo(function DiffRow({ item }: DiffRowProps) {
  return (
    <div className="item-card diff">
      <div className="diff-header">
        <span className="diff-title">{item.title}</span>
        {item.status && <span className="item-status">{item.status}</span>}
      </div>
      <div className="diff-viewer-output">
        <DiffBlock diff={item.diff} language={languageFromPath(item.title)} />
      </div>
    </div>
  );
});

function exploreKindLabel(kind: ExploreRowProps["item"]["entries"][number]["kind"]) {
  return (kind[0] ?? "").toUpperCase() + kind.slice(1);
}

function buildInlineExploreTitle(
  title: string,
  entry: ExploreRowProps["item"]["entries"][number] | undefined,
) {
  if (!entry) {
    return title;
  }
  const detail = entry.detail && entry.detail !== entry.label ? entry.detail : "";
  return [title, "·", exploreKindLabel(entry.kind), entry.label, detail]
    .filter(Boolean)
    .join(" ");
}

export const ExploreRow = memo(function ExploreRow({
  item,
  isExpanded,
  onToggle,
}: ExploreRowProps) {
  const { t } = useTranslation();
  const title = item.title ?? (item.status === "exploring" ? "Exploring" : "Explored");
  const isCollapsible =
    item.collapsible ?? (item.status === "explored" && item.entries.length > 0);
  const listCollapsed = isCollapsible && !isExpanded;
  const inlineSummary = listCollapsed;
  const rowClassName = `tool-inline explore-inline${isCollapsible ? " is-collapsible" : ""}${
    listCollapsed ? " is-collapsed" : ""
  }${inlineSummary ? " is-inline-summary" : ""}`;
  const displayTitle = inlineSummary
    ? buildInlineExploreTitle(title, item.entries[0])
    : title;
  const handleToggle = () => {
    if (!isCollapsible) {
      return;
    }
    onToggle(item.id);
  };
  return (
    <div className={rowClassName}>
      <div className="tool-inline-content">
        <div className="explore-inline-header">
          {isCollapsible ? (
            <button
              type="button"
              className="explore-inline-header-toggle"
              onClick={handleToggle}
              aria-expanded={isExpanded}
              aria-label={`${displayTitle} · ${t("messages.toggleDetails")}`}
            >
              <Terminal
                className={`tool-inline-icon explore-inline-toggle-icon${
                  isExpanded ? " is-expanded" : ""
                } ${item.status === "exploring" ? "processing" : "completed"}`}
                size={14}
                aria-hidden
              />
              <span className="explore-inline-title" title={displayTitle}>
                {displayTitle}
              </span>
            </button>
          ) : (
            <>
              <Terminal
                className={`tool-inline-icon ${
                  item.status === "exploring" ? "processing" : "completed"
                }`}
                size={14}
                aria-hidden
              />
              <span className="explore-inline-title" title={displayTitle}>
                {displayTitle}
              </span>
            </>
          )}
        </div>
        <div className={`explore-inline-list${listCollapsed ? " is-collapsed" : ""}`}>
          {item.entries.map((entry, index) => (
            <div key={`${entry.kind}-${entry.label}-${index}`} className="explore-inline-item">
              <span className="explore-inline-kind">{exploreKindLabel(entry.kind)}</span>
              <span className="explore-inline-label">{entry.label}</span>
              {entry.detail && entry.detail !== entry.label && (
                <span className="explore-inline-detail">{entry.detail}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
