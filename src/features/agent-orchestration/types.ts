import type { EngineType } from "../../types";
import type { TaskRunStatus } from "../tasks/types";

export type OrchestrationTaskStatus =
  | "candidate"
  | "planned"
  | "ready"
  | "running"
  | "waiting_input"
  | "blocked"
  | "review_needed"
  | "completed"
  | "archived";

export type OrchestrationReviewState =
  | "not_started"
  | "needs_review"
  | "accepted"
  | "changes_requested";

export type OrchestrationThreadStrategy =
  | "new_thread"
  | "reuse_active_thread"
  | "choose_thread";

export type OrchestrationSourceKind =
  | "manual"
  | "project_map_node"
  | "task_run"
  | "session"
  | "spec_change"
  | "workflow_task"
  | "repository_signal"
  | "file"
  | "spec"
  | "task"
  | "document"
  | "commit"
  | "test"
  | "conversation"
  | string;

export type OrchestrationProviderId =
  | "core:manual"
  | "core:task-run"
  | "project-map"
  | "spec:openspec"
  | "spec:speckit"
  | "workflow:trellis"
  | "repo:generic"
  | string;

export type OrchestrationProviderCapability =
  | "read_candidates"
  | "open_source"
  | "create_task"
  | "dispatch"
  | "write_back";

export type OrchestrationRiskMarkerKind =
  | "provider_degraded"
  | "stale_source"
  | "low_confidence"
  | "unknown_confidence"
  | "candidate_source"
  | "missing_evidence"
  | "missing_linked_session"
  | "relationship_context_risk";

export type OrchestrationRiskMarker = {
  kind: OrchestrationRiskMarkerKind;
  label: string;
  sourceRefId?: string;
};

export type OrchestrationSourceRef = {
  providerId: OrchestrationProviderId;
  kind: OrchestrationSourceKind;
  id: string;
  label: string;
  path?: string;
  workspaceRelativePath?: string;
  confidence?: "high" | "medium" | "low" | "unknown";
  stale?: boolean;
  capabilities: OrchestrationProviderCapability[];
  metadata?: Record<string, string | number | boolean | null>;
};

export type OrchestrationTask = {
  taskId: string;
  workspaceId: string;
  title: string;
  status: OrchestrationTaskStatus;
  sourceRefs: OrchestrationSourceRef[];
  evidenceRefs: OrchestrationSourceRef[];
  riskMarkers: OrchestrationRiskMarker[];
  scopeSummary: string;
  acceptanceSummary: string;
  promptSummary?: string | null;
  preferredEngine?: Extract<EngineType, "claude" | "codex" | "gemini"> | null;
  preferredModel?: string | null;
  threadStrategy: OrchestrationThreadStrategy;
  linkedRunIds: string[];
  linkedSessionIds: string[];
  parentTaskId?: string | null;
  reviewState?: OrchestrationReviewState;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export type OrchestrationTaskStoreData = {
  version: 1;
  tasks: OrchestrationTask[];
};

export type CreateOrchestrationTaskInput = {
  taskId?: string;
  workspaceId: string;
  title: string;
  status?: OrchestrationTaskStatus;
  sourceRefs?: OrchestrationSourceRef[];
  evidenceRefs?: OrchestrationSourceRef[];
  riskMarkers?: OrchestrationRiskMarker[];
  scopeSummary: string;
  acceptanceSummary: string;
  promptSummary?: string | null;
  preferredEngine?: OrchestrationTask["preferredEngine"];
  preferredModel?: OrchestrationTask["preferredModel"];
  threadStrategy?: OrchestrationThreadStrategy;
  linkedRunIds?: string[];
  linkedSessionIds?: string[];
  parentTaskId?: string | null;
  reviewState?: OrchestrationReviewState;
  now?: string;
};

export type OrchestrationTaskPatch = Partial<
  Omit<OrchestrationTask, "taskId" | "workspaceId" | "createdAt">
> & {
  now?: string;
};

export type OrchestrationProviderDegradedState = {
  providerId: OrchestrationProviderId;
  reason: string;
  label: string;
};

export type OrchestrationProviderSnapshot = {
  providerId: OrchestrationProviderId;
  available: boolean;
  candidates: OrchestrationTask[];
  degraded: OrchestrationProviderDegradedState[];
};

export function mapTaskRunStatusToOrchestrationStatus(
  status: TaskRunStatus,
): OrchestrationTaskStatus {
  if (status === "completed") {
    return "review_needed";
  }
  if (status === "failed" || status === "blocked") {
    return "blocked";
  }
  if (status === "waiting_input") {
    return "waiting_input";
  }
  if (status === "canceled") {
    return "planned";
  }
  return "running";
}
