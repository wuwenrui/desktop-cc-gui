import type {
  SpecChangeStatus,
  SpecChangeSummary,
  SpecProvider,
  SpecWorkspaceSnapshot,
} from "../../../lib/spec-core/types";
import type {
  OrchestrationProviderDegradedState,
  OrchestrationProviderId,
  OrchestrationProviderSnapshot,
  OrchestrationRiskMarker,
  OrchestrationSourceRef,
  OrchestrationTaskStatus,
} from "../types";
import { createOrchestrationTask } from "../utils/taskStore";

function specProviderId(provider: SpecProvider): OrchestrationProviderId {
  if (provider === "openspec") {
    return "spec:openspec";
  }
  if (provider === "speckit") {
    return "spec:speckit";
  }
  return "spec:unknown";
}

function specChangeStatusToTaskStatus(status: SpecChangeStatus): OrchestrationTaskStatus {
  if (status === "ready") {
    return "ready";
  }
  if (status === "implementing") {
    return "running";
  }
  if (status === "verified") {
    return "review_needed";
  }
  if (status === "archived") {
    return "archived";
  }
  if (status === "blocked") {
    return "blocked";
  }
  return "candidate";
}

function specChangeArtifactPaths(change: SpecChangeSummary): string[] {
  return [
    change.artifacts.proposalPath,
    change.artifacts.designPath,
    change.artifacts.tasksPath,
    change.artifacts.verificationPath,
    ...change.artifacts.specPaths,
  ].filter((path): path is string => Boolean(path));
}

function createSpecSourceRef(input: {
  providerId: OrchestrationProviderId;
  id: string;
  label: string;
  path?: string | null;
  writeCapable?: boolean;
}): OrchestrationSourceRef {
  return {
    providerId: input.providerId,
    kind: "spec_change",
    id: input.id,
    label: input.label,
    workspaceRelativePath: input.path ?? undefined,
    confidence: "high",
    capabilities: input.writeCapable
      ? ["read_candidates", "open_source", "write_back"]
      : ["read_candidates", "open_source"],
  };
}

function specChangeRisks(change: SpecChangeSummary): OrchestrationRiskMarker[] {
  if (change.blockers.length === 0 && (change.archiveBlockers?.length ?? 0) === 0) {
    return [];
  }
  return [
    {
      kind: "provider_degraded",
      label: [...change.blockers, ...(change.archiveBlockers ?? [])][0] ?? "Spec provider degraded",
    },
  ];
}

function createSpecProviderDegradedStates(
  snapshot: SpecWorkspaceSnapshot,
): OrchestrationProviderDegradedState[] {
  if (snapshot.provider === "unknown") {
    return [
      {
        providerId: specProviderId(snapshot.provider),
        label: "Spec provider unavailable",
        reason: snapshot.blockers[0] ?? "No supported spec provider detected.",
      },
    ];
  }

  if (snapshot.blockers.length === 0 && snapshot.supportLevel !== "minimal") {
    return [];
  }

  return [
    {
      providerId: specProviderId(snapshot.provider),
      label: `${snapshot.provider} provider degraded`,
      reason:
        snapshot.blockers[0] ??
        "Spec provider is running in minimal compatibility mode.",
    },
  ];
}

export function readSpecHubOrchestrationCandidates(input: {
  workspaceId: string;
  snapshot: SpecWorkspaceSnapshot | null | undefined;
  now?: string;
}): OrchestrationProviderSnapshot {
  const snapshot = input.snapshot;
  if (!snapshot) {
    return {
      providerId: "spec:unknown",
      available: false,
      candidates: [],
      degraded: [
        {
          providerId: "spec:unknown",
          label: "Spec provider unavailable",
          reason: "No SpecHub snapshot is available.",
        },
      ],
    };
  }

  const providerId = specProviderId(snapshot.provider);
  const degraded = createSpecProviderDegradedStates(snapshot);
  if (snapshot.provider === "unknown") {
    return {
      providerId,
      available: false,
      candidates: [],
      degraded,
    };
  }

  const writeCapable = snapshot.provider === "openspec" && snapshot.supportLevel === "full";
  const candidates = snapshot.changes.map((change) => {
    const artifactPaths = specChangeArtifactPaths(change);
    const sourceRef = createSpecSourceRef({
      providerId,
      id: change.id,
      label: `${snapshot.provider}: ${change.id}`,
      path: change.artifacts.proposalPath ?? change.artifacts.tasksPath,
      writeCapable,
    });
    const evidenceRefs = artifactPaths.map((path) =>
      createSpecSourceRef({
        providerId,
        id: `${change.id}:${path}`,
        label: path,
        path,
        writeCapable: false,
      }),
    );

    return createOrchestrationTask({
      taskId: `spec-${snapshot.provider}-${change.id}`,
      workspaceId: input.workspaceId,
      title: `Spec change: ${change.id}`,
      status: specChangeStatusToTaskStatus(change.status),
      sourceRefs: [sourceRef],
      evidenceRefs,
      riskMarkers: specChangeRisks(change),
      scopeSummary: `Continue spec workflow for ${change.id}.`,
      acceptanceSummary: `Spec change ${change.id} is verified or explicitly reviewed.`,
      threadStrategy: "new_thread",
      now: input.now ?? new Date(change.updatedAt || Date.now()).toISOString(),
    });
  });

  return {
    providerId,
    available: snapshot.supportLevel !== "none",
    candidates,
    degraded,
  };
}
