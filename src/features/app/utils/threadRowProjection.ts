/**
 * Visible-row projection helpers.
 *
 * The session list projection (processing state, unread badge, background
 * activity label) is computed only for visible rows. A bounded LRU caches
 * the projection result keyed on `(workspaceId, threadId, statusVersion)`.
 */

const PROJECTION_CACHE_MAX_ENTRIES = 200;

export type ThreadRowProjection = {
  threadId: string;
  workspaceId: string;
  statusVersion: string;
  isProcessing: boolean;
  hasUnread: boolean;
  backgroundActivityLabel: string | null;
};

export type ProjectionInput = {
  workspaceId: string;
  threadId: string;
  statusVersion: string;
  isProcessing: boolean;
  hasUnread: boolean;
  backgroundActivityLabel: string | null;
};

type ProjectionCacheKey = string;

function projectionKey(input: ProjectionInput): ProjectionCacheKey {
  return `${input.workspaceId}|${input.threadId}|${input.statusVersion}`;
}

class BoundedProjectionCache {
  private readonly entries = new Map<ProjectionCacheKey, ThreadRowProjection>();

  get(key: ProjectionCacheKey): ThreadRowProjection | undefined {
    const value = this.entries.get(key);
    if (value) {
      // Refresh recency — Map iteration is insertion order.
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: ProjectionCacheKey, value: ThreadRowProjection): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= PROJECTION_CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }
    this.entries.set(key, value);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

const projectionCache = new BoundedProjectionCache();

export function getThreadRowProjection(
  input: ProjectionInput,
): ThreadRowProjection {
  const key = projectionKey(input);
  const cached = projectionCache.get(key);
  if (cached) {
    return cached;
  }
  const value: ThreadRowProjection = {
    threadId: input.threadId,
    workspaceId: input.workspaceId,
    statusVersion: input.statusVersion,
    isProcessing: input.isProcessing,
    hasUnread: input.hasUnread,
    backgroundActivityLabel: input.backgroundActivityLabel,
  };
  projectionCache.set(key, value);
  return value;
}

export function clearThreadRowProjectionCache(): void {
  projectionCache.clear();
}

export function getThreadRowProjectionCacheSize(): number {
  return projectionCache.size();
}
