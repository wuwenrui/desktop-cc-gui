import type { OrchestrationProviderSnapshot } from "../types";
import { createOrchestrationSourceRef } from "../utils/sourceRefs";
import { createOrchestrationTask } from "../utils/taskStore";

export type RepositoryWorkflowSignalKind =
  | "package_script"
  | "ci_workflow"
  | "agent_rule";

export type RepositoryWorkflowSignal = {
  kind: RepositoryWorkflowSignalKind;
  id: string;
  label: string;
  path?: string | null;
  summary?: string | null;
};

function signalScope(signal: RepositoryWorkflowSignal): string {
  if (signal.summary?.trim()) {
    return signal.summary.trim();
  }
  if (signal.kind === "package_script") {
    return `Review package script signal ${signal.label}.`;
  }
  if (signal.kind === "ci_workflow") {
    return `Review CI workflow signal ${signal.label}.`;
  }
  return `Review agent rule signal ${signal.label}.`;
}

export function readRepositorySignalOrchestrationCandidates(input: {
  workspaceId: string;
  signals: RepositoryWorkflowSignal[] | null | undefined;
  now?: string;
}): OrchestrationProviderSnapshot {
  if (!input.signals || input.signals.length === 0) {
    return {
      providerId: "repo:generic",
      available: false,
      candidates: [],
      degraded: [],
    };
  }

  return {
    providerId: "repo:generic",
    available: true,
    degraded: [],
    candidates: input.signals.map((signal) => {
      const sourceRef = createOrchestrationSourceRef({
        providerId: "repo:generic",
        kind: "repository_signal",
        id: signal.id,
        label: signal.label,
        path: signal.path,
        confidence: "medium",
        capabilities: ["read_candidates", "open_source"],
        metadata: {
          signalKind: signal.kind,
        },
      });
      return createOrchestrationTask({
        taskId: `repo-signal-${signal.kind}-${signal.id}`,
        workspaceId: input.workspaceId,
        title: `Repository signal: ${signal.label}`,
        status: "candidate",
        sourceRefs: [sourceRef],
        evidenceRefs: signal.path ? [sourceRef] : [],
        riskMarkers: [
          {
            kind: "candidate_source",
            label: "Repository signal is advisory only",
            sourceRefId: sourceRef.id,
          },
        ],
        scopeSummary: signalScope(signal),
        acceptanceSummary: "Signal has been reviewed and either linked to a task or dismissed.",
        threadStrategy: "new_thread",
        now: input.now,
      });
    }),
  };
}
