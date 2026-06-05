// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../services/tauri", () => ({
  getConfigModel: vi.fn().mockResolvedValue(null),
  getEngineModels: vi.fn().mockResolvedValue([]),
  getModelList: vi.fn().mockResolvedValue({ result: { data: [] } }),
}));

import type { TaskRunRecord } from "../../tasks/types";
import type { OrchestrationProviderSnapshot, OrchestrationTask } from "../types";
import { createOrchestrationSourceRef } from "../utils/sourceRefs";
import { createOrchestrationTask } from "../utils/taskStore";
import { OrchestrationCenterView } from "./OrchestrationCenterView";

function makeTask(overrides: Partial<OrchestrationTask> = {}): OrchestrationTask {
  return {
    ...createOrchestrationTask({
      workspaceId: "ws-1",
      title: "Review API node",
      scopeSummary: "Review the Project Map API node.",
      acceptanceSummary: "API task has been reviewed.",
      sourceRefs: [
        createOrchestrationSourceRef({
          providerId: "project-map",
          kind: "project_map_node",
          id: "api-node",
          label: "API node",
          capabilities: ["open_source", "create_task"],
        }),
      ],
      now: "2026-06-03T01:00:00.000Z",
    }),
    ...overrides,
  };
}

function makeRun(overrides: Partial<TaskRunRecord> = {}): TaskRunRecord {
  return {
    runId: "run-1",
    task: {
      taskId: "orchestration-task",
      source: "orchestration",
      workspaceId: "ws-1",
      title: "Review API node",
      orchestrationTaskId: "orchestration-task",
    },
    engine: "codex",
    status: "running",
    trigger: "manual",
    linkedThreadId: "session-1",
    currentStep: "reviewing",
    latestOutputSummary: "Found the Project Map node evidence.",
    artifacts: [],
    availableRecoveryActions: [],
    updatedAt: Date.parse("2026-06-03T03:00:00.000Z"),
    ...overrides,
  };
}

describe("OrchestrationCenterView", () => {
  it("renders loading state", () => {
    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[]}
        providerSnapshots={[]}
        loading
      />,
    );

    expect(screen.getByText("agentOrchestration.loadingTitle")).toBeTruthy();
  });

  it("renders plain workspace empty state without treating missing providers as an error", () => {
    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        workspaceName="Plain workspace"
        persistedTasks={[]}
        providerSnapshots={[]}
      />,
    );

    expect(screen.getByText("agentOrchestration.emptyTitle")).toBeTruthy();
    expect(screen.queryByText("agentOrchestration.degradedTitle")).toBeNull();
  });

  it("shows degraded provider state while keeping healthy tasks visible", () => {
    const snapshots: OrchestrationProviderSnapshot[] = [
      {
        providerId: "project-map",
        available: false,
        candidates: [],
        degraded: [{ providerId: "project-map", label: "Project Map unavailable", reason: "missing dataset" }],
      },
    ];

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[makeTask()]}
        providerSnapshots={snapshots}
      />,
    );

    expect(screen.getByText("agentOrchestration.degradedTitle")).toBeTruthy();
    expect(screen.getAllByText("Review API node").length).toBeGreaterThan(0);
  });

  it("renders populated queue and switches selected task detail", () => {
    const firstTask = makeTask();
    const secondTask = makeTask({
      taskId: "manual-task",
      title: "Manual follow-up",
      scopeSummary: "Write the follow-up acceptance scope.",
      sourceRefs: [
        createOrchestrationSourceRef({
          providerId: "core:manual",
          kind: "manual",
          id: "manual",
          label: "Manual task draft",
          capabilities: ["create_task", "dispatch"],
        }),
      ],
      updatedAt: "2026-06-03T02:00:00.000Z",
    });

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[firstTask, secondTask]}
        providerSnapshots={[]}
      />,
    );

    expect(screen.getAllByText("Manual follow-up").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: /^Review API node\. agentOrchestration\.queue\.taskLabel/ }),
    );
    expect(screen.getByText("API task has been reviewed.")).toBeTruthy();
    expect(screen.getByText("agentOrchestration.noEvidenceRefs")).toBeTruthy();
    expect(screen.getByText("agentOrchestration.detail.noLinkedRuns")).toBeTruthy();
  });

  it("opens supported source refs through the bounded action rail", () => {
    const openSourceRef = vi.fn();
    const task = makeTask();

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[task]}
        providerSnapshots={[]}
        onOpenSourceRef={openSourceRef}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /agentOrchestration\.actions\.openSourceLabel/ }),
    );

    expect(openSourceRef).toHaveBeenCalledWith({
      task,
      sourceRef: expect.objectContaining({
        providerId: "project-map",
        kind: "project_map_node",
        id: "api-node",
      }),
    });
  });

  it("hides standalone run and session navigation from the action rail", () => {
    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[makeTask({ linkedRunIds: ["run-1"], linkedSessionIds: ["session-1"] })]}
        providerSnapshots={[]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /agentOrchestration\.actions\.openRunLabel/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /agentOrchestration\.actions\.openSessionLabel/ }),
    ).toBeNull();
  });

  it("shows linked run management inline and opens linked sessions without leaving the queue", () => {
    const openSession = vi.fn();
    const archiveTask = vi.fn();
    const task = makeTask({
      status: "running",
      linkedRunIds: ["run-1"],
      linkedSessionIds: ["session-1"],
    });

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[task]}
        providerSnapshots={[]}
        onOpenSession={openSession}
        taskRuns={[makeRun()]}
        onArchiveTask={archiveTask}
      />,
    );

    expect(screen.getByText("agentOrchestration.detail.runManagement")).toBeTruthy();
    expect(screen.getByText("Found the Project Map node evidence.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "agentOrchestration.actions.openSession" }));

    expect(openSession).toHaveBeenCalledWith(task, "session-1");
    expect(screen.queryByText("agentOrchestration.actions.archive")).toBeNull();
    expect(archiveTask).not.toHaveBeenCalled();
  });

  it("sends todo tasks to Task Center through the dispatch action", () => {
    const confirmDispatch = vi.fn();
    const task = makeTask({
      status: "ready",
      preferredEngine: "claude",
      threadStrategy: "choose_thread",
      promptSummary: "Review API node with evidence context.",
    });

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        workspaceName="Workspace One"
        persistedTasks={[task]}
        providerSnapshots={[]}
        onConfirmDispatch={confirmDispatch}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /agentOrchestration\.dispatch\.openLabel/ }),
    );
    fireEvent.change(screen.getByLabelText("agentOrchestration.dispatch.model"), {
      target: { value: "claude-sonnet-4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "agentOrchestration.dispatch.confirm" }));

    expect(confirmDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        task,
        workspaceId: "ws-1",
        engine: "claude",
        model: "claude-sonnet-4",
        threadStrategy: "choose_thread",
        promptSummary: "Review API node with evidence context.",
        acceptanceSummary: "API task has been reviewed.",
      }),
    );
  });

  it("hides dispatch when execution is not wired", () => {
    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[makeTask({ status: "planned" })]}
        providerSnapshots={[]}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /agentOrchestration\.dispatch\.openLabel/ }),
    ).toBeNull();
  });

  it("emits review gate actions for completed linked runs", () => {
    const reviewAction = vi.fn();
    const task = makeTask({
      status: "review_needed",
      reviewState: "needs_review",
      linkedRunIds: ["run-1"],
    });

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[task]}
        providerSnapshots={[]}
        taskRuns={[makeRun({ status: "completed" })]}
        onReviewAction={reviewAction}
      />,
    );

    expect(screen.getByText("agentOrchestration.review.title")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "agentOrchestration.review.accept" }));
    fireEvent.click(screen.getByRole("button", { name: "agentOrchestration.review.requestChanges" }));
    fireEvent.click(screen.getByRole("button", { name: "agentOrchestration.review.createFollowUp" }));

    expect(reviewAction).toHaveBeenCalledWith({ task, action: "accept_result" });
    expect(reviewAction).toHaveBeenCalledWith({ task, action: "request_changes" });
    expect(reviewAction).toHaveBeenCalledWith({ task, action: "create_follow_up" });
  });

  it("hides provider write-back placeholders from the simplified queue", () => {
    const task = makeTask({
      sourceRefs: [
        createOrchestrationSourceRef({
          providerId: "spec:openspec",
          kind: "spec_change",
          id: "change-1",
          label: "OpenSpec change",
          capabilities: ["open_source", "write_back"],
        }),
      ],
    });

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[task]}
        providerSnapshots={[]}
      />,
    );

    expect(screen.queryByText("agentOrchestration.actions.writeBack")).toBeNull();
    expect(screen.queryByText("agentOrchestration.actions.writeBackDisabled")).toBeNull();
  });

  it("renders degraded refs, evidence, linked runs, linked sessions, and activity detail", () => {
    const openSession = vi.fn();
    const task = makeTask({
      riskMarkers: [{ kind: "provider_degraded", label: "Provider degraded" }],
      sourceRefs: [
        {
          providerId: "project-map",
          kind: "project_map_node",
          id: "api-node",
          label: "Degraded Project Map node",
          workspaceRelativePath: "src/main/java/ApiController.java",
          confidence: "low",
          stale: true,
          capabilities: ["open_source", "create_task"],
        },
      ],
      evidenceRefs: [
        {
          providerId: "project-map",
          kind: "file",
          id: "evidence-file",
          label: "Evidence file",
          workspaceRelativePath: "README.md",
          confidence: "high",
          capabilities: ["open_source"],
        },
      ],
      linkedRunIds: ["run-1"],
      linkedSessionIds: ["session-1"],
      reviewState: "needs_review",
      threadStrategy: "reuse_active_thread",
      preferredEngine: "codex",
    });

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[task]}
        providerSnapshots={[]}
        taskRuns={[makeRun({ linkedThreadId: "session-1" })]}
        onOpenSession={openSession}
      />,
    );

    expect(screen.getByText("Degraded Project Map node")).toBeTruthy();
    expect(screen.getByText(/confidence: low/)).toBeTruthy();
    expect(screen.getByText("src/main/java/ApiController.java")).toBeTruthy();
    expect(screen.getByText("Evidence file")).toBeTruthy();
    expect(screen.getByText("README.md")).toBeTruthy();
    expect(
      screen
        .getAllByText("Provider degraded")
        .some((element) => element.classList.contains("orchestration-center__risk-chip--provider_degraded")),
    ).toBe(true);
    expect(screen.getAllByText("run-1").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "agentOrchestration.actions.openSession" }));
    expect(openSession).toHaveBeenCalledWith(task, "session-1");
    expect(screen.getByText("agentOrchestration.reviewState.needs_review")).toBeTruthy();
    expect(screen.getByText("agentOrchestration.threadStrategy.reuse_active_thread")).toBeTruthy();
  });

  it("filters queue by simplified work status without mutating tasks", () => {
    const apiTask = makeTask({
      taskId: "api-task",
      status: "planned",
      preferredEngine: "codex",
      riskMarkers: [{ kind: "low_confidence", label: "Low confidence" }],
      updatedAt: "2026-06-03T03:00:00.000Z",
    });
    const manualTask = makeTask({
      taskId: "manual-task",
      title: "Manual follow-up",
      status: "completed",
      preferredEngine: "claude",
      scopeSummary: "Write the follow-up acceptance scope.",
      sourceRefs: [
        createOrchestrationSourceRef({
          providerId: "core:manual",
          kind: "manual",
          id: "manual",
          label: "Manual task draft",
          capabilities: ["create_task", "dispatch"],
        }),
      ],
      updatedAt: "2026-06-03T02:00:00.000Z",
    });
    const specTask = makeTask({
      taskId: "spec-task",
      workspaceId: "ws-2",
      title: "Spec provider task",
      status: "blocked",
      preferredEngine: "gemini",
      scopeSummary: "Inspect the degraded spec candidate.",
      riskMarkers: [{ kind: "provider_degraded", label: "Provider degraded" }],
      sourceRefs: [
        createOrchestrationSourceRef({
          providerId: "spec:openspec",
          kind: "spec_change",
          id: "change-1",
          label: "Spec change",
          capabilities: ["read_candidates", "open_source"],
        }),
      ],
      updatedAt: "2026-06-03T04:00:00.000Z",
    });
    const inputTasks = [apiTask, manualTask, specTask];
    const serializedInput = JSON.stringify(inputTasks);

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={inputTasks}
        providerSnapshots={[]}
      />,
    );

    expect(screen.queryByText("Spec provider task")).toBeNull();

    fireEvent.change(screen.getByLabelText("agentOrchestration.filters.status"), {
      target: { value: "done" },
    });

    expect(
      screen
        .getAllByText("agentOrchestration.queueStatus.done")
        .some((element) => element.classList.contains("orchestration-center__status-chip--done")),
    ).toBe(true);
    expect(screen.queryByText("Review API node")).toBeNull();
    expect(screen.getAllByText("Manual follow-up").length).toBeGreaterThan(0);
    expect(screen.queryByText("Spec provider task")).toBeNull();
    expect(JSON.stringify(inputTasks)).toBe(serializedInput);
  });

  it("hides archived tasks by default and opens them through explicit archived filter", () => {
    const activeTask = makeTask({
      taskId: "active-task",
      title: "Active task",
      status: "planned",
      updatedAt: "2026-06-03T03:00:00.000Z",
    });
    const archivedTask = makeTask({
      taskId: "archived-task",
      title: "Archived task",
      status: "archived",
      updatedAt: "2026-06-03T04:00:00.000Z",
      archivedAt: "2026-06-03T04:00:00.000Z",
    });

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[activeTask, archivedTask]}
        providerSnapshots={[]}
      />,
    );

    expect(screen.queryByText("Archived task")).toBeNull();

    fireEvent.change(screen.getByLabelText("agentOrchestration.filters.status"), {
      target: { value: "archived" },
    });

    expect(screen.getAllByText("Archived task").length).toBeGreaterThan(0);
  });

  it("archives active tasks through the local action callback", () => {
    const archiveTask = vi.fn();
    const task = makeTask({ status: "planned" });

    render(
      <OrchestrationCenterView
        workspaceId="ws-1"
        persistedTasks={[task]}
        providerSnapshots={[]}
        onArchiveTask={archiveTask}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "agentOrchestration.actions.archive" }));

    expect(archiveTask).toHaveBeenCalledWith(task);
  });
});
