// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKanbanStore } from "./useKanbanStore";
import type { KanbanTask } from "../types";

const kanbanStorageMocks = vi.hoisted(() => ({
  loadKanbanData: vi.fn(() => ({ panels: [], tasks: [] })),
  migrateWorkspaceIds: vi.fn((data) => ({ data, migrated: false })),
  saveKanbanData: vi.fn(),
}));

vi.mock("../utils/kanbanStorage", () => kanbanStorageMocks);

describe("useKanbanStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
    kanbanStorageMocks.loadKanbanData.mockClear();
    kanbanStorageMocks.loadKanbanData.mockReturnValue({ panels: [], tasks: [] });
    kanbanStorageMocks.migrateWorkspaceIds.mockClear();
    kanbanStorageMocks.migrateWorkspaceIds.mockImplementation((data) => ({
      data,
      migrated: false,
    }));
    kanbanStorageMocks.saveKanbanData.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not rewrite persisted kanban data on initial mount", () => {
    vi.useFakeTimers();

    renderHook(() => useKanbanStore());

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(kanbanStorageMocks.saveKanbanData).not.toHaveBeenCalled();
  });

  it("keeps auto-start tasks in todo before launch is completed", () => {
    const { result } = renderHook(() => useKanbanStore());

    let createdTask!: KanbanTask;
    act(() => {
      createdTask = result.current.createTask({
        workspaceId: "ws-1",
        panelId: "panel-1",
        title: "Auto start task",
        description: "desc",
        engineType: "claude",
        modelId: null,
        branchName: "main",
        images: [],
        autoStart: true,
      });
    });

    expect(createdTask.status).toBe("todo");
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0]?.status).toBe("todo");
    expect(result.current.tasks[0]?.execution?.lastSource).toBe("autoStart");
  });

  it("debounces kanban persistence after state changes", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useKanbanStore());

    act(() => {
      result.current.createTask({
        workspaceId: "ws-1",
        panelId: "panel-1",
        title: "Persisted task",
        description: "desc",
        engineType: "claude",
        modelId: null,
        branchName: "main",
        images: [],
        autoStart: false,
      });
    });

    expect(kanbanStorageMocks.saveKanbanData).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(kanbanStorageMocks.saveKanbanData).toHaveBeenCalledWith({
      panels: [],
      tasks: [
        expect.objectContaining({
          title: "Persisted task",
        }),
      ],
    });
  });
});
