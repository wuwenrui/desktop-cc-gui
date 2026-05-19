import type { ThreadSummary } from "../../../types";

const GENERIC_SESSION_TITLE_PATTERN =
  /^(codex session|claude session|gemini session|opencode session)$/i;
const ORDINAL_AGENT_TITLE_PATTERN = /^agent\s+\d+$/i;
const SHORT_HEX_TITLE_PATTERN = /^[a-f0-9]{4,8}$/i;

type SessionDisplayTitleStrength = 0 | 1 | 2;

export function normalizeSessionDisplayTitle(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isWeakSessionDisplayTitle(value: string | null | undefined): boolean {
  return getSessionDisplayTitleStrength(value) < 2;
}

function getSessionDisplayTitleStrength(
  value: string | null | undefined,
): SessionDisplayTitleStrength {
  const normalized = normalizeSessionDisplayTitle(value);
  if (!normalized || ORDINAL_AGENT_TITLE_PATTERN.test(normalized) || SHORT_HEX_TITLE_PATTERN.test(normalized)) {
    return 0;
  }
  if (GENERIC_SESSION_TITLE_PATTERN.test(normalized)) {
    return 1;
  }
  return 2;
}

export function selectProjectedSessionDisplayName(params: {
  previous?: ThreadSummary;
  nextName: string;
  mappedTitle?: string;
  customTitle?: string;
}): string {
  const mappedTitle = normalizeSessionDisplayTitle(params.mappedTitle);
  if (mappedTitle) {
    return mappedTitle;
  }

  const customTitle = normalizeSessionDisplayTitle(params.customTitle);
  if (customTitle) {
    return customTitle;
  }

  if (
    params.previous &&
    getSessionDisplayTitleStrength(params.previous.name) >
      getSessionDisplayTitleStrength(params.nextName)
  ) {
    return params.previous.name;
  }

  return params.nextName;
}

export function mergeSessionDisplaySummary(
  previous: ThreadSummary | undefined,
  next: ThreadSummary,
  options: {
    mappedTitle?: string;
    customTitle?: string;
  } = {},
): ThreadSummary {
  if (!previous || previous.id !== next.id) {
    const projectedName = selectProjectedSessionDisplayName({
      nextName: next.name,
      mappedTitle: options.mappedTitle,
      customTitle: options.customTitle,
    });
    return projectedName === next.name ? next : { ...next, name: projectedName };
  }

  const engineSource = next.engineSource ?? previous.engineSource;
  return {
    ...previous,
    ...next,
    engineSource,
    name: selectProjectedSessionDisplayName({
      previous,
      nextName: next.name,
      mappedTitle: options.mappedTitle,
      customTitle: options.customTitle,
    }),
    parentThreadId: next.parentThreadId ?? previous.parentThreadId ?? null,
    folderId: next.folderId ?? previous.folderId ?? null,
  };
}

export function projectSessionDisplaySummaries(params: {
  baseSummaries: ThreadSummary[];
  candidateSummaries: ThreadSummary[];
  excludedThreadIds?: ReadonlySet<string>;
  canRetainCandidate?: (summary: ThreadSummary) => boolean;
  mergeOlderCandidates?: boolean;
}): ThreadSummary[] {
  const {
    baseSummaries,
    candidateSummaries,
    excludedThreadIds = new Set<string>(),
    canRetainCandidate = () => true,
    mergeOlderCandidates = false,
  } = params;
  const mergedById = new Map<string, ThreadSummary>();
  baseSummaries.forEach((entry) => {
    if (!excludedThreadIds.has(entry.id)) {
      mergedById.set(entry.id, entry);
    }
  });

  candidateSummaries.forEach((candidate) => {
    if (excludedThreadIds.has(candidate.id) || !canRetainCandidate(candidate)) {
      return;
    }
    const previous = mergedById.get(candidate.id);
    if (previous && candidate.updatedAt < previous.updatedAt) {
      if (!mergeOlderCandidates) {
        return;
      }
      mergedById.set(candidate.id, mergeSessionDisplaySummary(candidate, previous));
      return;
    }
    mergedById.set(candidate.id, mergeSessionDisplaySummary(previous, candidate));
  });

  return Array.from(mergedById.values()).sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}
