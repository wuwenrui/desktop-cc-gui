import { useCallback } from "react";
import type {
  WorkspaceSessionArchiveEvidence,
  WorkspaceSessionCatalogPage,
  WorkspaceSessionCatalogQuery,
  WorkspaceSessionCatalogSourceStatus,
} from "../../../services/tauri";
import { withTimeout } from "./useThreadActions.helpers";
import {
  CODEX_SESSION_CATALOG_FETCH_TIMEOUT_MS,
  SESSION_CATALOG_PAGE_SIZE,
  normalizeProjectCatalogSession,
  type ProjectCatalogSessionSummary,
} from "./useThreadActions.threadList";

const ACTIVE_PROJECT_CATALOG_MAX_PAGES = 50;

export type ListWorkspaceSessionsService = (
  workspaceId: string,
  options: {
    query?: WorkspaceSessionCatalogQuery | null;
    cursor?: string | null;
    limit?: number | null;
  },
) => Promise<WorkspaceSessionCatalogPage>;

export type ListWorkspaceSessionArchiveEvidenceService = (
  workspaceId: string,
) => Promise<WorkspaceSessionArchiveEvidence>;

export type ArchivedSessionMapResult = {
  archivedAtBySessionId: Map<string, number>;
  partialSource: string | null;
  sourceStatuses: WorkspaceSessionCatalogSourceStatus[];
  isComplete: boolean;
};

type UseThreadActionsSessionCatalogOptions = {
  canListWorkspaceSessions: boolean;
  listWorkspaceSessionsService: ListWorkspaceSessionsService | null;
  listWorkspaceSessionArchiveEvidenceService:
    | ListWorkspaceSessionArchiveEvidenceService
    | null;
};

function mergeFirstPartialSource(
  current: string | null,
  incoming: string | null | undefined,
): string | null {
  if (current) {
    return current;
  }
  const normalized = typeof incoming === "string" ? incoming.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

function mergeSourceStatusesByEngine(
  current: WorkspaceSessionCatalogSourceStatus[],
  incoming: WorkspaceSessionCatalogSourceStatus[] | null | undefined,
): WorkspaceSessionCatalogSourceStatus[] {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return current;
  }
  const byEngine = new Map(current.map((status) => [status.engine, status]));
  incoming.forEach((status) => {
    if (!status.engine) {
      return;
    }
    byEngine.set(status.engine, status);
  });
  return Array.from(byEngine.values());
}

export function useThreadActionsSessionCatalog({
  canListWorkspaceSessions,
  listWorkspaceSessionsService,
  listWorkspaceSessionArchiveEvidenceService,
}: UseThreadActionsSessionCatalogOptions) {
  const loadArchivedSessionMap = useCallback(
    async (workspaceId: string): Promise<ArchivedSessionMapResult | null> => {
      if (
        !canListWorkspaceSessions ||
        !listWorkspaceSessionArchiveEvidenceService
      ) {
        return null;
      }
      try {
        const response = await withTimeout(
          listWorkspaceSessionArchiveEvidenceService(workspaceId),
          CODEX_SESSION_CATALOG_FETCH_TIMEOUT_MS,
        );
        if (!response) {
          return {
            archivedAtBySessionId: new Map(),
            partialSource: "session-catalog-archive-evidence-timeout",
            sourceStatuses: [],
            isComplete: false,
          };
        }
        const archivedAtBySessionId = new Map<string, number>();
        Object.entries(response.archivedAtBySessionId ?? {}).forEach(
          ([sessionId, archivedAt]) => {
            if (typeof archivedAt !== "number" || !Number.isFinite(archivedAt)) {
              return;
            }
            if (archivedAt > 0) {
              archivedAtBySessionId.set(sessionId, archivedAt);
            }
          },
        );
        const sourceStatuses = Array.isArray(response.sourceStatuses)
          ? response.sourceStatuses
          : [];
        const isComplete =
          !response.partialSource &&
          sourceStatuses.length > 0 &&
          sourceStatuses.every(
            (status) =>
              status.completeness === "complete" ||
              status.completeness === "authoritative_empty",
          );
        return {
          archivedAtBySessionId,
          partialSource: response.partialSource ?? null,
          sourceStatuses,
          isComplete,
        };
      } catch {
        return {
          archivedAtBySessionId: new Map(),
          partialSource: "session-catalog-archive-evidence-error",
          sourceStatuses: [],
          isComplete: false,
        };
      }
    },
    [canListWorkspaceSessions, listWorkspaceSessionArchiveEvidenceService],
  );

  const loadActiveProjectCatalogSessions = useCallback(
    async (
      workspaceId: string,
    ): Promise<{
      sessions: ProjectCatalogSessionSummary[];
      partialSource: string | null;
      nextCursor: string | null;
      sourceStatuses: WorkspaceSessionCatalogSourceStatus[];
    } | null> => {
      if (!canListWorkspaceSessions || !listWorkspaceSessionsService) {
        return null;
      }
      const sessionsById = new Map<string, ProjectCatalogSessionSummary>();
      const seenCursors = new Set<string>();
      let cursor: string | null = null;
      let partialSource: string | null = null;
      let sourceStatuses: WorkspaceSessionCatalogSourceStatus[] = [];
      let pageCount = 0;
      do {
        pageCount += 1;
        if (cursor) {
          if (seenCursors.has(cursor)) {
            partialSource = mergeFirstPartialSource(
              partialSource,
              "session-catalog-cursor-loop",
            );
            cursor = null;
            break;
          }
          seenCursors.add(cursor);
        }
        const response: WorkspaceSessionCatalogPage | null = await withTimeout(
          listWorkspaceSessionsService(workspaceId, {
            query: { status: "active" },
            cursor,
            limit: SESSION_CATALOG_PAGE_SIZE,
          }),
          CODEX_SESSION_CATALOG_FETCH_TIMEOUT_MS,
        );
        if (!response) {
          partialSource = mergeFirstPartialSource(
            partialSource,
            "session-catalog-timeout",
          );
          cursor = null;
          break;
        }
        response.data
          .map((entry: unknown) => normalizeProjectCatalogSession(entry))
          .filter((entry): entry is ProjectCatalogSessionSummary => Boolean(entry))
          .forEach((entry) => {
            if (!sessionsById.has(entry.sessionId)) {
              sessionsById.set(entry.sessionId, entry);
            }
          });
        partialSource = mergeFirstPartialSource(
          partialSource,
          response.partialSource,
        );
        sourceStatuses = mergeSourceStatusesByEngine(
          sourceStatuses,
          response.sourceStatuses,
        );
        cursor = response.nextCursor ?? null;
        if (cursor && pageCount >= ACTIVE_PROJECT_CATALOG_MAX_PAGES) {
          partialSource = mergeFirstPartialSource(
            partialSource,
            "session-catalog-page-cap",
          );
          cursor = null;
          break;
        }
      } while (cursor);
      const sessions = Array.from(sessionsById.values());
      return {
        sessions,
        partialSource,
        nextCursor: cursor,
        sourceStatuses,
      };
    },
    [canListWorkspaceSessions, listWorkspaceSessionsService],
  );

  return {
    loadActiveProjectCatalogSessions,
    loadArchivedSessionMap,
  };
}
