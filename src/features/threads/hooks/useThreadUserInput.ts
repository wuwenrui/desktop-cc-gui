import { useCallback } from "react";
import type { Dispatch } from "react";
import i18n from "../../../i18n";
import type {
  RequestUserInputRequest,
  RequestUserInputResponse,
  RequestUserInputSettlementOptions,
  RequestUserInputSettlementResult,
} from "../../../types";
import { respondToUserInputRequest } from "../../../services/tauri";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadUserInputOptions = {
  dispatch: Dispatch<ThreadAction>;
  resolveClaudeContinuationThreadId?: (
    workspaceId: string,
    threadId: string,
    turnId?: string | null,
  ) => string | null;
};

type SubmittedQuestion = {
  id: string;
  header: string;
  question: string;
  options?: Array<{ label: string; description: string }>;
  selectedOptions: string[];
  note: string;
};

type SubmittedUserInputPayload = {
  schema: "requestUserInputSubmitted/v1";
  submittedAt: number;
  questions: SubmittedQuestion[];
};

function normalizeSubmittedAnswer(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed;
}

function parseSubmittedAnswer(rawAnswers: string[]) {
  const selectedOptions: string[] = [];
  let note = "";

  for (const rawAnswer of rawAnswers) {
    const normalized = normalizeSubmittedAnswer(rawAnswer);
    if (!normalized) {
      continue;
    }
    if (normalized.toLowerCase().startsWith("user_note:")) {
      const parsedNote = normalized.slice("user_note:".length).trim();
      if (parsedNote) {
        note = parsedNote;
      }
      continue;
    }
    selectedOptions.push(normalized);
  }

  return { selectedOptions, note };
}

function buildSubmittedPayload(
  request: RequestUserInputRequest,
  response: RequestUserInputResponse,
): SubmittedUserInputPayload {
  const questions: SubmittedQuestion[] = request.params.questions
    .filter((question) => question.id.trim().length > 0)
    .map((question) => {
      const answerValue = response.answers[question.id]?.answers ?? [];
      const { selectedOptions, note } = parseSubmittedAnswer(answerValue);
      return {
        id: question.id,
        header: question.header,
        question: question.question,
        options: question.options,
        selectedOptions,
        note,
      };
    });

  return {
    schema: "requestUserInputSubmitted/v1",
    submittedAt: Date.now(),
    questions,
  };
}

function buildSubmittedFallbackOutput(payload: SubmittedUserInputPayload) {
  const isChineseLocale = (i18n.resolvedLanguage ?? i18n.language).startsWith("zh");
  const listSeparator = isChineseLocale ? "；" : "; ";
  const labelSeparator = isChineseLocale ? "：" : ": ";
  const lines: string[] = [i18n.t("approval.userInputSubmittedBanner")];
  for (const question of payload.questions) {
    const questionText =
      question.question.trim() || question.header.trim() || question.id;
    const selected = question.selectedOptions.join(listSeparator);
    const note = question.note
      ? `${i18n.t("approval.noteLabel")}${labelSeparator}${question.note}`
      : "";
    const value = [selected, note].filter(Boolean).join(listSeparator);
    lines.push(questionText);
    lines.push(value || i18n.t("approval.noAnswerProvided"));
  }
  if (lines.length === 1) {
    lines.push(i18n.t("approval.noDisplayableAnswer"));
  }
  return lines.join("\n");
}

function buildSubmittedTitle(payload: SubmittedUserInputPayload) {
  for (const question of payload.questions) {
    const firstSelected = question.selectedOptions.find(
      (value) => value.trim().length > 0,
    );
    if (firstSelected) {
      return firstSelected;
    }
    const note = question.note.trim();
    if (note) {
      return note;
    }
  }
  return i18n.t("approval.inputRequested");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "";
}

function isEmptyResponse(response: RequestUserInputResponse) {
  return Object.values(response.answers ?? {}).every((answer) => {
    const answers = Array.isArray(answer?.answers) ? answer.answers : [];
    return answers.every((value) => String(value ?? "").trim().length === 0);
  });
}

function isStaleSettledRequestError(
  error: unknown,
  response: RequestUserInputResponse,
  settlementKind: "submit" | "dismiss",
  staleSettlementHint?: RequestUserInputSettlementOptions["staleSettlementHint"],
) {
  const normalizedMessage = getErrorMessage(error).toLowerCase();
  if (normalizedMessage.includes("unknown request_id for askuserquestion")) {
    return true;
  }
  const hasStaleRuntimeEvidence =
    normalizedMessage.includes("workspace not connected") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("stale") ||
    normalizedMessage.includes("cancelled") ||
    normalizedMessage.includes("canceled");
  if (staleSettlementHint === "timeout" && hasStaleRuntimeEvidence) {
    return true;
  }
  return (
    settlementKind === "dismiss" &&
    isEmptyResponse(response) &&
    normalizedMessage.includes("workspace not connected")
  );
}

export function useThreadUserInput({
  dispatch,
  resolveClaudeContinuationThreadId,
}: UseThreadUserInputOptions) {
  const settleUserInputRequest = useCallback(
    async (
      request: RequestUserInputRequest,
      response: RequestUserInputResponse,
      options?: {
        recordSubmittedItem?: boolean;
        settlementKind?: "submit" | "dismiss";
        staleSettlementHint?: RequestUserInputSettlementOptions["staleSettlementHint"];
      },
    ): Promise<RequestUserInputSettlementResult> => {
      const recordSubmittedItem = options?.recordSubmittedItem ?? true;
      const settlementKind = options?.settlementKind ?? "submit";
      const staleSettlementHint = options?.staleSettlementHint;
      const rawThreadId = request.params.thread_id;
      const resolvedThreadId =
        (rawThreadId
          ? resolveClaudeContinuationThreadId?.(
              request.workspace_id,
              rawThreadId,
              request.params.turn_id,
            )
          : null) ?? rawThreadId;
      const isSharedThread = typeof rawThreadId === "string" && rawThreadId.startsWith("shared:");
      const stateThreadId = isSharedThread ? rawThreadId : resolvedThreadId;
      const runtimeThreadId = isSharedThread ? resolvedThreadId : rawThreadId;
      if (stateThreadId) {
        // After user confirms AskUserQuestion, Claude may take a few seconds to resume.
        // Mark thread as processing immediately to avoid a "stopped" visual gap.
        dispatch({
          type: "markProcessing",
          threadId: stateThreadId,
          isProcessing: true,
          timestamp: Date.now(),
        });
      }
      const responseOptions: {
        threadId: string | null | undefined;
        turnId: string | null | undefined;
        skippedQuestionIds?: string[];
      } = {
        threadId: runtimeThreadId,
        turnId: request.params.turn_id,
      };
      if (response.skippedQuestionIds?.length) {
        responseOptions.skippedQuestionIds = response.skippedQuestionIds;
      }
      try {
        await respondToUserInputRequest(
          request.workspace_id,
          request.request_id,
          response.answers,
          responseOptions,
        );
      } catch (error) {
        if (stateThreadId) {
          dispatch({
            type: "markProcessing",
            threadId: stateThreadId,
            isProcessing: false,
            timestamp: Date.now(),
          });
        }
        if (isStaleSettledRequestError(error, response, settlementKind, staleSettlementHint)) {
          dispatch({
            type: "removeUserInputRequest",
            requestId: request.request_id,
            workspaceId: request.workspace_id,
          });
          return { settlement: "stale" };
        }
        throw error;
      }
      if (stateThreadId) {
        const payload = buildSubmittedPayload(request, response);
        const fallbackOutput = buildSubmittedFallbackOutput(payload);
        dispatch({
          type: "upsertItem",
          workspaceId: request.workspace_id,
          threadId: stateThreadId,
          item: {
            id: request.params.item_id,
            kind: "tool",
            toolType: "askuserquestion",
            title: "Tool: askuserquestion",
            detail: "",
            status: "completed",
            output: fallbackOutput,
          },
          hasCustomName: true,
        });
      }
      if (stateThreadId && recordSubmittedItem) {
        const payload = buildSubmittedPayload(request, response);
        dispatch({
          type: "upsertItem",
          workspaceId: request.workspace_id,
          threadId: stateThreadId,
          item: {
            id: `user-input-answer-${String(request.request_id)}`,
            kind: "tool",
            toolType: "requestUserInputSubmitted",
            title: buildSubmittedTitle(payload),
            detail: JSON.stringify(payload),
            status: "completed",
            output: buildSubmittedFallbackOutput(payload),
          },
          // Keep thread auto-title unchanged; this is a synthetic confirmation record.
          hasCustomName: true,
        });
      }
      dispatch({
        type: "removeUserInputRequest",
        requestId: request.request_id,
        workspaceId: request.workspace_id,
      });
      return { settlement: "accepted" };
    },
    [dispatch, resolveClaudeContinuationThreadId],
  );

  const handleUserInputSubmit = useCallback(
    async (
      request: RequestUserInputRequest,
      response: RequestUserInputResponse,
      options?: RequestUserInputSettlementOptions,
    ) => {
      return await settleUserInputRequest(request, response, {
        recordSubmittedItem: true,
        settlementKind: "submit",
        staleSettlementHint: options?.staleSettlementHint,
      });
    },
    [settleUserInputRequest],
  );

  const handleUserInputDismiss = useCallback(
    async (
      request: RequestUserInputRequest,
      options?: RequestUserInputSettlementOptions,
    ) => {
      return await settleUserInputRequest(
        request,
        { answers: {} },
        {
          recordSubmittedItem: false,
          settlementKind: "dismiss",
          staleSettlementHint: options?.staleSettlementHint,
        },
      );
    },
    [settleUserInputRequest],
  );

  return { handleUserInputSubmit, handleUserInputDismiss };
}
