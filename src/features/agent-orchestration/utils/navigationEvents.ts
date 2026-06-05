export const OPEN_ORCHESTRATION_TASK_EVENT = "ccgui:open-orchestration-task";
export const OPEN_TASK_RUN_EVENT = "ccgui:open-task-run";

export function dispatchOpenOrchestrationTaskEvent(taskId: string): void {
  if (typeof window === "undefined" || !taskId.trim()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(OPEN_ORCHESTRATION_TASK_EVENT, {
      detail: { taskId },
    }),
  );
}

export function readOpenOrchestrationTaskEvent(event: Event): string | null {
  const detail = (event as CustomEvent<{ taskId?: unknown }>).detail;
  const taskId = typeof detail?.taskId === "string" ? detail.taskId.trim() : "";
  return taskId || null;
}

export function dispatchOpenTaskRunEvent(runId: string): void {
  if (typeof window === "undefined" || !runId.trim()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(OPEN_TASK_RUN_EVENT, {
      detail: { runId },
    }),
  );
}

export function readOpenTaskRunEvent(event: Event): string | null {
  const detail = (event as CustomEvent<{ runId?: unknown }>).detail;
  const runId = typeof detail?.runId === "string" ? detail.runId.trim() : "";
  return runId || null;
}
