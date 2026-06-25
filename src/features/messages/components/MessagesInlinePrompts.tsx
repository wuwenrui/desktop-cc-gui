import { ApprovalToasts } from "../../app/components/ApprovalToasts";
import { RequestUserInputMessage } from "../../app/components/RequestUserInputMessage";
import type {
  ApprovalRequest,
  RequestUserInputRequest,
  RequestUserInputResponse,
  RequestUserInputSettlementResult,
  RequestUserInputSettlementOptions,
  WorkspaceInfo,
} from "../../../types";

type MessagesInlineApprovalProps = {
  approvals: ApprovalRequest[];
  workspaces: WorkspaceInfo[];
  onApprovalBatchAccept?: (requests: ApprovalRequest[]) => void;
  onApprovalDecision?: (
    request: ApprovalRequest,
    decision: "accept" | "decline" | "dismiss",
  ) => void;
  onApprovalRemember?: (request: ApprovalRequest, command: string[]) => void;
};

export function MessagesInlineApproval({
  approvals,
  workspaces,
  onApprovalBatchAccept,
  onApprovalDecision,
  onApprovalRemember,
}: MessagesInlineApprovalProps) {
  if (approvals.length === 0 || !onApprovalDecision) {
    return null;
  }
  return (
    <div className="messages-inline-approval-slot">
      <ApprovalToasts
        approvals={approvals}
        workspaces={workspaces}
        onDecision={onApprovalDecision}
        onApproveBatch={onApprovalBatchAccept}
        onRemember={onApprovalRemember}
        variant="inline"
      />
    </div>
  );
}

type MessagesInlineUserInputProps = {
  activeThreadId: string | null;
  activeWorkspaceId: string | null;
  onDismiss?: (
    request: RequestUserInputRequest,
    options?: RequestUserInputSettlementOptions,
  ) => Promise<RequestUserInputSettlementResult | void> | RequestUserInputSettlementResult | void;
  onSubmit?: (
    request: RequestUserInputRequest,
    response: RequestUserInputResponse,
    options?: RequestUserInputSettlementOptions,
  ) => Promise<RequestUserInputSettlementResult | void> | RequestUserInputSettlementResult | void;
  requests: RequestUserInputRequest[];
  shouldRender: boolean;
};

export function MessagesInlineUserInput({
  activeThreadId,
  activeWorkspaceId,
  onDismiss,
  onSubmit,
  requests,
  shouldRender,
}: MessagesInlineUserInputProps) {
  if (!shouldRender || !onSubmit) {
    return null;
  }
  return (
    <div className="messages-inline-user-input-slot">
      <RequestUserInputMessage
        requests={requests}
        activeThreadId={activeThreadId}
        activeWorkspaceId={activeWorkspaceId}
        onSubmit={onSubmit}
        onDismiss={onDismiss}
      />
    </div>
  );
}
