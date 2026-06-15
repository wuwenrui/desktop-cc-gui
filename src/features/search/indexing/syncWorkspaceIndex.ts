import type { SearchResultKind } from "../types";
import {
  isIndexStale,
  type SourceVersion,
  type WorkspaceIndexState,
} from "./indexItem";
import {
  buildWorkspaceIndex,
  sourceVersionKey,
  threadFingerprints,
  type WorkspaceIndexInput,
} from "./buildWorkspaceIndex";

type WorkspaceScopedProvider = "file" | "thread" | "message";

export type SyncWorkspaceIndexInput = WorkspaceIndexInput & {
  // The previous state for this workspace. When undefined, the result is
  // identical to a fresh buildWorkspaceIndex call. The caller is expected
  // to keep the previous state per-workspace (e.g. in a Map keyed by
  // workspaceId) and pass it in.
  previous?: WorkspaceIndexState;
};

export function isProviderStale(
  state: WorkspaceIndexState | undefined,
  workspaceId: string,
  provider: WorkspaceScopedProvider,
  input: WorkspaceIndexInput,
): boolean {
  const expected = sourceVersionKey(workspaceId, provider, input);
  return isIndexStale(state, expected);
}

// Reconcile a previous state with new raw inputs. The output preserves any
// non-stale provider's items and sourceVersion, and rebuilds only the
// providers whose content-aware source version changed.
//
// The version key is derived from the normalized indexed fields, not just
// raw counts, so same-count replacements, thread renames, and message
// edits do not leave stale index rows behind.
export function syncWorkspaceIndex(
  input: SyncWorkspaceIndexInput,
): WorkspaceIndexState {
  const { previous } = input;
  if (!previous || previous.workspaceId !== input.workspaceId) {
    return buildWorkspaceIndex(input);
  }

  const fileStale = isProviderStale(previous, input.workspaceId, "file", input);
  const threadStale = isProviderStale(previous, input.workspaceId, "thread", input);
  const messageStale = isProviderStale(previous, input.workspaceId, "message", input);

  if (!fileStale && !threadStale && !messageStale) {
    return previous;
  }

  // Only rebuild the providers that are stale. We re-derive version keys
  // from the same content-aware source version logic so the next stale
  // check sees a consistent value.
  const fresh = buildWorkspaceIndex(input);

  const nextItems: WorkspaceIndexState["items"] = {
    file: fileStale ? fresh.items.file : previous.items.file,
    thread: threadStale ? fresh.items.thread : previous.items.thread,
    message: messageStale ? fresh.items.message : previous.items.message,
  };

  const nextVersions: WorkspaceIndexState["sourceVersions"] = {
    file: fileStale ? fresh.sourceVersions.file : previous.sourceVersions.file,
    thread: threadStale ? fresh.sourceVersions.thread : previous.sourceVersions.thread,
    message: messageStale ? fresh.sourceVersions.message : previous.sourceVersions.message,
  };

  return {
    workspaceId: input.workspaceId,
    items: nextItems,
    sourceVersions: nextVersions,
  };
}

// Re-export for consumers that want to read the version key off the state.
// Accepts any SearchResultKind so callers can probe workspace-agnostic
// providers too.
export function versionKeyForProvider(
  state: WorkspaceIndexState,
  provider: SearchResultKind,
): SourceVersion | undefined {
  return state.sourceVersions[provider];
}

export { threadFingerprints };
