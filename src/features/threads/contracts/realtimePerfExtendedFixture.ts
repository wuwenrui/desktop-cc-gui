import type { RealtimeReplayEvent } from "./realtimeReplayTypes";

const WORKSPACE_ID = "ws-realtime-perf-extended";

export function buildStreamJsonFirstTokenSlowPathEvents(): RealtimeReplayEvent[] {
  const threadId = "claude:stream-json-first-token";
  const assistantId = `${threadId}:assistant:slow-first-token`;
  const reasoningId = `${threadId}:reasoning:slow-first-token`;
  return [
    {
      id: "ft:reasoning-summary",
      kind: "reasoningSummaryDelta",
      workspaceId: WORKSPACE_ID,
      threadId,
      itemId: reasoningId,
      delta: "Waiting for stream-json first token",
      atMs: 0,
    },
    {
      id: "ft:agent-delta-1",
      kind: "agentDelta",
      workspaceId: WORKSPACE_ID,
      threadId,
      itemId: assistantId,
      delta: "First visible token ",
      atMs: 5_000,
    },
    {
      id: "ft:agent-delta-2",
      kind: "agentDelta",
      workspaceId: WORKSPACE_ID,
      threadId,
      itemId: assistantId,
      delta: "after slow path.",
      atMs: 5_080,
    },
    {
      id: "ft:agent-complete",
      kind: "agentCompleted",
      workspaceId: WORKSPACE_ID,
      threadId,
      itemId: assistantId,
      text: "First visible token after slow path.",
      atMs: 5_120,
    },
  ];
}

export function buildPromptEnhancerDedupPathEvents(): RealtimeReplayEvent[] {
  const threadId = "claude:prompt-enhancer-dedup";
  const assistantId = `${threadId}:assistant:dedup`;
  return [
    {
      id: "pe:agent-delta-1",
      kind: "agentDelta",
      workspaceId: WORKSPACE_ID,
      threadId,
      itemId: assistantId,
      delta: "Enhanced prompt accepted.",
      atMs: 0,
    },
    {
      id: "pe:agent-delta-duplicate",
      kind: "agentDelta",
      workspaceId: WORKSPACE_ID,
      threadId,
      itemId: assistantId,
      delta: "",
      atMs: 4,
    },
    {
      id: "pe:agent-complete",
      kind: "agentCompleted",
      workspaceId: WORKSPACE_ID,
      threadId,
      itemId: assistantId,
      text: "Enhanced prompt accepted.",
      atMs: 12,
    },
  ];
}

export function buildLongLiveAssistantTextReasoningToolEvents(): RealtimeReplayEvent[] {
  // Long streaming scenario: assistant text growth, reasoning interleaved, tool call.
  // Mirrors the contract for S-RS-LL (proposed follow-up scenario).
  const threadId = "claude:long-live-stream";
  const assistantId = `${threadId}:assistant:long`;
  const reasoningId = `${threadId}:reasoning:long`;
  const toolId = `${threadId}:tool:long`;
  const events: RealtimeReplayEvent[] = [];
  let at = 0;
  // 8 long assistant deltas
  for (let i = 0; i < 8; i += 1) {
    events.push({
      id: `ll:agent-delta-${i + 1}`,
      kind: "agentDelta",
      workspaceId: "ws-long-live",
      threadId,
      itemId: assistantId,
      delta: `[chunk-${i + 1}] Long text body chunk with progressive content. `,
      atMs: at,
    });
    at += 24;
  }
  // 2 reasoning summary + 2 reasoning content deltas (interleaved)
  events.push({
    id: "ll:reasoning-summary-1",
    kind: "reasoningSummaryDelta",
    workspaceId: "ws-long-live",
    threadId,
    itemId: reasoningId,
    delta: "Plan: stream 8 text chunks, reason twice, run a tool, finalize.",
    atMs: at,
  });
  at += 12;
  events.push({
    id: "ll:reasoning-content-1",
    kind: "reasoningContentDelta",
    workspaceId: "ws-long-live",
    threadId,
    itemId: reasoningId,
    delta: "Inspecting runtime path: streaming + reasoning + tool. ",
    atMs: at,
  });
  at += 12;
  events.push({
    id: "ll:reasoning-summary-2",
    kind: "reasoningSummaryDelta",
    workspaceId: "ws-long-live",
    threadId,
    itemId: reasoningId,
    delta: "Tool call: run vitest.",
    atMs: at,
  });
  at += 8;
  events.push({
    id: "ll:reasoning-content-2",
    kind: "reasoningContentDelta",
    workspaceId: "ws-long-live",
    threadId,
    itemId: reasoningId,
    delta: "Calling tool now. ",
    atMs: at,
  });
  at += 8;
  // Tool start + 3 tool output deltas
  events.push({
    id: "ll:tool-start",
    kind: "toolStarted",
    workspaceId: "ws-long-live",
    threadId,
    itemId: toolId,
    command: "pnpm vitest --run",
    atMs: at,
  });
  at += 8;
  for (let i = 0; i < 3; i += 1) {
    events.push({
      id: `ll:tool-output-${i + 1}`,
      kind: "toolOutputDelta",
      workspaceId: "ws-long-live",
      threadId,
      itemId: toolId,
      delta: `tool-output-line-${i + 1}\n`,
      atMs: at,
    });
    at += 12;
  }
  // Final assistant delta + completion
  events.push({
    id: "ll:agent-delta-final",
    kind: "agentDelta",
    workspaceId: "ws-long-live",
    threadId,
    itemId: assistantId,
    delta: "After tool run, final summary chunk.",
    atMs: at,
  });
  at += 12;
  events.push({
    id: "ll:agent-complete",
    kind: "agentCompleted",
    workspaceId: "ws-long-live",
    threadId,
    itemId: assistantId,
    text: "[long body finalized after tool run]",
    atMs: at,
  });
  return events;
}

export function buildRealtimePerfExtendedEvents() {
  return [
    ...buildStreamJsonFirstTokenSlowPathEvents(),
    ...buildPromptEnhancerDedupPathEvents().map((event) => ({
      ...event,
      atMs: event.atMs + 6_000,
    })),
  ];
}

export function buildRealtimeTurnTraceEvents() {
  return [
    ...buildRealtimePerfExtendedEvents(),
    ...buildLongLiveAssistantTextReasoningToolEvents().map((event) => ({
      ...event,
      atMs: event.atMs + 12_000,
    })),
  ];
}
