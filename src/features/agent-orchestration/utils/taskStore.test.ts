import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/clientStorage", () => ({
  getClientStoreSync: vi.fn(),
  resetClientStorageForTests: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));

import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";
import {
  ORCHESTRATION_TASK_STORE_KEY,
  archiveOrchestrationTask,
  createOrchestrationTask,
  listOrchestrationTasksForWorkspace,
  loadOrchestrationTaskStore,
  normalizeOrchestrationTaskStore,
  patchOrchestrationTask,
  saveOrchestrationTaskStore,
  upsertOrchestrationTask,
} from "./taskStore";

const NOW = "2026-06-03T00:00:00.000Z";

describe("orchestration task store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates, updates, lists, archives, and persists workspace-scoped tasks", () => {
    const task = createOrchestrationTask({
      taskId: "task-1",
      workspaceId: "workspace-a",
      title: "Build feature",
      scopeSummary: "Implement focused slice.",
      acceptanceSummary: "Focused tests pass.",
      now: NOW,
    });
    const store = upsertOrchestrationTask({ version: 1, tasks: [] }, task);
    const patched = patchOrchestrationTask(store, "task-1", {
      status: "ready",
      now: "2026-06-03T00:01:00.000Z",
    });
    const archived = archiveOrchestrationTask(patched, "task-1", "2026-06-03T00:02:00.000Z");

    expect(listOrchestrationTasksForWorkspace(patched, "workspace-a")).toHaveLength(1);
    expect(listOrchestrationTasksForWorkspace(archived, "workspace-a")).toHaveLength(0);
    expect(listOrchestrationTasksForWorkspace(archived, "workspace-a", { includeArchived: true })[0]).toMatchObject({
      status: "archived",
      archivedAt: "2026-06-03T00:02:00.000Z",
    });

    saveOrchestrationTaskStore(archived);
    expect(writeClientStoreValue).toHaveBeenCalledWith(
      "app",
      ORCHESTRATION_TASK_STORE_KEY,
      archived,
      { immediate: true },
    );
  });

  it("restores only current workspace tasks and degrades corrupt fields safely", () => {
    vi.mocked(getClientStoreSync).mockReturnValue({
      version: 1,
      tasks: [
        {
          taskId: "task-a",
          workspaceId: "workspace-a",
          title: "A",
          status: "not-real",
          scopeSummary: "Scope",
          acceptanceSummary: "Acceptance",
          sourceRefs: [{ providerId: "project-map", kind: "project_map_node", id: "node", label: "Node" }, {}],
          riskMarkers: [{ kind: "missing_evidence", label: "Missing evidence" }, { kind: "bad", label: "Bad" }],
          updatedAt: "2026-06-03T00:03:00.000Z",
        },
        {
          taskId: "task-b",
          workspaceId: "workspace-b",
          title: "B",
          scopeSummary: "Scope",
          acceptanceSummary: "Acceptance",
          updatedAt: "2026-06-03T00:02:00.000Z",
        },
        { taskId: "", workspaceId: "workspace-a" },
      ],
    });

    const loaded = loadOrchestrationTaskStore();

    expect(loaded.tasks).toHaveLength(2);
    expect(loaded.tasks.find((task) => task.taskId === "task-a")).toMatchObject({
      status: "candidate",
      sourceRefs: [expect.objectContaining({ providerId: "project-map", id: "node" })],
      riskMarkers: [expect.objectContaining({ kind: "missing_evidence" })],
    });
    expect(listOrchestrationTasksForWorkspace(loaded, "workspace-a").map((task) => task.taskId)).toEqual(["task-a"]);
  });

  it("deduplicates task ids by newest updatedAt", () => {
    const normalized = normalizeOrchestrationTaskStore({
      tasks: [
        {
          taskId: "task-1",
          workspaceId: "workspace-a",
          title: "Old",
          scopeSummary: "Scope",
          acceptanceSummary: "Acceptance",
          updatedAt: "2026-06-03T00:00:00.000Z",
        },
        {
          taskId: "task-1",
          workspaceId: "workspace-a",
          title: "New",
          scopeSummary: "Scope",
          acceptanceSummary: "Acceptance",
          updatedAt: "2026-06-03T00:01:00.000Z",
        },
      ],
    });

    expect(normalized.tasks).toHaveLength(1);
    expect(normalized.tasks[0]?.title).toBe("New");
  });
});
