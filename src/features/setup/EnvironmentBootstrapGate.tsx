import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  EnvironmentDependencyStatus,
  EnvironmentInstallPlan,
  EnvironmentInstallProgressEvent,
  EnvironmentInstallStep,
} from "@/types";
import {
  getEnvironmentDoctor,
  getEnvironmentInstallPlan,
  retryEnvironmentInstallerStep,
  runEnvironmentInstaller,
} from "@/services/tauri";
import { subscribeEnvironmentInstallerEvents } from "@/services/events";

type Phase = "checking" | "ready" | "planning" | "missing" | "running" | "failed";

// Per-step lifecycle derived from the streamed progress events.
type StepStatus = "pending" | "running" | "done" | "failed";

const RUN_ID = "environment-bootstrap";

export function EnvironmentBootstrapGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [dependencies, setDependencies] = useState<EnvironmentDependencyStatus[]>([]);
  const [plan, setPlan] = useState<EnvironmentInstallPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  // stepId -> latest status, updated from streamed events. failedStepId isolates the broken step
  // so the UI can offer "retry this step" without re-running the whole plan.
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [failedStepId, setFailedStepId] = useState<string | null>(null);
  const [retryingStepId, setRetryingStepId] = useState<string | null>(null);

  const allRequiredReady = useMemo(
    () =>
      dependencies.length > 0 &&
      dependencies
        .filter((dependency) => dependency.required)
        .every((dependency) => dependency.installed),
    [dependencies],
  );

  const refresh = useCallback(async () => {
    setPhase("checking");
    setError(null);
    setFailedStepId(null);
    setStepStatuses({});
    try {
      const doctor = await getEnvironmentDoctor();
      setDependencies(doctor.dependencies);
      const ready = doctor.dependencies
        .filter((dependency) => dependency.required)
        .every((dependency) => dependency.installed);
      if (ready) {
        setPhase("ready");
        return;
      }

      setPhase("planning");
      const nextPlan = await getEnvironmentInstallPlan();
      setPlan(nextPlan);
      setPhase("missing");
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
          nextStatus === "failed"
            ? stepId
            : current === stepId
              ? null
              : current,
        );
      }
    });
  }, []);

  const finishInstall = useCallback(
    async (result: Awaited<ReturnType<typeof runEnvironmentInstaller>>) => {
      setDependencies(result.doctorResult.dependencies);
      if (result.ok) {
        setPhase("ready");
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

  if (phase === "ready" || allRequiredReady) {
    return <>{children}</>;
  }

  return (
    <div style={overlay}>
      <section style={card} aria-label="环境安装">
        <div style={brand}>律师助理</div>
        <h2 style={title}>准备运行环境</h2>
        <p style={subtitle}>自动检查依赖；缺 Homebrew 时先用 TUNA 国内源安装 Homebrew。</p>

        <DependencyList dependencies={dependencies} />
        <InstallPlan
          plan={plan}
          stepStatuses={stepStatuses}
          failedStepId={failedStepId}
          retryingStepId={retryingStepId}
          disabled={phase === "running"}
          onRetryStep={retryStep}
        />

        {logLines.length > 0 && (
          <div style={logBox} aria-label="安装日志">
            {logLines.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        )}

        {error && (
          <div style={errorBox} role="alert">
            {error}
          </div>
        )}

        <div style={actions}>
          {phase === "checking" || phase === "planning" ? (
            <button style={{ ...button, ...buttonDisabled }} disabled>
              正在检查
            </button>
          ) : phase === "running" ? (
            <button style={{ ...button, ...buttonDisabled }} disabled>
              安装中
            </button>
          ) : phase === "failed" ? (
            <>
              <button style={secondaryButton} onClick={refresh}>
                重新检测
              </button>
              <button style={button} onClick={runInstall} disabled={plan?.canRun === false}>
                全部重试
              </button>
            </>
          ) : (
            <button style={button} onClick={runInstall} disabled={plan?.canRun === false}>
              开始安装
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function DependencyList({ dependencies }: { dependencies: EnvironmentDependencyStatus[] }) {
  if (dependencies.length === 0) {
    return <div style={mutedLine}>正在读取依赖状态…</div>;
  }

  return (
    <div style={list}>
      {dependencies.map((dependency) => (
        <div key={dependency.id} style={row}>
          <span>
            {dependency.label}
            {!dependency.required && <small style={optionalTag}>（可选）</small>}
          </span>
          <strong style={dependency.installed ? okText : pendingText}>
            {dependency.installed ? "已安装" : "待安装"}
          </strong>
        </div>
      ))}
    </div>
  );
}

function InstallPlan({
  plan,
  stepStatuses,
  failedStepId,
  retryingStepId,
  disabled,
  onRetryStep,
}: {
  plan: EnvironmentInstallPlan | null;
  stepStatuses: Record<string, StepStatus>;
  failedStepId: string | null;
  retryingStepId: string | null;
  disabled: boolean;
  onRetryStep: (stepId: string) => void;
}) {
  if (!plan) {
    return null;
  }

  return (
    <div style={planBox}>
      <div style={planTitle}>安装计划</div>
      <div style={mirrorLine}>Homebrew 默认使用 TUNA 国内源</div>
      {plan.steps.map((step, index) => (
        <PlanStepRow
          key={step.id}
          step={step}
          index={index}
          status={stepStatuses[step.id] ?? "pending"}
          isFailed={failedStepId === step.id}
          isRetrying={retryingStepId === step.id}
          disabled={disabled}
          onRetry={onRetryStep}
        />
      ))}
      {plan.blockers.map((blocker) => (
        <div key={blocker} style={errorBox}>
          {blocker}
        </div>
      ))}
    </div>
  );
}

function PlanStepRow({
  step,
  index,
  status,
  isFailed,
  isRetrying,
  disabled,
  onRetry,
}: {
  step: EnvironmentInstallStep;
  index: number;
  status: StepStatus;
  isFailed: boolean;
  isRetrying: boolean;
  disabled: boolean;
  onRetry: (stepId: string) => void;
}) {
  return (
    <div style={stepRow}>
      <div style={stepHeader}>
        <span>
          {index + 1}. {step.label}
        </span>
        <strong style={stepBadgeStyle(status)}>{stepStatusLabel(status)}</strong>
      </div>
      {step.requiresTty && (
        <small style={ttyHint}>在终端输入管理员密码，完成后点“重试此步”刷新状态。</small>
      )}
      {step.warnings.length > 0 && <small>{step.warnings.join("；")}</small>}
      {isFailed && (
        <button
          type="button"
          style={disabled ? { ...retryButton, ...buttonDisabled } : retryButton}
          onClick={() => onRetry(step.id)}
          disabled={disabled}
        >
          {isRetrying ? "重试中" : "重试此步"}
        </button>
      )}
    </div>
  );
}

function stepStatusFromPhase(
  phase: EnvironmentInstallProgressEvent["phase"],
): StepStatus | null {
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

function stepStatusLabel(status: StepStatus): string {
  switch (status) {
    case "running":
      return "进行中";
    case "done":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return "待安装";
  }
}

function stepBadgeStyle(status: StepStatus): CSSProperties {
  switch (status) {
    case "running":
      return runningText;
    case "done":
      return okText;
    case "failed":
      return failedText;
    default:
      return pendingText;
  }
}

function appendLogLine(
  current: string[],
  event: EnvironmentInstallProgressEvent,
): string[] {
  const label = event.stepId ? `[${event.stepId}]` : "[environment]";
  const message = event.message || event.phase;
  return [...current, `${label} ${message}`].slice(-80);
}

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "#0b0b0d",
  color: "#f5f5f5",
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: 28,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  background: "#141416",
  boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
};

const brand: CSSProperties = {
  fontSize: 13,
  color: "#a6adbb",
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 24,
};

const subtitle: CSSProperties = {
  margin: 0,
  color: "#c4cad4",
  lineHeight: 1.5,
};

const list: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const okText: CSSProperties = {
  color: "#78d38b",
};

const pendingText: CSSProperties = {
  color: "#f2c46d",
};

const runningText: CSSProperties = {
  color: "#7fb6ff",
};

const failedText: CSSProperties = {
  color: "#ff9a9a",
};

const planBox: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
};

const planTitle: CSSProperties = {
  fontWeight: 700,
};

const mirrorLine: CSSProperties = {
  color: "#c4cad4",
  fontSize: 13,
};

const stepRow: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const stepHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const ttyHint: CSSProperties = {
  color: "#f2c46d",
};

const optionalTag: CSSProperties = {
  marginLeft: 6,
  color: "#a6adbb",
};

const logBox: CSSProperties = {
  maxHeight: 160,
  overflow: "auto",
  padding: 12,
  borderRadius: 8,
  background: "#08080a",
  color: "#c8d0dd",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
};

const errorBox: CSSProperties = {
  padding: 10,
  borderRadius: 8,
  color: "#ffd5d5",
  background: "rgba(185, 54, 54, 0.2)",
};

const mutedLine: CSSProperties = {
  color: "#a6adbb",
};

const actions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const button: CSSProperties = {
  minWidth: 112,
  padding: "10px 16px",
  border: "none",
  borderRadius: 8,
  background: "#f5f5f5",
  color: "#111",
  fontWeight: 700,
  cursor: "pointer",
};

const buttonDisabled: CSSProperties = {
  opacity: 0.65,
  cursor: "default",
};

const secondaryButton: CSSProperties = {
  ...button,
  background: "transparent",
  color: "#f5f5f5",
  border: "1px solid rgba(255,255,255,0.3)",
};

const retryButton: CSSProperties = {
  alignSelf: "flex-start",
  marginTop: 4,
  padding: "6px 12px",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 6,
  background: "transparent",
  color: "#f5f5f5",
  fontWeight: 600,
  cursor: "pointer",
};
