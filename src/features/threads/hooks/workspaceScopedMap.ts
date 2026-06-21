/**
 * chat-stream-render-isolation-2026-06 task 8.1 / 8.2: workspace-scope
 * helper for the 6 thread-scoped in-flight refs in `useThreads`.
 *
 * The 6 refs used to be `Record<threadId, T>` or `Set<threadId>` keyed
 * only by `threadId`. After the workspace-scope refactor they become
 * `Map<workspaceId, Map<threadId, T>>` so a workspace switch cannot
 * resurrect stale entries from a previous workspace.
 */

export type WorkspaceScopedMap<T> = Map<string, Map<string, T>>;

export function createWorkspaceScopedMap<T>(): WorkspaceScopedMap<T> {
  return new Map();
}

function bucketKey(workspaceId: string | null | undefined): string {
  return workspaceId ?? "__no_workspace__";
}

/**
 * Resolve the inner bucket for `workspaceId`, creating it on demand so
 * that `set` / `delete` can mutate it. `get` / `has` use the
 * side-effect-free variant below to keep reads cheap.
 */
function bucketFor<T>(
  store: WorkspaceScopedMap<T>,
  workspaceId: string | null | undefined,
): Map<string, T> {
  const key = bucketKey(workspaceId);
  let bucket = store.get(key);
  if (!bucket) {
    bucket = new Map();
    store.set(key, bucket);
  }
  return bucket;
}

/**
 * Side-effect-free bucket lookup. Used by `get` / `has` so a read on a
 * missing workspace does not silently materialize a new bucket in the
 * outer map (which would inflate eviction LRU accounting).
 */
function existingBucketFor<T>(
  store: WorkspaceScopedMap<T>,
  workspaceId: string | null | undefined,
): Map<string, T> | undefined {
  return store.get(bucketKey(workspaceId));
}

export function workspaceScopedGet<T>(
  store: WorkspaceScopedMap<T>,
  workspaceId: string | null | undefined,
  threadId: string,
): T | undefined {
  return existingBucketFor(store, workspaceId)?.get(threadId);
}

export function workspaceScopedHas<T>(
  store: WorkspaceScopedMap<T>,
  workspaceId: string | null | undefined,
  threadId: string,
): boolean {
  return existingBucketFor(store, workspaceId)?.has(threadId) ?? false;
}

export function workspaceScopedSet<T>(
  store: WorkspaceScopedMap<T>,
  workspaceId: string | null | undefined,
  threadId: string,
  value: T,
): void {
  bucketFor(store, workspaceId).set(threadId, value);
}

export function workspaceScopedDelete<T>(
  store: WorkspaceScopedMap<T>,
  workspaceId: string | null | undefined,
  threadId: string,
): void {
  const bucket = existingBucketFor(store, workspaceId);
  if (!bucket) {
    return;
  }
  bucket.delete(threadId);
  if (bucket.size === 0) {
    store.delete(bucketKey(workspaceId));
  }
}

/**
 * Iterate `(workspaceId, threadId, value)` triples in insertion order
 * across every workspace bucket. The iteration order is stable so call
 * sites can rely on it for eviction.
 */
export function workspaceScopedEntries<T>(
  store: WorkspaceScopedMap<T>,
): Array<{ workspaceId: string; threadId: string; value: T }> {
  const out: Array<{ workspaceId: string; threadId: string; value: T }> = [];
  for (const [workspaceId, bucket] of store) {
    for (const [threadId, value] of bucket) {
      out.push({ workspaceId, threadId, value });
    }
  }
  return out;
}

/**
 * Remove `(workspaceId, threadId)` from the store. Returns the number of
 * stores that were actually cleared so callers can confirm cleanup.
 */
export function cleanupThreadScopedRefs(
  stores: ReadonlyArray<WorkspaceScopedMap<unknown>>,
  workspaceId: string | null | undefined,
  threadId: string,
): number {
  let cleaned = 0;
  for (const store of stores) {
    if (workspaceScopedHas(store, workspaceId, threadId)) {
      workspaceScopedDelete(store, workspaceId, threadId);
      cleaned += 1;
    }
  }
  return cleaned;
}
