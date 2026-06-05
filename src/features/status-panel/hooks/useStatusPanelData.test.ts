// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  collectScopedToolEntries,
  getFallbackParentById,
  useStatusPanelData,
} from "./useStatusPanelData";

function createCollabTool(
  id: string,
  detail: string,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "collabToolCall",
    title: "Collab: spawn_agent",
    detail,
    status: "completed",
    receiverThreadIds: ["agent-7"],
  };
}

function createTodoTool(
  id: string,
  content: string,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "todo",
    title: "Tool: TodoWrite",
    detail: JSON.stringify({
      todos: [{ content, status: "in_progress" }],
    }),
    status: "completed",
  };
}

function createTaskTool(
  id: string,
  args: Record<string, unknown>,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "task",
    title: "Tool: Task",
    detail: JSON.stringify(args),
    output: "Task output",
    status: "completed",
  };
}

describe("useStatusPanelData helpers", () => {
  it("caches fallback parent derivation by itemsByThread identity", () => {
    const itemsByThread: Record<string, ConversationItem[]> = {
      root: [createCollabTool("spawn-1", "From thread-root -> agent-7")],
      "agent-7": [],
    };

    const first = getFallbackParentById(itemsByThread);
    const second = getFallbackParentById(itemsByThread);

    expect(first).toBe(second);
    expect(first["agent-7"]).toBe("thread-root");
  });

  it("rebuilds fallback parent derivation when itemsByThread identity changes", () => {
    const firstItemsByThread: Record<string, ConversationItem[]> = {
      root: [createCollabTool("spawn-1", "From thread-root -> agent-7")],
    };
    const secondItemsByThread: Record<string, ConversationItem[]> = {
      root: [createCollabTool("spawn-2", "From thread-root -> agent-8")],
    };

    expect(getFallbackParentById(firstItemsByThread)).not.toBe(
      getFallbackParentById(secondItemsByThread),
    );
    expect(getFallbackParentById(secondItemsByThread)["agent-8"]).toBe(
      "thread-root",
    );
  });

  it("collects only active root subtree tool entries", () => {
    const rootTool = createCollabTool("spawn-1", "From root -> agent-7");
    const childTool = createCollabTool("wait-1", "From root -> agent-7");
    const unrelatedTool = createCollabTool("spawn-2", "From other -> agent-x");
    const entries = collectScopedToolEntries([childTool], {
      activeThreadId: "agent-7",
      itemsByThread: {
        root: [rootTool],
        "agent-7": [childTool],
        other: [unrelatedTool],
      },
      threadParentById: {
        "agent-7": "root",
      },
    });

    expect(entries.rootThreadId).toBe("root");
    expect(entries.entries.map((entry) => entry.item.id).sort()).toEqual([
      "spawn-1",
      "wait-1",
    ]);
  });

  it("defers status summary inputs during active typing and converges after idle", () => {
    const firstItems = [createTodoTool("todo-1", "old todo")];
    const nextItems = [createTodoTool("todo-2", "new todo")];
    const { result, rerender } = renderHook(
      ({
        items,
        deferSummary,
      }: {
        items: ConversationItem[];
        deferSummary: boolean;
      }) => useStatusPanelData(items, { deferSummary }),
      {
        initialProps: {
          items: firstItems,
          deferSummary: false,
        },
      },
    );

    expect(result.current.todos.map((todo) => todo.content)).toEqual([
      "old todo",
    ]);

    rerender({
      items: nextItems,
      deferSummary: true,
    });

    expect(result.current.todos.map((todo) => todo.content)).toEqual([
      "old todo",
    ]);

    rerender({
      items: nextItems,
      deferSummary: false,
    });

    expect(result.current.todos.map((todo) => todo.content)).toEqual([
      "new todo",
    ]);
  });

  it("keeps task and collab subagent navigation targets correct after scoped caching", () => {
    const taskTool = createTaskTool("task-tool-1", {
      task_id: "task-123",
      description: "Review task",
    });
    const spawnTool = createCollabTool("spawn-1", "From root -> agent-7");
    const childTool = createCollabTool("wait-1", "From root -> agent-7");

    const { result } = renderHook(() =>
      useStatusPanelData([taskTool], {
        isCodexEngine: true,
        activeThreadId: "agent-7",
        itemsByThread: {
          root: [taskTool, spawnTool],
          "agent-7": [childTool],
        },
        threadParentById: {
          "agent-7": "root",
        },
        threadStatusById: {
          "agent-7": { isProcessing: true },
        },
      }),
    );

    const taskSubagent = result.current.subagents.find(
      (subagent) => subagent.id === "task-tool-1",
    );
    const collabSubagent = result.current.subagents.find(
      (subagent) => subagent.id === "agent-7",
    );

    expect(taskSubagent?.taskOutput).toMatchObject({
      toolUseId: "task-tool-1",
      taskId: "task-123",
      recentOutput: "Task output",
    });
    expect(taskSubagent?.navigationTarget).toBeNull();
    expect(collabSubagent?.status).toBe("running");
    expect(collabSubagent?.taskOutput).toMatchObject({
      threadId: "agent-7",
      toolUseId: "wait-1",
    });
    expect(collabSubagent?.navigationTarget).toEqual({
      kind: "thread",
      threadId: "agent-7",
    });
  });
});
