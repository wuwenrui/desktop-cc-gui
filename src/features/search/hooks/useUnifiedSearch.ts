import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ConversationItem,
  CustomCommandOption,
  SkillOption,
  ThreadSummary,
} from "../../../types";
import type { KanbanTask } from "../../kanban/types";
import type { HistoryItem } from "../../composer/hooks/useInputHistoryStore";
import { takeLimited } from "../perf/chunker";
import {
  type SearchEvidence,
  type SearchProviderTiming,
  sumProviderCandidates,
} from "../perf/evidence";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_PROVIDER_LIMITS,
  SEARCH_TOTAL_LIMIT,
} from "../perf/limits";
import { reportSearchMetrics } from "../perf/searchMetrics";
import { searchCommands } from "../providers/commandsProvider";
import { searchFiles } from "../providers/filesProvider";
import { searchHistory } from "../providers/historyProvider";
import { searchKanbanTasks } from "../providers/kanbanProvider";
import { searchMessages } from "../providers/messageProvider";
import { searchSkills } from "../providers/skillsProvider";
import { searchThreads } from "../providers/threadProvider";
import { loadSearchRecencyMap } from "../ranking/recencyStore";
import { compareSearchResults } from "../ranking/score";
import {
  discardIfStale,
  useSearchQueryToken,
} from "./searchQueryToken";
import type { SearchContentFilter, SearchResult } from "../types";

type WorkspaceSearchSource = {
  workspaceId: string;
  workspaceName: string;
  files: string[];
  sourceVersion?: string | null;
  threads: ThreadSummary[];
};

type UseUnifiedSearchOptions = {
  query: string;
  contentFilters: SearchContentFilter[];
  workspaceSources: WorkspaceSearchSource[];
  kanbanTasks: KanbanTask[];
  threadItemsByThread: Record<string, ConversationItem[]>;
  historyItems: HistoryItem[];
  skills: SkillOption[];
  commands: CustomCommandOption[];
  activeWorkspaceId?: string | null;
  maxResults?: number;
  workspaceNameByPath?: Map<string, string>;
};

export type ComputeUnifiedSearchOptions = Omit<UseUnifiedSearchOptions, "query" | "scope"> & {
  query: string;
  recencyMap?: Record<string, number>;
  reportMetrics?: boolean;
  // Optional evidence sink. When provided, the compute path emits a
  // `SearchEvidence` record per call. The hook does NOT pass this today;
  // fixture tests and future diagnostic tooling use it to assert on
  // per-call perf signals without having to mock `console.debug`.
  evidenceSink?: (evidence: SearchEvidence) => void;
};

function shouldIncludeSection(
  filters: SearchContentFilter[],
  section: Exclude<SearchContentFilter, "all">,
): boolean {
  return filters.includes("all") || filters.includes(section);
}

function attachWorkspaceLabel(
  result: SearchResult,
  workspaceNameById: Map<string, string>,
  workspaceNameByPath?: Map<string, string>,
): SearchResult {
  if (!result.workspaceId) {
    return result;
  }
  const workspaceName = workspaceNameById.get(result.workspaceId)
    ?? workspaceNameByPath?.get(result.workspaceId);
  if (!workspaceName) {
    return result;
  }
  return {
    ...result,
    workspaceName,
  };
}

export function useUnifiedSearch({
  query,
  contentFilters,
  workspaceSources,
  kanbanTasks,
  threadItemsByThread,
  historyItems,
  skills,
  commands,
  activeWorkspaceId,
  maxResults = SEARCH_TOTAL_LIMIT,
  workspaceNameByPath,
}: UseUnifiedSearchOptions) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recencyMap] = useState(() => loadSearchRecencyMap());

  // Query token guard. The ref advances on every (query, bumpKey) change so
  // any future async provider work can detect that it has been superseded.
  // Today the compute path is synchronous, so `discardIfStale` always
  // reports `staleDropped === false`; the hook is wired up so the stale
  // drop count can be plumbed into metrics without further refactor.
  const queryTokenRef = useSearchQueryToken(query);
  // Last successful (non-stale) result set. Used as the fallback when a
  // future async provider reports `staleDropped === true`: rather than
  // flicker to an empty list while the next query resolves, the consumer
  // keeps the previous stable results. In the current synchronous compute
  // path staleDropped is never true, so this ref is effectively the same
  // value as the most recent useMemo result.
  const lastCommittedResultsRef = useRef<SearchResult[]>([]);
  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const computedResults = useMemo(() => {
    const capturedToken = queryTokenRef.current;
    const raw = computeUnifiedSearchResults({
      query: debouncedQuery,
      contentFilters,
      workspaceSources,
      kanbanTasks,
      threadItemsByThread,
      historyItems,
      skills,
      commands,
      activeWorkspaceId,
      maxResults,
      recencyMap,
      reportMetrics: true,
      workspaceNameByPath,
    });
    const guarded = discardIfStale(queryTokenRef.current, capturedToken, raw);
    if (guarded.staleDropped) {
      return lastCommittedResultsRef.current;
    }
    lastCommittedResultsRef.current = guarded.value;
    return guarded.value;
  }, [
    debouncedQuery,
    historyItems,
    kanbanTasks,
    maxResults,
    contentFilters,
    commands,
    skills,
    activeWorkspaceId,
    threadItemsByThread,
    workspaceSources,
    workspaceNameByPath,
    recencyMap,
    queryTokenRef,
  ]);

  return computedResults;
}

export function computeUnifiedSearchResults({
  query,
  contentFilters,
  workspaceSources,
  kanbanTasks,
  threadItemsByThread,
  historyItems,
  skills,
  commands,
  activeWorkspaceId,
  maxResults = SEARCH_TOTAL_LIMIT,
  recencyMap,
  reportMetrics = false,
  workspaceNameByPath,
  evidenceSink,
}: ComputeUnifiedSearchOptions): SearchResult[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [] as SearchResult[];
  }

  const startedAt = performance.now();
  const recentOpenMap = recencyMap ?? loadSearchRecencyMap();
  const providerTimings: SearchProviderTiming[] = [];
  const workspaceNameById = new Map(
    workspaceSources.map((source) => [source.workspaceId, source.workspaceName]),
  );

  const merged: SearchResult[] = [];
  const collectProviderResults = (
    provider: string,
    candidateCount: number,
    limit: number,
    searchProvider: () => SearchResult[],
  ) => {
    const providerStartedAt = performance.now();
    const results = takeLimited(searchProvider(), limit);
    providerTimings.push({
      provider,
      elapsedMs: Math.round(performance.now() - providerStartedAt),
      candidateCount,
      resultCount: results.length,
    });
    merged.push(...results);
  };

  for (const source of workspaceSources) {
    if (shouldIncludeSection(contentFilters, "files")) {
      collectProviderResults(
        "files",
        source.files.length,
        Math.max(8, Math.floor(SEARCH_PROVIDER_LIMITS.files / Math.max(workspaceSources.length, 1))),
        () => searchFiles(normalizedQuery, source.files, source.workspaceId, source.sourceVersion),
      );
    }
    if (shouldIncludeSection(contentFilters, "threads")) {
      collectProviderResults(
        "threads",
        source.threads.length,
        Math.max(8, Math.floor(SEARCH_PROVIDER_LIMITS.threads / Math.max(workspaceSources.length, 1))),
        () => searchThreads(normalizedQuery, source.threads, source.workspaceId),
      );
    }
    if (shouldIncludeSection(contentFilters, "messages")) {
      const messageCandidateCount = source.threads.reduce(
        (count, thread) => count + (threadItemsByThread[thread.id]?.length ?? 0),
        0,
      );
      collectProviderResults(
        "messages",
        messageCandidateCount,
        Math.max(8, Math.floor(SEARCH_PROVIDER_LIMITS.messages / Math.max(workspaceSources.length, 1))),
        () =>
          searchMessages({
            query: normalizedQuery,
            workspaceId: source.workspaceId,
            threads: source.threads,
            threadItemsByThread,
          }),
      );
    }
  }

  if (shouldIncludeSection(contentFilters, "kanban")) {
    collectProviderResults(
      "kanban",
      kanbanTasks.length,
      SEARCH_PROVIDER_LIMITS.kanban,
      () => searchKanbanTasks(normalizedQuery, kanbanTasks),
    );
  }
  if (shouldIncludeSection(contentFilters, "history")) {
    collectProviderResults(
      "history",
      historyItems.length,
      SEARCH_PROVIDER_LIMITS.history,
      () => searchHistory(normalizedQuery, historyItems),
    );
  }
  if (shouldIncludeSection(contentFilters, "skills")) {
    collectProviderResults(
      "skills",
      skills.length,
      SEARCH_PROVIDER_LIMITS.skills,
      () => searchSkills(normalizedQuery, skills, activeWorkspaceId),
    );
  }
  if (shouldIncludeSection(contentFilters, "commands")) {
    collectProviderResults(
      "commands",
      commands.length,
      SEARCH_PROVIDER_LIMITS.commands,
      () => searchCommands(normalizedQuery, commands),
    );
  }

  const withScopeLabel = merged.map((entry) => attachWorkspaceLabel(entry, workspaceNameById, workspaceNameByPath));
  withScopeLabel.sort((a, b) => compareSearchResults(a, b, recentOpenMap));
  const sliced = withScopeLabel.slice(0, maxResults);

  if (reportMetrics) {
    reportSearchMetrics({
      query: normalizedQuery,
      elapsedMs: Math.round(performance.now() - startedAt),
      resultCount: sliced.length,
      providerTimings,
      hydrationState: workspaceSources.length <= 1 ? "active-only" : "partial-global",
      staleDropCount: 0,
    });
  }

  if (evidenceSink) {
    evidenceSink({
      query: normalizedQuery,
      elapsedMs: Math.round(performance.now() - startedAt),
      resultCount: sliced.length,
      providerTimings,
      hydrationState:
        workspaceSources.length <= 1 ? "active-only" : "partial-global",
      staleDropCount: 0,
      candidateTotal: sumProviderCandidates(providerTimings),
      capturedAt:
        typeof performance !== "undefined" ? performance.now() : Date.now(),
    });
  }

  return sliced;
}
