import { invoke } from "@tauri-apps/api/core";

export async function respondToServerRequest(workspaceId: string, requestId: number | string, decision: "accept" | "decline") {
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result: { decision },
  });
}

export async function respondToUserInputRequest(
  workspaceId: string,
  requestId: number | string,
  answers: Record<string, { answers: string[] }>,
  options?: {
    threadId?: string | null;
    turnId?: string | null;
    skippedQuestionIds?: string[];
  },
) {
  const result: Record<string, unknown> = { answers };
  if (options?.skippedQuestionIds?.length) {
    result.skippedQuestionIds = options.skippedQuestionIds;
  }
  return invoke("respond_to_server_request", {
    workspaceId,
    requestId,
    result,
    threadId: options?.threadId ?? null,
    turnId: options?.turnId ?? null,
  });
}

export async function rememberApprovalRule(workspaceId: string, command: string[]) {
  return invoke("remember_approval_rule", { workspaceId, command });
}
