import type {
  OrchestrationProviderSnapshot,
  OrchestrationRiskMarker,
  OrchestrationTaskStatus,
} from "../types";
import { createOrchestrationSourceRef } from "../utils/sourceRefs";
import { createOrchestrationTask } from "../utils/taskStore";

export type TrellisTaskProviderEntry = {
  taskJsonPath: string;
  taskJson: unknown;
  prdPath?: string | null;
  prdContent?: string | null;
};

function readStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeTrellisStatus(value: unknown): OrchestrationTaskStatus {
  if (value === "completed" || value === "done") {
    return "completed";
  }
  if (value === "blocked") {
    return "blocked";
  }
  if (value === "running" || value === "in_progress" || value === "implementing") {
    return "running";
  }
  if (value === "review" || value === "needs_review") {
    return "review_needed";
  }
  return "planned";
}

function trellisTaskIdFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts.at(-2) || parts.at(-1)?.replace(/\.json$/i, "") || normalized;
}

function prdSummary(content: string | null | undefined): string | null {
  if (!content?.trim()) {
    return null;
  }
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#")) ?? null;
}

function riskMarkersForTrellisTask(entry: TrellisTaskProviderEntry): OrchestrationRiskMarker[] {
  if (entry.prdContent?.trim()) {
    return [];
  }
  return [
    {
      kind: "missing_evidence",
      label: "Trellis PRD is missing or empty",
    },
  ];
}

export function readTrellisOrchestrationCandidates(input: {
  workspaceId: string;
  entries: TrellisTaskProviderEntry[] | null | undefined;
  now?: string;
}): OrchestrationProviderSnapshot {
  if (!input.entries || input.entries.length === 0) {
    return {
      providerId: "workflow:trellis",
      available: false,
      candidates: [],
      degraded: [],
    };
  }

  const degraded = [];
  const candidates = [];

  for (const entry of input.entries) {
    if (!entry.taskJson || typeof entry.taskJson !== "object" || Array.isArray(entry.taskJson)) {
      degraded.push({
        providerId: "workflow:trellis" as const,
        label: "Malformed Trellis task",
        reason: `${entry.taskJsonPath} is not a valid task object.`,
      });
      continue;
    }

    const record = entry.taskJson as Record<string, unknown>;
    const taskId = readStringField(record, ["id", "taskId", "slug"]) ?? trellisTaskIdFromPath(entry.taskJsonPath);
    const title = readStringField(record, ["title", "name", "objective"]) ?? taskId;
    const scope =
      readStringField(record, ["scope", "summary", "description"]) ??
      prdSummary(entry.prdContent) ??
      `Continue Trellis task ${taskId}.`;
    const acceptance =
      readStringField(record, ["acceptance", "acceptanceSummary", "doneCriteria"]) ??
      `Trellis task ${taskId} reaches an accepted state.`;
    const sourceRef = createOrchestrationSourceRef({
      providerId: "workflow:trellis",
      kind: "workflow_task",
      id: taskId,
      label: title,
      path: entry.taskJsonPath,
      capabilities: ["read_candidates", "open_source"],
      metadata: {
        openSpecChangeId: readStringField(record, ["openSpecChangeId", "changeId"]),
      },
    });
    const evidenceRefs = entry.prdPath
      ? [
          createOrchestrationSourceRef({
            providerId: "workflow:trellis",
            kind: "document",
            id: `${taskId}:prd`,
            label: entry.prdPath,
            path: entry.prdPath,
            capabilities: ["read_candidates", "open_source"],
          }),
        ]
      : [];

    candidates.push(
      createOrchestrationTask({
        taskId: `trellis-${taskId}`,
        workspaceId: input.workspaceId,
        title,
        status: normalizeTrellisStatus(record.status),
        sourceRefs: [sourceRef],
        evidenceRefs,
        riskMarkers: riskMarkersForTrellisTask(entry),
        scopeSummary: scope,
        acceptanceSummary: acceptance,
        threadStrategy: "new_thread",
        now: input.now,
      }),
    );
  }

  return {
    providerId: "workflow:trellis",
    available: candidates.length > 0,
    candidates,
    degraded,
  };
}
