import type { TaskRunRecord } from "../../tasks/types";
import {
  mapTaskRunStatusToOrchestrationStatus,
  type OrchestrationRiskMarker,
  type OrchestrationTask,
} from "../types";
import { createOrchestrationSourceRef } from "../utils/sourceRefs";
import { createOrchestrationTask } from "../utils/taskStore";

function riskMarkersForRun(run: TaskRunRecord): OrchestrationRiskMarker[] {
  const risks: OrchestrationRiskMarker[] = [];
  if (!run.linkedThreadId) {
    risks.push({
      kind: "missing_linked_session",
      label: "TaskRun has no linked conversation",
      sourceRefId: run.runId,
    });
  }
  if (run.status === "failed" || run.status === "blocked") {
    risks.push({
      kind: "provider_degraded",
      label: run.failureReason || run.blockedReason || "TaskRun is blocked or failed",
      sourceRefId: run.runId,
    });
  }
  return risks;
}

function isOrchestrationOwnedRun(run: TaskRunRecord): boolean {
  return run.task.source === "orchestration" || Boolean(run.task.orchestrationTaskId);
}

export function buildTaskRunOrchestrationCandidate(input: {
  run: TaskRunRecord;
  now?: string;
}): OrchestrationTask {
  const run = input.run;
  const status = mapTaskRunStatusToOrchestrationStatus(run.status);
  return createOrchestrationTask({
    taskId: `task-run-${run.runId}`,
    workspaceId: run.task.workspaceId,
    title: run.task.title || run.task.taskId,
    status,
    sourceRefs: [
      createOrchestrationSourceRef({
        providerId: "core:task-run",
        kind: "task_run",
        id: run.runId,
        label: run.task.title || run.task.taskId,
        capabilities: ["open_source", "dispatch"],
        metadata: {
          taskId: run.task.taskId,
          taskSource: run.task.source,
          trigger: run.trigger,
          engine: run.engine,
        },
      }),
    ],
    evidenceRefs: run.artifacts.map((artifact, index) =>
      createOrchestrationSourceRef({
        providerId: "core:task-run",
        kind: artifact.kind === "file" ? "file" : "document",
        id: `${run.runId}:artifact:${index}`,
        label: artifact.label,
        path: artifact.ref ?? undefined,
        capabilities: ["open_source"],
        metadata: {
          artifactKind: artifact.kind,
        },
      }),
    ),
    riskMarkers: riskMarkersForRun(run),
    scopeSummary: run.latestOutputSummary || run.currentStep || run.planSnapshot || run.task.title || run.task.taskId,
    acceptanceSummary: "Review the linked run output before accepting the orchestration task.",
    linkedRunIds: [run.runId],
    linkedSessionIds: run.linkedThreadId ? [run.linkedThreadId] : [],
    reviewState: status === "review_needed" ? "needs_review" : "not_started",
    preferredEngine: run.engine,
    threadStrategy: run.linkedThreadId ? "reuse_active_thread" : "new_thread",
    now: input.now,
  });
}

export function readTaskRunOrchestrationCandidates(input: {
  runs: TaskRunRecord[];
  workspaceId?: string | null;
  now?: string;
}): OrchestrationTask[] {
  return input.runs
    .filter((run) => !isOrchestrationOwnedRun(run))
    .filter((run) => !input.workspaceId || run.task.workspaceId === input.workspaceId)
    .map((run) => buildTaskRunOrchestrationCandidate({ run, now: input.now }));
}
