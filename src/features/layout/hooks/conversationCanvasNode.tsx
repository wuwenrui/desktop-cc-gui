import type { ComponentProps, ReactNode } from "react";

import { MessageForkConfirmDialog } from "../../messages/components/MessageForkConfirmDialog";
import { Messages } from "../../messages/components/Messages";
import type { MessagesProps } from "../../messages/components/messagesTypes";
import {
  shallowEqual,
  useActiveCanvasSelector,
  type ActiveCanvasSnapshot,
} from "./activeCanvasStore";

export type ConversationCanvasNodeInput = {
  messagesProps: ComponentProps<typeof Messages>;
  forkConfirmDialogProps: ComponentProps<typeof MessageForkConfirmDialog>;
};

const selectActiveCanvasMessagesProps = (
  snapshot: ActiveCanvasSnapshot,
): Pick<
  MessagesProps,
  | "items"
  | "threadId"
  | "workspaceId"
  | "workspacePath"
  | "userInputRequests"
  | "approvals"
  | "conversationState"
  | "plan"
  | "isThinking"
  | "isHistoryLoading"
  | "isContextCompacting"
  | "processingStartedAt"
  | "lastDurationMs"
  | "heartbeatPulse"
  | "codexSilentSuspectedAt"
  | "taskRuns"
> => ({
  items: snapshot.items,
  threadId: snapshot.threadId,
  workspaceId: snapshot.workspaceId,
  workspacePath: snapshot.workspacePath,
  userInputRequests: snapshot.userInputRequests,
  approvals: snapshot.approvals,
  conversationState: snapshot.conversationState,
  plan: snapshot.plan,
  isThinking: snapshot.isThinking,
  isHistoryLoading: snapshot.isHistoryLoading,
  isContextCompacting: snapshot.isContextCompacting,
  processingStartedAt: snapshot.processingStartedAt,
  lastDurationMs: snapshot.lastDurationMs,
  heartbeatPulse: snapshot.heartbeatPulse,
  codexSilentSuspectedAt: snapshot.codexSilentSuspectedAt,
  taskRuns: snapshot.taskRuns,
});

function ActiveCanvasMessages({
  messagesProps,
}: {
  messagesProps: ComponentProps<typeof Messages>;
}) {
  const activeCanvasMessagesProps = useActiveCanvasSelector(
    selectActiveCanvasMessagesProps,
    shallowEqual,
  );

  return <Messages {...messagesProps} {...activeCanvasMessagesProps} />;
}

export function buildConversationCanvasNode({
  messagesProps,
  forkConfirmDialogProps,
}: ConversationCanvasNodeInput): ReactNode {
  return (
    <>
      <ActiveCanvasMessages messagesProps={messagesProps} />
      <MessageForkConfirmDialog {...forkConfirmDialogProps} />
    </>
  );
}
