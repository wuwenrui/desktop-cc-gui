import type {
  AccessMode,
  ApprovalRequest,
  ConversationItem,
  OpenAppTarget,
  QueuedMessage,
  RequestUserInputRequest,
  RequestUserInputResponse,
  RequestUserInputSettlementResult,
  RequestUserInputSettlementOptions,
  TurnPlan,
  WorkspaceInfo,
} from "../../../types";
import type { ConversationState } from "../../threads/contracts/conversationCurtainContracts";
import type { PresentationProfile } from "../presentation/presentationProfile";
import type { RuntimeReconnectRecoveryCallbackResult } from "./runtimeReconnect";
import type { AgentTaskScrollRequest } from "../types";
import type { TaskRunRecord } from "../../tasks/types";

export type LastVisibleTextReport = {
  itemId: string | null;
  visibleTextLength: number;
  reportedAt: number;
};

export type LastRenderSnapshot = {
  items: ConversationItem[];
  userInputRequests: RequestUserInputRequest[];
  conversationState: ConversationState | null;
  presentationProfile: PresentationProfile | null;
  isThinking: boolean;
  heartbeatPulse: number;
  threadId: string | null;
};

export type MessagesProps = {
  items: ConversationItem[];
  threadId: string | null;
  workspaceId?: string | null;
  isThinking: boolean;
  isHistoryLoading?: boolean;
  isContextCompacting?: boolean;
  proxyEnabled?: boolean;
  proxyUrl?: string | null;
  processingStartedAt?: number | null;
  lastDurationMs?: number | null;
  heartbeatPulse?: number;
  codexSilentSuspectedAt?: number | null;
  workspacePath?: string | null;
  openTargets: OpenAppTarget[];
  selectedOpenAppId: string;
  showMessageAnchors?: boolean;
  showStickyUserBubble?: boolean;
  codeBlockCopyUseModifier?: boolean;
  userInputRequests?: RequestUserInputRequest[];
  approvals?: ApprovalRequest[];
  workspaces?: WorkspaceInfo[];
  onUserInputSubmit?: (
    request: RequestUserInputRequest,
    response: RequestUserInputResponse,
    options?: RequestUserInputSettlementOptions,
  ) => Promise<RequestUserInputSettlementResult | void> | RequestUserInputSettlementResult | void;
  onUserInputDismiss?: (
    request: RequestUserInputRequest,
    options?: RequestUserInputSettlementOptions,
  ) => Promise<RequestUserInputSettlementResult | void> | RequestUserInputSettlementResult | void;
  onApprovalDecision?: (
    request: ApprovalRequest,
    decision: "accept" | "decline" | "dismiss",
  ) => void;
  onApprovalBatchAccept?: (requests: ApprovalRequest[]) => void;
  onApprovalRemember?: (request: ApprovalRequest, command: string[]) => void;
  activeEngine?: "claude" | "codex" | "gemini" | "opencode";
  claudeThinkingVisible?: boolean;
  activeCollaborationModeId?: string | null;
  plan?: TurnPlan | null;
  isPlanMode?: boolean;
  isPlanProcessing?: boolean;
  onOpenDiffPath?: (path: string) => void;
  onOpenPlanPanel?: () => void;
  onExitPlanModeExecute?: (
    mode: Extract<AccessMode, "default" | "full-access">,
  ) => Promise<void> | void;
  conversationState?: ConversationState | null;
  presentationProfile?: PresentationProfile | null;
  onOpenWorkspaceFile?: (path: string) => void;
  agentTaskScrollRequest?: AgentTaskScrollRequest | null;
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
  onForkFromMessage?: (messageId: string) => void;
  onRewindFromMessage?: (messageId: string) => void;
  taskRuns?: TaskRunRecord[];
};
