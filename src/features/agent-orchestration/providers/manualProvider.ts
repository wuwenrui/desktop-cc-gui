import type { CreateOrchestrationTaskInput, OrchestrationTask } from "../types";
import { createOrchestrationSourceRef } from "../utils/sourceRefs";
import { createOrchestrationTask } from "../utils/taskStore";

export function createManualOrchestrationTaskDraft(input: {
  workspaceId: string;
  title: string;
  scopeSummary: string;
  acceptanceSummary: string;
  promptSummary?: string | null;
  preferredEngine?: CreateOrchestrationTaskInput["preferredEngine"];
  now?: string;
}): OrchestrationTask {
  const title = input.title.trim();
  const scopeSummary = input.scopeSummary.trim();
  const acceptanceSummary = input.acceptanceSummary.trim();
  if (!title || !scopeSummary || !acceptanceSummary) {
    throw new Error("manual_orchestration_task_requires_title_scope_and_acceptance");
  }
  return createOrchestrationTask({
    workspaceId: input.workspaceId,
    title,
    status: "planned",
    sourceRefs: [
      createOrchestrationSourceRef({
        providerId: "core:manual",
        kind: "manual",
        id: `manual:${title}`,
        label: "Manual task draft",
        capabilities: ["create_task", "dispatch"],
      }),
    ],
    evidenceRefs: [],
    riskMarkers: [],
    scopeSummary,
    acceptanceSummary,
    promptSummary: input.promptSummary ?? null,
    preferredEngine: input.preferredEngine ?? null,
    threadStrategy: "new_thread",
    now: input.now,
  });
}
