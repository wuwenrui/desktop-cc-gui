import { useCallback, useEffect, useState } from "react";
import type {
  EnvironmentDependencyStatus,
  EnvironmentInstallPlan,
  EnvironmentInstallProgressEvent,
} from "@/types";
import {
  getEnvironmentDoctor,
  getEnvironmentInstallPlan,
  retryEnvironmentInstallerStep,
  runEnvironmentInstaller,
} from "@/services/tauri";
import { subscribeEnvironmentInstallerEvents } from "@/services/events";

// Doctor/plan/run lifecycle phase shared by every consumer of the installer state machine.
export type EnvironmentPhase =
  | "checking"
  | "ready"
  | "planning"
  | "missing"
  | "running"
  | "failed";

// Per-step lifecycle derived from the streamed progress events.
export type EnvironmentStepStatus = "pending" | "running" | "done" | "failed";

// Run id used to correlate streamed progress events with this state machine. Kept stable so the
// per-step retry (which the user may trigger after completing the Terminal sudo prompt) and the
// full run share the same event stream.
const RUN_ID = "environment-bootstrap";

const MAX_LOG_LINES = 80;

export type UseEnvironmentInstaller = {
  phase: EnvironmentPhase;
  dependencies: EnvironmentDependencyStatus[];
  plan: EnvironmentInstallPlan | null;
  error: string | null;
  logLines: string[];
  stepStatuses: Record<string, EnvironmentStepStatus>;
  failedStepId: string | null;
  retryingStepId: string | null;
  refresh: () => Promise<void>;
  runInstall: () => Promise<void>;
  retryStep: (stepId: string) => Promise<void>;
};

// Extracted from the former EnvironmentBootstrapGate so the same doctor/plan/run/retry logic backs
// both the startup check and the on-demand Environment panel. The protocol (commands + event
// stream) is untouched; this only owns React state.
export function useEnvironmentInstaller(): UseEnvironmentInstaller {
  const [phase, setPhase] = useState<EnvironmentPhase>("checking");
  const [dependencies, setDependencies] = useState<EnvironmentDependencyStatus[]>([]);
  const [plan, setPlan] = useState<EnvironmentInstallPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [stepStatuses, setStepStatuses] = useState<
    Record<string, EnvironmentStepStatus>
  >({});
  const [failedStepId, setFailedStepId] = useState<string | null>(null);
  const [retryingStepId, setRetryingStepId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPhase("checking");
    setError(null);
    setFailedStepId(null);
    setStepStatuses({});
    try {
      const doctor = await getEnvironmentDoctor();
      setDependencies(doctor.dependencies);

      setPhase("planning");
      const nextPlan = await getEnvironmentInstallPlan();
      setPlan(nextPlan);
      // No required deps gate startup anymore, so phase is driven purely by whether anything is
      // still installable: outstanding steps -> "missing" (show the plan), otherwise "ready".
      setPhase(nextPlan.steps.length === 0 ? "ready" : "missing");
    } catch (nextError) {
      setError(normalizeError(nextError));
      setPhase("failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeEnvironmentInstallerEvents((event) => {
      if (event.runId !== RUN_ID) {
        return;
      }
      setLogLines((current) => appendLogLine(current, event));
      const nextStatus = stepStatusFromPhase(event.phase);
      if (event.stepId && nextStatus) {
        const stepId = event.stepId;
        setStepStatuses((current) => ({ ...current, [stepId]: nextStatus }));
        setFailedStepId((current) =>
          nextStatus === "failed" ? stepId : current === stepId ? null : current,
        );
      }
    });
  }, []);

  const finishInstall = useCallback(
    async (result: Awaited<ReturnType<typeof runEnvironmentInstaller>>) => {
      setDependencies(result.doctorResult.dependencies);
      if (result.ok) {
        // Refresh the plan so completed steps drop out of the list after a successful run.
        const nextPlan = await getEnvironmentInstallPlan();
        setPlan(nextPlan);
        setPhase(nextPlan.steps.length === 0 ? "ready" : "missing");
        return;
      }
      setError(result.details || "环境安装失败");
      setPhase("failed");
    },
    [],
  );

  const runInstall = useCallback(async () => {
    setPhase("running");
    setError(null);
    setLogLines([]);
    setFailedStepId(null);
    setStepStatuses({});
    try {
      await finishInstall(await runEnvironmentInstaller(RUN_ID));
    } catch (nextError) {
      setError(normalizeError(nextError));
      setPhase("failed");
    }
  }, [finishInstall]);

  const retryStep = useCallback(
    async (stepId: string) => {
      setPhase("running");
      setError(null);
      setRetryingStepId(stepId);
      setFailedStepId(null);
      setStepStatuses((current) => ({ ...current, [stepId]: "running" }));
      try {
        await finishInstall(await retryEnvironmentInstallerStep(stepId, RUN_ID));
      } catch (nextError) {
        setError(normalizeError(nextError));
        setPhase("failed");
      } finally {
        setRetryingStepId(null);
      }
    },
    [finishInstall],
  );

  return {
    phase,
    dependencies,
    plan,
    error,
    logLines,
    stepStatuses,
    failedStepId,
    retryingStepId,
    refresh,
    runInstall,
    retryStep,
  };
}

export function stepStatusFromPhase(
  phase: EnvironmentInstallProgressEvent["phase"],
): EnvironmentStepStatus | null {
  switch (phase) {
    case "started":
      return "running";
    case "finished":
      return "done";
    case "error":
      return "failed";
    default:
      return null;
  }
}

function appendLogLine(
  current: string[],
  event: EnvironmentInstallProgressEvent,
): string[] {
  const label = event.stepId ? `[${event.stepId}]` : "[environment]";
  const message = event.message || event.phase;
  return [...current, `${label} ${message}`].slice(-MAX_LOG_LINES);
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
