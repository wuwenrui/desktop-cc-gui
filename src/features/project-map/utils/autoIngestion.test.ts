import { describe, expect, it } from "vitest";

import type { ProjectMemoryItem } from "../../../services/tauri/projectMemory";
import { mockProjectMapData } from "../mockProjectMapData";
import {
  createConversationKnowledgeCandidate,
  discoverUnprocessedProjectMemoryMessages,
  markProjectMapMessagesProcessed,
  shouldTriggerProjectMapAutoIngestion,
} from "./autoIngestion";

function memory(overrides: Partial<ProjectMemoryItem> = {}): ProjectMemoryItem {
  return {
    id: "memory-1",
    workspaceId: "ws-1",
    kind: "fact",
    title: "Project map fact",
    summary: "Project map code references src/features/project-map/types.ts",
    cleanText: "Project map code references src/features/project-map/types.ts",
    tags: [],
    importance: "medium",
    source: "conversation",
    fingerprint: "fp-1",
    createdAt: 1,
    updatedAt: 2,
    threadId: "session-1",
    ...overrides,
  };
}

describe("project map auto ingestion", () => {
  it("discovers only unprocessed session/message hash pairs", () => {
    const first = memory({ id: "memory-1", threadId: "session-1" });
    const second = memory({ id: "memory-2", threadId: "session-1", updatedAt: 3 });
    const [processedFirst] = discoverUnprocessedProjectMemoryMessages({
      memories: [first],
      processedMessages: [],
    });

    const unprocessed = discoverUnprocessedProjectMemoryMessages({
      memories: [first, second],
      processedMessages: [processedFirst],
    });

    expect(unprocessed).toHaveLength(1);
    expect(unprocessed[0].sessionId).toBe("session-1");
  });

  it("triggers only when opt-in candidate mode reaches threshold", () => {
    expect(
      shouldTriggerProjectMapAutoIngestion({
        settings: {
          enabled: true,
          engine: "codex",
          model: "default",
          newSessionThreshold: 2,
          checkIntervalMinutes: 30,
          applyMode: "createCandidate",
        },
        unprocessedMessages: [
          { sessionId: "s1", messageHash: "h1" },
          { sessionId: "s2", messageHash: "h2" },
        ],
      }),
    ).toBe(true);
  });

  it("does not mark messages processed on failed runs", () => {
    const processed = markProjectMapMessagesProcessed({
      processedMessages: [],
      consumedMessages: [{ sessionId: "s1", messageHash: "h1" }],
      runId: "run-1",
      processedAt: "2026-05-26T00:00:00Z",
      runSucceeded: false,
    });

    expect(processed).toEqual([]);
  });

  it("creates conversation candidates only when evidence is identifiable", () => {
    const candidate = createConversationKnowledgeCandidate({
      dataset: mockProjectMapData,
      memory: memory(),
      createdAt: "2026-05-26T00:00:00Z",
    });
    const missingEvidenceCandidate = createConversationKnowledgeCandidate({
      dataset: mockProjectMapData,
      memory: memory({ cleanText: "general project knowledge", summary: "general project knowledge" }),
      createdAt: "2026-05-26T00:00:00Z",
    });

    expect(candidate?.status).toBe("pending");
    expect(candidate?.source).toBe("conversation");
    expect(missingEvidenceCandidate).toBeNull();
  });
});
