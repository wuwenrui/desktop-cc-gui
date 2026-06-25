// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { Dispatch } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationItem, WorkspaceInfo } from "../../../types";
import type { CodexAcceptedTurnResolution } from "../utils/codexConversationLiveness";
import type { StaleThreadRecoveryClassification } from "../utils/stabilityDiagnostics";
import type { ThreadAction } from "./threadReducerTypes";
import {
  type CodexMessageRecoveryAttemptDeps,
  useCodexMessageRecovery,
} from "./useCodexMessageRecovery";

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/ws-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const emptyDraftResolution: CodexAcceptedTurnResolution = {
  fact: "empty-draft",
  source: "thread-start",
  hasDurableActivity: false,
};

const acceptedResolution: CodexAcceptedTurnResolution = {
  fact: "accepted",
  source: "durable-items",
  hasDurableActivity: true,
};

const unknownResolution: CodexAcceptedTurnResolution = {
  fact: "unknown",
  source: "no-authoritative-fact",
  hasDurableActivity: false,
};

const staleThreadClassification: StaleThreadRecoveryClassification = {
  reasonCode: "stale-thread-binding",
  staleReason: "thread-not-found",
  retryable: true,
  userAction: "recover-thread",
  recommendedOutcome: "rebound",
  rawMessage: "thread not found: legacy-thread-id",
};

const optimisticUserItem: Extract<ConversationItem, { kind: "message" }> & {
  role: "user";
} = {
  id: "optimistic-user-1",
  kind: "message",
  role: "user",
  text: "hello codex",
};

function makeDeps(
  overrides: Partial<CodexMessageRecoveryAttemptDeps> = {},
): CodexMessageRecoveryAttemptDeps {
  return {
    threadId: "legacy-thread-id",
    workspace,
    reboundThreadId: null,
    acceptedTurnResolution: emptyDraftResolution,
    staleRecoveryClassification: staleThreadClassification,
    optimisticUserItem,
    moveOptimisticUserIntentToThread: vi.fn(),
    retrySendOnThread: vi.fn().mockResolvedValue(undefined),
    startThreadForMessageSend: vi.fn().mockResolvedValue("fresh-thread-id"),
    forkThreadForWorkspace: vi.fn().mockResolvedValue("fork-thread-id"),
    dispatch: vi.fn() as Dispatch<ThreadAction>,
    onDebug: vi.fn(),
    errorMessage: "thread not found: legacy-thread-id",
    refreshErrorMessage: null,
    ...overrides,
  };
}

describe("useCodexMessageRecovery", () => {
  it("freshly continues an empty draft with optimistic user intent", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useCodexMessageRecovery());
    const attempt = result.current.createRecoveryAttempt(deps);

    let recovered = false;
    await act(async () => {
      recovered = await attempt.tryFreshDraftReplacement("refresh failed: missing");
    });

    expect(recovered).toBe(true);
    expect(deps.startThreadForMessageSend).toHaveBeenCalledWith(workspace, "codex");
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: "fresh-thread-id",
    });
    expect(deps.moveOptimisticUserIntentToThread).toHaveBeenCalledWith("fresh-thread-id");
    expect(deps.retrySendOnThread).toHaveBeenCalledWith("fresh-thread-id");
    expect(deps.onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "turn/start draft fresh fallback",
        payload: expect.objectContaining({
          outcome: "fresh",
          acceptedTurnFact: "empty-draft",
          reasonCode: "stale-thread-binding",
          staleReason: "thread-not-found",
        }),
      }),
    );
  });

  it("runs fresh draft replacement at most once per attempt", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useCodexMessageRecovery());
    const attempt = result.current.createRecoveryAttempt(deps);

    let first = false;
    let second = true;
    await act(async () => {
      first = await attempt.tryFreshDraftReplacement(null);
      second = await attempt.tryFreshDraftReplacement(null);
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(deps.startThreadForMessageSend).toHaveBeenCalledTimes(1);
    expect(deps.retrySendOnThread).toHaveBeenCalledTimes(1);
  });

  it("freshly continues on the current Codex provider binding", async () => {
    const deps = makeDeps({
      providerProfileId: "provider-openai",
    });
    const { result } = renderHook(() => useCodexMessageRecovery());
    const attempt = result.current.createRecoveryAttempt(deps);

    let recovered = false;
    await act(async () => {
      recovered = await attempt.tryFreshDraftReplacement(null);
    });

    expect(recovered).toBe(true);
    expect(deps.startThreadForMessageSend).toHaveBeenCalledWith(
      workspace,
      "codex",
      { providerProfileId: "provider-openai" },
    );
    expect(deps.onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          providerProfileId: "provider-openai",
        }),
      }),
    );
  });

  it("omits blank Codex provider binding during fresh continuation", async () => {
    const deps = makeDeps({
      providerProfileId: "   ",
    });
    const { result } = renderHook(() => useCodexMessageRecovery());
    const attempt = result.current.createRecoveryAttempt(deps);

    let recovered = false;
    await act(async () => {
      recovered = await attempt.tryFreshDraftReplacement(null);
    });

    expect(recovered).toBe(true);
    expect(deps.startThreadForMessageSend).toHaveBeenCalledWith(workspace, "codex");
  });

  it("does not fresh-replace when local optimistic intent is absent", async () => {
    const deps = makeDeps({
      acceptedTurnResolution: unknownResolution,
      optimisticUserItem: null,
    });
    const { result } = renderHook(() => useCodexMessageRecovery());
    const attempt = result.current.createRecoveryAttempt(deps);

    let recovered = true;
    await act(async () => {
      recovered = await attempt.tryFreshDraftReplacement(null);
    });

    expect(recovered).toBe(false);
    expect(attempt.canUseFreshDraftReplacement).toBe(false);
    expect(deps.startThreadForMessageSend).not.toHaveBeenCalled();
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("forks a stale durable thread and retries on the fork", async () => {
    const deps = makeDeps({
      acceptedTurnResolution: acceptedResolution,
      optimisticUserItem: null,
      startThreadForMessageSend: vi.fn().mockResolvedValue("fresh-should-not-start"),
    });
    const { result } = renderHook(() => useCodexMessageRecovery());
    const attempt = result.current.createRecoveryAttempt(deps);

    let recovered = false;
    await act(async () => {
      recovered = await attempt.tryForkFromMessage("refresh failed");
    });

    expect(recovered).toBe(true);
    expect(deps.forkThreadForWorkspace).toHaveBeenCalledWith(
      "ws-1",
      "legacy-thread-id",
      { activate: true },
    );
    expect(deps.startThreadForMessageSend).not.toHaveBeenCalled();
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: "fork-thread-id",
    });
    expect(deps.retrySendOnThread).toHaveBeenCalledWith("fork-thread-id");
  });

  it("forks a stale durable thread on the current Codex provider binding", async () => {
    const deps = makeDeps({
      acceptedTurnResolution: acceptedResolution,
      optimisticUserItem: null,
      providerProfileId: "provider-openai",
    });
    const { result } = renderHook(() => useCodexMessageRecovery());
    const attempt = result.current.createRecoveryAttempt(deps);

    let recovered = false;
    await act(async () => {
      recovered = await attempt.tryForkFromMessage("refresh failed");
    });

    expect(recovered).toBe(true);
    expect(deps.forkThreadForWorkspace).toHaveBeenCalledWith(
      "ws-1",
      "legacy-thread-id",
      { activate: true, providerProfileId: "provider-openai" },
    );
  });

  it("leaves verified rebound retry to useThreadMessaging", async () => {
    const deps = makeDeps({
      reboundThreadId: "rebound-thread-id",
    });
    const { result } = renderHook(() => useCodexMessageRecovery());
    const attempt = result.current.createRecoveryAttempt(deps);

    let recovered = true;
    await act(async () => {
      recovered = await attempt.tryForkFromMessage(null);
    });

    expect(recovered).toBe(false);
    expect(attempt.isUnverifiedSameThreadMissingRebind).toBe(false);
    expect(deps.forkThreadForWorkspace).not.toHaveBeenCalled();
    expect(deps.retrySendOnThread).not.toHaveBeenCalled();
  });
});
