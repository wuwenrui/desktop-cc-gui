import type { ProjectMapDataset, ProjectMapRelationshipAgentReadPlan } from "../../project-map/types";
import type { TaskRunRecord } from "../../tasks/types";
import type { OrchestrationProviderSnapshot, OrchestrationTask } from "../types";
import { readProjectMapOrchestrationCandidates } from "./projectMapProvider";
import { readTaskRunOrchestrationCandidates } from "./taskRunProvider";

function providerSnapshot(input: {
  providerId: OrchestrationProviderSnapshot["providerId"];
  available: boolean;
  candidates: OrchestrationTask[];
  error?: unknown;
}): OrchestrationProviderSnapshot {
  return {
    providerId: input.providerId,
    available: input.available,
    candidates: input.candidates,
    degraded: input.error
      ? [{
          providerId: input.providerId,
          reason: input.error instanceof Error ? input.error.message : String(input.error),
          label: `${input.providerId} provider is degraded`,
        }]
      : [],
  };
}

function safeProvider(
  providerId: OrchestrationProviderSnapshot["providerId"],
  read: () => OrchestrationTask[],
): OrchestrationProviderSnapshot {
  try {
    return providerSnapshot({
      providerId,
      available: true,
      candidates: read(),
    });
  } catch (error) {
    return providerSnapshot({
      providerId,
      available: false,
      candidates: [],
      error,
    });
  }
}

export function collectCoreOrchestrationProviderSnapshots(input: {
  workspaceId: string;
  manualTasks?: OrchestrationTask[];
  projectMapDataset?: ProjectMapDataset | null;
  projectMapRelationshipContextPack?: ProjectMapRelationshipAgentReadPlan | null;
  taskRuns?: TaskRunRecord[];
  now?: string;
  readProjectMapCandidates?: () => OrchestrationTask[];
  readTaskRunCandidates?: () => OrchestrationTask[];
}): OrchestrationProviderSnapshot[] {
  return [
    providerSnapshot({
      providerId: "core:manual",
      available: true,
      candidates: input.manualTasks ?? [],
    }),
    safeProvider("project-map", input.readProjectMapCandidates ?? (() => {
      return readProjectMapOrchestrationCandidates({
        workspaceId: input.workspaceId,
        dataset: input.projectMapDataset,
        relationshipContextPack: input.projectMapRelationshipContextPack,
        now: input.now,
      });
    })),
    safeProvider("core:task-run", input.readTaskRunCandidates ?? (() => {
      return readTaskRunOrchestrationCandidates({
        runs: input.taskRuns ?? [],
        workspaceId: input.workspaceId,
        now: input.now,
      });
    })),
  ];
}

export function flattenAvailableOrchestrationCandidates(
  snapshots: OrchestrationProviderSnapshot[],
): OrchestrationTask[] {
  return snapshots.flatMap((snapshot) => snapshot.candidates);
}
