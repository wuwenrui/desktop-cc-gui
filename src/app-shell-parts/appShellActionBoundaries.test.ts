import { describe, expect, it } from "vitest";
import {
  APP_SHELL_ACTION_BOUNDARIES,
  classifyAppShellActionName,
  defineAppShellContextActions,
  defineAppShellNavigationActions,
  defineAppShellRuntimeActions,
  defineAppShellTaskRunActions,
  listAppShellActionFamilies,
} from "./appShellActionBoundaries";

describe("appShellActionBoundaries", () => {
  it("defines the four AppShell action families", () => {
    expect(listAppShellActionFamilies()).toEqual([
      "runtime",
      "task-run",
      "navigation",
      "context",
    ]);
  });

  it("keeps runtime and task-run responsibilities separated", () => {
    const runtime = APP_SHELL_ACTION_BOUNDARIES.find((entry) => entry.family === "runtime");
    const taskRun = APP_SHELL_ACTION_BOUNDARIES.find((entry) => entry.family === "task-run");

    expect(runtime?.mustNotOwn).toContain("TaskRun lifecycle semantics");
    expect(taskRun?.mustNotOwn).toContain("thread message send internals");
  });

  it("classifies representative action names without cross-wiring families", () => {
    expect(classifyAppShellActionName("handleToggleRuntimeConsole")).toBe("runtime");
    expect(classifyAppShellActionName("handleRetryTaskRun")).toBe("task-run");
    expect(classifyAppShellActionName("handleOpenSpecHub")).toBe("navigation");
    expect(classifyAppShellActionName("handleInsertMemoryContext")).toBe("context");
    expect(classifyAppShellActionName("")).toBeNull();
  });

  it("keeps boundary factories explicit and behavior-preserving", () => {
    const runtimeToggle = () => "runtime";
    const retryTaskRun = (runId: string) => `retry:${runId}`;
    const openSpecHub = () => "navigation";
    const openFile = (path: string) => `file:${path}`;

    const runtimeActions = defineAppShellRuntimeActions({
      handleToggleRuntimeConsole: runtimeToggle,
      handleToggleTerminalPanel: runtimeToggle,
    });
    const taskRunActions = defineAppShellTaskRunActions({
      handleOpenTaskConversation: retryTaskRun,
      handleRetryTaskRun: retryTaskRun,
      handleResumeTaskRun: retryTaskRun,
      handleCancelTaskRun: retryTaskRun,
      handleForkTaskRun: retryTaskRun,
      handleCloseTaskConversation: retryTaskRun,
      handleKanbanCreateTask: retryTaskRun,
      handleDispatchOrchestrationTask: retryTaskRun,
      handleDragToInProgress: retryTaskRun,
    });
    const navigationActions = defineAppShellNavigationActions({
      handleSelectWorkspaceInstance: openSpecHub,
      handleStartWorkspaceConversation: openSpecHub,
      handleStartSharedConversation: openSpecHub,
      handleContinueLatestConversation: openSpecHub,
      handleStartGuidedConversation: openSpecHub,
      handleRevealActiveWorkspace: openSpecHub,
      handleOpenSpecHub: openSpecHub,
      handleOpenClientDocumentation: openSpecHub,
      handleOpenWorkspaceHome: openSpecHub,
      handleOpenHomeChat: openSpecHub,
      handleSelectHomeWorkspace: openSpecHub,
      handleSelectWorkspacePathForGitHistory: openSpecHub,
    });
    const contextActions = defineAppShellContextActions({
      handleOpenWorkspaceFile: openFile,
      handleActivateWorkspaceFileTab: openFile,
      handleCloseWorkspaceFileTab: openFile,
      handleCloseAllWorkspaceFileTabs: openFile,
      handleExitWorkspaceEditor: openFile,
      handleSelectDiffForPanel: openFile,
      handleRewindFromMessage: openFile,
      handleDeleteWorkspaceConversations: openFile,
      handleDeleteWorkspaceConversationsInSettings: openFile,
    });

    expect(runtimeActions.handleToggleRuntimeConsole()).toBe("runtime");
    expect(taskRunActions.handleRetryTaskRun("run-1")).toBe("retry:run-1");
    expect(navigationActions.handleOpenSpecHub()).toBe("navigation");
    expect(contextActions.handleOpenWorkspaceFile("src/app-shell.tsx")).toBe(
      "file:src/app-shell.tsx",
    );
  });
});
