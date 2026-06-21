// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  RequestUserInputRequest,
  RequestUserInputResponse,
} from "../types";
import { usePlanApplyHandlers } from "./usePlanApplyHandlers";

const request: RequestUserInputRequest = {
  workspace_id: "ws-1",
  request_id: "req-1",
  params: {
    thread_id: "thread-1",
    turn_id: "turn-1",
    item_id: "item-1",
    questions: [
      {
        id: "q-1",
        header: "Question",
        question: "Continue?",
      },
    ],
  },
};

const response: RequestUserInputResponse = {
  answers: {
    "q-1": {
      answers: ["Yes"],
    },
  },
};

describe("usePlanApplyHandlers", () => {
  it("passes user input settlement options through the plan apply wrapper", async () => {
    const handleUserInputSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePlanApplyHandlers({
        activeEngine: "claude",
        applySelectedCollaborationMode: vi.fn(),
        handleSetAccessMode: vi.fn(),
        handleUserInputSubmit,
        interruptTurn: vi.fn(),
        resolveCollaborationRuntimeMode: vi.fn(() => null),
        resolveCollaborationUiMode: vi.fn(() => null),
        resolvedEffort: null,
        resolvedModel: null,
        selectedCollaborationModeId: null,
        sendUserMessage: vi.fn(),
      }),
    );

    await result.current.handleUserInputSubmitWithPlanApply(
      request,
      response,
      { staleSettlementHint: "timeout" },
    );

    expect(handleUserInputSubmit).toHaveBeenCalledWith(
      request,
      response,
      { staleSettlementHint: "timeout" },
    );
  });

  it("stops plan-apply side effects when user input settlement is stale", async () => {
    const handleUserInputSubmit = vi
      .fn()
      .mockResolvedValue({ settlement: "stale" });
    const applySelectedCollaborationMode = vi.fn();
    const interruptTurn = vi.fn();
    const sendUserMessage = vi.fn();
    const { result } = renderHook(() =>
      usePlanApplyHandlers({
        activeEngine: "codex",
        applySelectedCollaborationMode,
        handleSetAccessMode: vi.fn(),
        handleUserInputSubmit,
        interruptTurn,
        resolveCollaborationRuntimeMode: vi.fn((): "plan" => "plan"),
        resolveCollaborationUiMode: vi.fn((): "code" => "code"),
        resolvedEffort: null,
        resolvedModel: null,
        selectedCollaborationModeId: "code",
        sendUserMessage,
      }),
    );

    await result.current.handleUserInputSubmitWithPlanApply(
      request,
      response,
      { staleSettlementHint: "timeout" },
    );

    expect(handleUserInputSubmit).toHaveBeenCalledWith(
      request,
      response,
      { staleSettlementHint: "timeout" },
    );
    expect(applySelectedCollaborationMode).not.toHaveBeenCalled();
    expect(interruptTurn).not.toHaveBeenCalled();
    expect(sendUserMessage).not.toHaveBeenCalled();
  });
});
