import { describe, expect, it } from "vitest";
import {
  classifyCodexEventRisk,
  resolveCodexEventOwnership,
} from "./codexEventOwnership";

describe("codexEventOwnership", () => {
  it("classifies lifecycle-sensitive Codex methods by mutation risk", () => {
    expect(classifyCodexEventRisk("runtime/ended")).toBe("terminal");
    expect(classifyCodexEventRisk("codex/parseError")).toBe("terminal");
    expect(classifyCodexEventRisk("turn/started")).toBe("processing-start");
    expect(classifyCodexEventRisk("codex/raw")).toBe("progress-only");
    expect(classifyCodexEventRisk("token_count")).toBe("progress-only");
    expect(classifyCodexEventRisk("codex/unknown")).toBe("diagnostic-only");
  });

  it("prefers explicit owner context over bounded fallback candidates", () => {
    expect(
      resolveCodexEventOwnership({
        workspaceId: "ws-1",
        risk: "terminal",
        explicitThreadId: "thread-explicit",
        explicitTurnId: "turn-explicit",
        boundedFallbackThreadIds: ["thread-fallback"],
      }),
    ).toEqual({
      kind: "explicit",
      workspaceId: "ws-1",
      threadId: "thread-explicit",
      turnId: "turn-explicit",
      runtimeGeneration: null,
      source: "payload",
      risk: "terminal",
    });
  });

  it("uses a single processing Codex candidate as bounded fallback", () => {
    expect(
      resolveCodexEventOwnership({
        workspaceId: "ws-1",
        risk: "terminal",
        boundedFallbackThreadIds: ["thread-only"],
      }),
    ).toEqual({
      kind: "boundedFallback",
      workspaceId: "ws-1",
      threadId: "thread-only",
      turnId: null,
      runtimeGeneration: null,
      source: "single-processing-codex-thread",
      risk: "terminal",
    });
  });

  it("treats two or more processing Codex candidates as ambiguous", () => {
    expect(
      resolveCodexEventOwnership({
        workspaceId: "ws-1",
        risk: "terminal",
        boundedFallbackThreadIds: ["thread-a", "thread-b", "thread-c"],
      }),
    ).toEqual({
      kind: "ambiguous",
      workspaceId: "ws-1",
      candidateThreadIds: ["thread-a", "thread-b", "thread-c"],
      reason: "multiple processing Codex owner candidates",
      risk: "terminal",
    });
  });

  it("returns unresolved when no owner proof exists", () => {
    expect(
      resolveCodexEventOwnership({
        workspaceId: "ws-1",
        risk: "terminal",
      }),
    ).toEqual({
      kind: "unresolved",
      workspaceId: "ws-1",
      reason: "no explicit or bounded fallback Codex owner",
      risk: "terminal",
    });
  });

  it("does not use bounded fallback for diagnostic-only events", () => {
    expect(
      resolveCodexEventOwnership({
        workspaceId: "ws-1",
        risk: "diagnostic-only",
        boundedFallbackThreadIds: ["thread-only"],
      }),
    ).toEqual({
      kind: "unresolved",
      workspaceId: "ws-1",
      reason: "diagnostic-only Codex event requires explicit owner",
      risk: "diagnostic-only",
    });
  });
});
