import type { ConversationItem, ThreadSummary } from "../../../types";
import {
  type IndexedItem,
  type SourceVersion,
  type WorkspaceIndexState,
} from "./indexItem";
import {
  buildWorkspaceMessageIndex,
  makeMessageSnippet,
} from "./messageIndex";

type WorkspaceScopedProvider = "file" | "thread" | "message";

export type WorkspaceIndexInput = {
  workspaceId: string;
  files: string[];
  threads: ThreadSummary[];
  threadItemsByThread: Record<string, ConversationItem[]>;
};

const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;

function hashParts(parts: string[]): number {
  if (parts.length === 0) {
    return 0;
  }

  let hash = FNV_OFFSET_BASIS;
  for (const part of parts) {
    for (let index = 0; index < part.length; index += 1) {
      hash ^= part.charCodeAt(index);
      hash = Math.imul(hash, FNV_PRIME) >>> 0;
    }
    hash ^= 0;
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

function fileFingerprints(files: string[]): string[] {
  return files
    .map((filePath) => filePath.trim())
    .filter(Boolean)
    .sort()
    .map((filePath) => `file\u0000${filePath}`);
}

export function threadFingerprints(
  threads: ThreadSummary[],
): string[] {
  return threads
    .filter((thread) => thread.name.trim().length > 0)
    .map((thread) => `thread\u0000${thread.id}\u0000${thread.name}\u0000${thread.updatedAt}`)
    .sort();
}

function messageFingerprints(input: WorkspaceIndexInput): string[] {
  const fingerprints: string[] = [];
  for (const thread of input.threads) {
    const items = input.threadItemsByThread[thread.id] ?? [];
    for (const item of items) {
      if (item.kind !== "message") {
        continue;
      }
      const text = item.text.trim();
      if (!text) {
        continue;
      }
      fingerprints.push(`message\u0000${thread.id}\u0000${item.id}\u0000${text}`);
    }
  }
  return fingerprints.sort();
}

function providerVersion(
  input: WorkspaceIndexInput,
  provider: WorkspaceScopedProvider,
): number {
  if (provider === "file") {
    return hashParts(fileFingerprints(input.files));
  }
  if (provider === "thread") {
    return hashParts(threadFingerprints(input.threads));
  }
  return hashParts(messageFingerprints(input));
}

function makeVersion(
  workspaceId: string,
  provider: WorkspaceScopedProvider,
  version: number,
): SourceVersion {
  return {
    workspaceId,
    provider,
    version,
    updatedAt: Date.now(),
  };
}

// Build a normalized index for a single workspace. This is a pure function:
// it does not retain references to the input arrays and does not mutate them.
// The returned state is keyed by SearchResultKind so the consumer (search
// compute) can read it provider by provider.
//
// Only the workspace-scoped providers (file / thread / message) are
// normalized here. kanban / history / skills / commands remain workspace
// agnostic in their raw form and are handled by their own providers without
// the index layer until a later change introduces per-workspace scoping.
export function buildWorkspaceIndex(
  input: WorkspaceIndexInput,
): WorkspaceIndexState {
  const fileItems: IndexedItem[] = input.files
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
    .map((path) => ({
      id: `file:${input.workspaceId}:${path}`,
      matchText: path.toLowerCase(),
      secondaryText: path,
      kind: "file",
      workspaceId: input.workspaceId,
    }));

  const threadItems: IndexedItem[] = input.threads
    .filter((thread) => thread.name.trim().length > 0)
    .map((thread) => ({
      id: `thread:${input.workspaceId}:${thread.id}`,
      matchText: thread.name.toLowerCase(),
      secondaryText: thread.id,
      sortKey: thread.updatedAt,
      kind: "thread",
      workspaceId: input.workspaceId,
    }));

  const indexedMessages = buildWorkspaceMessageIndex(
    input.threads.map((thread) => thread.id),
    input.threadItemsByThread,
  );
  const messageItems: IndexedItem[] = indexedMessages.map((message) => ({
    id: `message:${input.workspaceId}:${message.threadId}:${message.messageId}`,
    matchText: message.text.toLowerCase(),
    secondaryText: makeMessageSnippet(message.text, ""),
    kind: "message",
    workspaceId: input.workspaceId,
  }));

  const items: WorkspaceIndexState["items"] = {
    file: fileItems,
    thread: threadItems,
    message: messageItems,
  };

  const sourceVersions: WorkspaceIndexState["sourceVersions"] = {
    file: makeVersion(input.workspaceId, "file", providerVersion(input, "file")),
    thread: makeVersion(input.workspaceId, "thread", providerVersion(input, "thread")),
    message: makeVersion(input.workspaceId, "message", providerVersion(input, "message")),
  };

  return {
    workspaceId: input.workspaceId,
    items,
    sourceVersions,
  };
}

// Compose the same content-aware source version key used by
// buildWorkspaceIndex. The key is derived from the normalized indexed
// fields, so same-count replacements, thread renames, and message edits
// invalidate stale provider slices without storing full source content in
// diagnostics.
export function sourceVersionKey(
  workspaceId: string,
  provider: WorkspaceScopedProvider,
  input: WorkspaceIndexInput,
): SourceVersion {
  return {
    workspaceId,
    provider,
    version: providerVersion(input, provider),
    updatedAt: 0,
  };
}
