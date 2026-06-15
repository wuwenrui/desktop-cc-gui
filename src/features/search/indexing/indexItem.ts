import type { SearchResultKind } from "../types";

// Per-provider normalized candidate produced by an index builder.
// Builders MUST keep content-sensitive fields bounded (truncated previews or
// stable ids) so the cache is cheap to keep around and safe to log.
export type IndexedItem = {
  // Stable id; uniquely identifies the candidate across rebuilds. MUST NOT
  // depend on transient values like array indexes or timestamps.
  id: string;
  // Display token the query will match against. Lowercase and trimmed.
  // Whitespace splitting is the consumer's responsibility; this field is
  // stored as-is to preserve original token boundaries.
  matchText: string;
  // Provider kind this candidate was built from. Used for invalidation and
  // for routing partial rebuilds.
  kind: SearchResultKind;
  // Optional second match slot (subtitle / path / label). Kept separate from
  // matchText so providers can choose to score it differently later.
  secondaryText?: string;
  // Sort key the ranker can use without recomputing (e.g. updatedAt, weight).
  sortKey?: number;
  // Workspace id when the candidate is workspace-scoped. Undefined for
  // workspace-agnostic providers (commands / skills).
  workspaceId?: string;
};

// Source version is the invalidation key. A change in sourceVersion MUST
// trigger a rebuild before the next query reads the index. For workspace
// scoped providers the convention is a stable numeric fingerprint of the
// normalized indexed fields, so consumers can detect same-count content
// changes without storing full source content in diagnostics.
export type SourceVersion = {
  workspaceId: string;
  provider: SearchResultKind;
  // The current content-aware source fingerprint, or a caller supplied value
  // when the provider needs a manual bump.
  version: number;
  // When the version last changed. Used for diagnostics only.
  updatedAt: number;
};

// Container returned by a per-workspace index builder. Holds normalized
// items for every provider the workspace has, plus the source version each
// provider last synced.
export type WorkspaceIndexState = {
  workspaceId: string;
  items: Partial<Record<SearchResultKind, IndexedItem[]>>;
  sourceVersions: Partial<Record<SearchResultKind, SourceVersion>>;
};

export function isIndexStale(
  state: WorkspaceIndexState | undefined,
  expected: SourceVersion,
): boolean {
  if (!state) {
    return true;
  }
  if (state.workspaceId !== expected.workspaceId) {
    return true;
  }
  const current = state.sourceVersions[expected.provider];
  if (!current) {
    return true;
  }
  if (current.workspaceId !== expected.workspaceId || current.provider !== expected.provider) {
    return true;
  }
  return current.version !== expected.version;
}
