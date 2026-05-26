import type { ProjectMemoryItem } from "../../../services/tauri/projectMemory";
import type {
  ProjectMapAutoIngestionSettings,
  ProjectMapCandidate,
  ProjectMapDataset,
  ProjectMapProcessedMemoryMessage,
} from "../types";

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
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
    .map((memory) => ({
      sessionId: memory.threadId ?? memory.id,
      messageHash: messageHash(memory),
    }))
    .filter((message) => !processed.has(messageKey(message)));
}

export function shouldTriggerProjectMapAutoIngestion(input: {
  settings: ProjectMapAutoIngestionSettings;
  unprocessedMessages: ProjectMapProcessedMemoryMessage[];
}): boolean {
  return (
    input.settings.enabled &&
    input.settings.applyMode === "createCandidate" &&
    input.unprocessedMessages.length >= input.settings.newSessionThreshold
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

  const evidenceMatch = evidenceText.match(
    /((?:src|app|server|packages|crates|cmd|internal|openspec|tests?)\/[^\s`'")]+)/,
  );
  if (!evidenceMatch) {
    return null;
  }

  const targetNode =
    input.dataset.nodes.find((node) => node.lensId === "evidence") ??
    input.dataset.nodes[0];
  if (!targetNode) {
    return null;
  }

  const evidencePath = evidenceMatch[1];
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
