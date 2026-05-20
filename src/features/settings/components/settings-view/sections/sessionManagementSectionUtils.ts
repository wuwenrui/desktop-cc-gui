import type { TFunction } from "i18next";
import type { EngineType, WorkspaceInfo } from "../../../../../types";
import type {
  WorkspaceSessionCatalogEntry,
  WorkspaceSessionFolder,
} from "../../../../../services/tauri";

export type GroupedWorkspace = {
  id: string | null;
  name: string;
  workspaces: WorkspaceInfo[];
};

export type WorkspaceOption = {
  id: string;
  label: string;
  pickerLabel: string;
  depth: number;
  kind: "project" | "worktree";
};

export type SessionFolderNavItem = {
  id: string;
  label: string;
  depth: number;
  count: number;
};

export type SessionFolderCountSummary = {
  folderCountsById: Map<string, number>;
  unassignedFolderCount: number;
};

function getSortOrderValue(value: number | null | undefined) {
  return typeof value === "number" ? value : Number.MAX_SAFE_INTEGER;
}

export function buildWorkspaceOptions(
  workspaces: WorkspaceInfo[],
  groupedWorkspaces: GroupedWorkspace[],
  scopeLabels: {
    project: string;
    worktree: string;
  },
): WorkspaceOption[] {
  const rootById = new Map<string, WorkspaceInfo>();
  const worktreesByParent = new Map<string, WorkspaceInfo[]>();

  workspaces.forEach((workspace) => {
    if ((workspace.kind ?? "main") === "worktree" && workspace.parentId) {
      const bucket = worktreesByParent.get(workspace.parentId) ?? [];
      bucket.push(workspace);
      worktreesByParent.set(workspace.parentId, bucket);
      return;
    }
    rootById.set(workspace.id, workspace);
  });

  const appendOptionsForWorkspace = (
    workspace: WorkspaceInfo,
    output: WorkspaceOption[],
  ) => {
    const groupPrefix =
      groupedWorkspaces.find((group) =>
        group.workspaces.some((item) => item.id === workspace.id),
      )?.name ?? "";
    const baseLabel = groupPrefix
      ? `${groupPrefix} / ${workspace.name}`
      : workspace.name;
    output.push({
      id: workspace.id,
      label: baseLabel,
      pickerLabel: groupPrefix
        ? `${groupPrefix} / ${scopeLabels.project} ${workspace.name}`
        : `${scopeLabels.project} ${workspace.name}`,
      depth: 0,
      kind: "project",
    });
    const worktrees = [...(worktreesByParent.get(workspace.id) ?? [])].sort(
      (left, right) => {
        const sortDiff =
          getSortOrderValue(left.settings.sortOrder) -
          getSortOrderValue(right.settings.sortOrder);
        if (sortDiff !== 0) {
          return sortDiff;
        }
        return left.name.localeCompare(right.name);
      },
    );
    worktrees.forEach((worktree) => {
      const scopedLabel = `${scopeLabels.worktree} ${worktree.name}`;
      output.push({
        id: worktree.id,
        label: `${groupPrefix ? `${groupPrefix} / ` : ""}${scopedLabel}`,
        pickerLabel: `${groupPrefix ? `${groupPrefix} / ` : ""}${scopedLabel}`,
        depth: 1,
        kind: "worktree",
      });
    });
  };

  const orderedRoots = [...rootById.values()].sort((left, right) => {
    const sortDiff =
      getSortOrderValue(left.settings.sortOrder) -
      getSortOrderValue(right.settings.sortOrder);
    if (sortDiff !== 0) {
      return sortDiff;
    }
    return left.name.localeCompare(right.name);
  });

  const options: WorkspaceOption[] = [];
  orderedRoots.forEach((workspace) =>
    appendOptionsForWorkspace(workspace, options),
  );
  return options;
}

export function normalizeSessionFolderId(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildSessionFolderNavItems(
  folders: WorkspaceSessionFolder[],
  folderCountsById: ReadonlyMap<string, number>,
): SessionFolderNavItem[] {
  const folderIds = new Set(folders.map((folder) => folder.id));
  const parentById = new Map(
    folders.map(
      (folder) =>
        [folder.id, normalizeSessionFolderId(folder.parentId)] as const,
    ),
  );
  const childrenByParent = new Map<string | null, WorkspaceSessionFolder[]>();

  const hasCycle = (folderId: string) => {
    const seen = new Set<string>();
    let cursor: string | null = folderId;
    while (cursor) {
      if (seen.has(cursor)) {
        return true;
      }
      seen.add(cursor);
      cursor = parentById.get(cursor) ?? null;
    }
    return false;
  };

  [...folders]
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.createdAt - right.createdAt ||
        left.id.localeCompare(right.id),
    )
    .forEach((folder) => {
      const parentId = normalizeSessionFolderId(folder.parentId);
      const safeParentId =
        parentId &&
        parentId !== folder.id &&
        folderIds.has(parentId) &&
        !hasCycle(folder.id)
          ? parentId
          : null;
      const siblings = childrenByParent.get(safeParentId) ?? [];
      siblings.push(folder);
      childrenByParent.set(safeParentId, siblings);
    });

  const items: SessionFolderNavItem[] = [];
  const visit = (parentId: string | null, depth: number) => {
    (childrenByParent.get(parentId) ?? []).forEach((folder) => {
      items.push({
        id: folder.id,
        label: folder.name,
        depth,
        count: folderCountsById.get(folder.id) ?? 0,
      });
      visit(folder.id, depth + 1);
    });
  };
  visit(null, 1);
  return items;
}

export function buildLoadedSessionFolderCountSummary(
  entries: WorkspaceSessionCatalogEntry[],
): SessionFolderCountSummary {
  const folderCountsById = new Map<string, number>();
  const effectiveFolderBySessionId = buildEffectiveSessionFolderMap(entries);
  let unassignedFolderCount = 0;

  entries.forEach((entry) => {
    const folderId = normalizeSessionFolderId(
      effectiveFolderBySessionId.get(entry.sessionId),
    );
    if (!folderId) {
      unassignedFolderCount += 1;
      return;
    }
    folderCountsById.set(folderId, (folderCountsById.get(folderId) ?? 0) + 1);
  });

  return {
    folderCountsById,
    unassignedFolderCount,
  };
}

export function buildEffectiveSessionFolderMap(
  entries: WorkspaceSessionCatalogEntry[],
) {
  const entryBySessionId = new Map(
    entries.map((entry) => [entry.sessionId, entry]),
  );
  const effectiveFolderBySessionId = new Map<string, string | null>();

  const resolveEffectiveFolderId = (
    entry: WorkspaceSessionCatalogEntry,
    visiting: Set<string>,
  ): string | null => {
    if (effectiveFolderBySessionId.has(entry.sessionId)) {
      return effectiveFolderBySessionId.get(entry.sessionId) ?? null;
    }

    const explicitFolderId = normalizeSessionFolderId(entry.folderId);
    if (explicitFolderId) {
      effectiveFolderBySessionId.set(entry.sessionId, explicitFolderId);
      return explicitFolderId;
    }

    const parentSessionId = normalizeSessionFolderId(entry.parentSessionId);
    const parent = parentSessionId
      ? entryBySessionId.get(parentSessionId)
      : null;
    if (!parent || visiting.has(entry.sessionId)) {
      effectiveFolderBySessionId.set(entry.sessionId, null);
      return null;
    }

    visiting.add(entry.sessionId);
    const inheritedFolderId = resolveEffectiveFolderId(parent, visiting);
    visiting.delete(entry.sessionId);
    effectiveFolderBySessionId.set(entry.sessionId, inheritedFolderId);
    return inheritedFolderId;
  };

  entries.forEach((entry) => {
    resolveEffectiveFolderId(entry, new Set());
  });

  return effectiveFolderBySessionId;
}

export const UNASSIGNED_WORKSPACE_ID = "__global_unassigned__";

export function normalizeEngineType(engine: string): EngineType {
  if (engine === "claude" || engine === "gemini" || engine === "opencode") {
    return engine;
  }
  return "codex";
}

export function formatUpdatedAtDisplay(updatedAt: number, locale: string) {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    return "--";
  }
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return new Intl.DateTimeFormat(locale || undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function resolveAttributionReasonLabel(
  entry: WorkspaceSessionCatalogEntry,
  t: TFunction,
) {
  if (entry.attributionReason === "shared-worktree-family") {
    return t("settings.sessionManagementAttributionReasonWorktreeFamily");
  }
  if (entry.attributionReason === "shared-git-root") {
    return t("settings.sessionManagementAttributionReasonGitRoot");
  }
  if (entry.attributionReason === "parent-scope") {
    return t("settings.sessionManagementAttributionReasonParentScope");
  }
  return null;
}

export function resolveAttributionConfidenceLabel(
  entry: WorkspaceSessionCatalogEntry,
  t: TFunction,
) {
  if (entry.attributionConfidence === "high") {
    return t("settings.sessionManagementAttributionConfidenceHigh");
  }
  if (entry.attributionConfidence === "medium") {
    return t("settings.sessionManagementAttributionConfidenceMedium");
  }
  return null;
}
