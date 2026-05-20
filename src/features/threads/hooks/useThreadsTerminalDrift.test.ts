import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  hasActiveTerminalDriftWork,
  hasFinalAssistantCompletionEvidence,
  isNativeCodexTerminalDriftThread,
} from "./useThreadsTerminalDrift";

function assistantFinal(
  overrides: Partial<Extract<ConversationItem, { kind: "message" }>> = {},
): Extract<ConversationItem, { kind: "message" }> {
  return {
    id: "assistant-1",
    kind: "message",
    role: "assistant",
    text: "done",
    isFinal: true,
    finalCompletedAt: 2_000,
    ...overrides,
  };
}

function userMessage(id = "user-1"): Extract<ConversationItem, { kind: "message" }> {
  return {
    id,
    kind: "message",
    role: "user",
    text: "next",
  };
}

describe("useThreadsTerminalDrift", () => {
  it("does not treat an older assistant final before the latest user message as terminal drift evidence", () => {
    expect(
      hasFinalAssistantCompletionEvidence([
        assistantFinal({ id: "assistant-old", finalCompletedAt: 1_000 }),
        userMessage("user-new"),
      ], {
        processingStartedAt: 2_000,
      }),
    ).toBe(false);
  });

  it("requires assistant final metadata to belong to the current processing window", () => {
    expect(
      hasFinalAssistantCompletionEvidence([
        assistantFinal({ finalCompletedAt: 1_000 }),
      ], {
        processingStartedAt: 2_000,
      }),
    ).toBe(false);

    expect(
      hasFinalAssistantCompletionEvidence([
        assistantFinal({ finalCompletedAt: 2_500 }),
      ], {
        processingStartedAt: 2_000,
      }),
    ).toBe(true);
  });

  it("treats unknown tool status as active work during terminal drift settlement", () => {
    expect(
      hasActiveTerminalDriftWork([
        {
          id: "tool-1",
          kind: "tool",
          toolType: "shell",
          title: "Shell",
          detail: "",
        },
      ]),
    ).toBe(true);
  });

  it("keeps shared and non-Codex threads outside native Codex terminal drift settlement", () => {
    expect(
      isNativeCodexTerminalDriftThread({
        threadId: "shared:thread-1",
        engine: "codex",
        kind: "shared",
      }),
    ).toBe(false);
    expect(
      isNativeCodexTerminalDriftThread({
        threadId: "claude:session-1",
        engine: "claude",
        kind: "native",
      }),
    ).toBe(false);
    expect(
      isNativeCodexTerminalDriftThread({
        threadId: "thread-1",
        engine: "codex",
        kind: "native",
      }),
    ).toBe(true);
  });
});
