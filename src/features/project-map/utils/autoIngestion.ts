import type { ProjectMemoryItem } from "../../../services/tauri/projectMemory";
import type {
  ProjectMapAutoIngestionMemoryEvidence,
  ProjectMapAutoIngestionSettings,
  ProjectMapCandidate,
  ProjectMapDataset,
  ProjectMapMemoryIngestionCursor,
  ProjectMapProcessedMemoryMessage,
  ProjectMapRunMetadata,
} from "../types";
import { extractProjectMapWorkspaceEvidencePaths } from "./evidencePaths";

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function createProjectMapMemoryMessageDescriptor(
  memory: ProjectMemoryItem,
): ProjectMapProcessedMemoryMessage {
  return {
    sessionId: memory.threadId ?? memory.id,
    messageHash: messageHash(memory),
  };
}

function messageHash(memory: ProjectMemoryItem): string {
  return hashText(
    [
      memory.id,
      memory.threadId ?? "",
      memory.turnId ?? "",
      memory.messageId ?? "",
      memory.assistantMessageId ?? "",
      memory.userInput ?? "",
      memory.assistantResponse ?? "",
      memory.updatedAt,
    ].join("|"),
  );
}

function messageKey(message: ProjectMapProcessedMemoryMessage): string {
  return `${message.sessionId}:${message.messageHash}`;
}

export function discoverUnprocessedProjectMemoryMessages(input: {
  memories: ProjectMemoryItem[];
  processedMessages: ProjectMapProcessedMemoryMessage[];
}): ProjectMapProcessedMemoryMessage[] {
  const processed = new Set(input.processedMessages.map(messageKey));

  return input.memories
    .map(createProjectMapMemoryMessageDescriptor)
    .filter((message) => !processed.has(messageKey(message)));
}

export function shouldEvaluateProjectMapAutoIngestion(input: {
  settings: ProjectMapAutoIngestionSettings;
  cursor: ProjectMapMemoryIngestionCursor;
  runs: ProjectMapRunMetadata[];
  now: string;
}): boolean {
  if (!input.settings.enabled || hasActiveProjectMapAutoIngestionRun(input.runs)) {
    return false;
  }

  const lastCheckedAt = new Date(input.cursor.lastCheckedAt).getTime();
  if (!Number.isFinite(lastCheckedAt)) {
    return true;
  }

  const nowMs = new Date(input.now).getTime();
  if (!Number.isFinite(nowMs)) {
    return true;
  }

  const intervalMs = clampInteger(input.settings.checkIntervalMinutes, 5, 1440) * 60_000;
  return nowMs - lastCheckedAt >= intervalMs;
}

export function hasActiveProjectMapAutoIngestionRun(runs: ProjectMapRunMetadata[]): boolean {
  return runs.some((run) => {
    const scope = run.requestScope;
    return (
      (run.kind === "auto" || scope?.kind === "auto") &&
      (run.status === "pending" || run.status === "running")
    );
  });
}

export function shouldTriggerProjectMapAutoIngestion(input: {
  settings: ProjectMapAutoIngestionSettings;
  unprocessedMessages: ProjectMapProcessedMemoryMessage[];
}): boolean {
  return (
    input.settings.enabled &&
    input.unprocessedMessages.length >= clampInteger(input.settings.newSessionThreshold, 1, 50)
  );
}

export function markProjectMapMessagesProcessed(input: {
  processedMessages: ProjectMapProcessedMemoryMessage[];
  consumedMessages: ProjectMapProcessedMemoryMessage[];
  runId: string;
  processedAt: string;
  runSucceeded: boolean;
}): ProjectMapProcessedMemoryMessage[] {
  if (!input.runSucceeded) {
    return input.processedMessages;
  }

  const next = new Map(input.processedMessages.map((message) => [messageKey(message), message]));
  for (const message of input.consumedMessages) {
    next.set(messageKey(message), {
      ...message,
      runId: input.runId,
      processedAt: input.processedAt,
    });
  }
  return [...next.values()];
}

export function selectProjectMapAutoIngestionMemories(input: {
  memories: ProjectMemoryItem[];
  unprocessedMessages: ProjectMapProcessedMemoryMessage[];
}): ProjectMemoryItem[] {
  const unprocessedKeys = new Set(input.unprocessedMessages.map(messageKey));
  return input.memories.filter((memory) =>
    unprocessedKeys.has(messageKey(createProjectMapMemoryMessageDescriptor(memory))),
  );
}

export function createProjectMapAutoIngestionMemoryEvidence(
  memory: ProjectMemoryItem,
): ProjectMapAutoIngestionMemoryEvidence {
  const descriptor = createProjectMapMemoryMessageDescriptor(memory);
  return {
    memoryId: memory.id,
    sessionId: descriptor.sessionId,
    messageHash: descriptor.messageHash,
    title: memory.title,
    summary: memory.summary,
    detail: memory.detail ?? null,
    cleanText: memory.cleanText,
    rawText: memory.rawText ?? null,
    userInput: memory.userInput ?? null,
    assistantResponse: memory.assistantResponse ?? null,
    workspacePath: memory.workspacePath ?? null,
    source: memory.source,
    updatedAt: memory.updatedAt,
  };
}

export function extractProjectMapMemoryEvidencePaths(
  memories: ProjectMemoryItem[],
): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const memory of memories) {
    const evidenceText = [
      memory.workspacePath,
      memory.rawText,
      memory.cleanText,
      memory.detail,
      memory.userInput,
      memory.assistantResponse,
    ]
      .filter(Boolean)
      .join("\n");
    for (const path of extractProjectMapWorkspaceEvidencePaths(evidenceText)) {
      if (seen.has(path)) {
        continue;
      }
      seen.add(path);
      paths.push(path);
    }
  }
  return paths;
}

export function createConversationKnowledgeCandidate(input: {
  dataset: ProjectMapDataset;
  memory: ProjectMemoryItem;
  createdAt: string;
}): ProjectMapCandidate | null {
  const evidenceText = [
    input.memory.workspacePath,
    input.memory.rawText,
    input.memory.cleanText,
    input.memory.detail,
    input.memory.userInput,
    input.memory.assistantResponse,
  ]
    .filter(Boolean)
    .join("\n");

  const evidencePath = extractProjectMapWorkspaceEvidencePaths(evidenceText)[0];
  if (!evidencePath) {
    return null;
  }

  const targetNode =
    input.dataset.nodes.find((node) => node.lensId === "evidence") ??
    input.dataset.nodes[0];
  if (!targetNode) {
    return null;
  }

  return {
    id: `candidate_${input.memory.id}_${messageHash(input.memory)}`,
    status: "pending",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    source: "conversation",
    targetLensId: targetNode.lensId,
    targetNodeId: targetNode.id,
    patch: {
      nodeId: targetNode.id,
      candidate: true,
      confidence: "low",
      sources: [
        {
          type: "conversation",
          label: input.memory.title || input.memory.id,
          path: evidencePath,
          hash: messageHash(input.memory),
          excerpt: input.memory.summary,
        },
      ],
    },
    evidence: [
      {
        id: `evidence_${input.memory.id}_${messageHash(input.memory)}`,
        source: {
          type: "conversation",
          label: input.memory.title || input.memory.id,
          path: evidencePath,
          hash: messageHash(input.memory),
          excerpt: input.memory.summary,
        },
        priority: "memory",
        observedHash: messageHash(input.memory),
        observedAt: input.createdAt,
      },
    ],
  };
}
