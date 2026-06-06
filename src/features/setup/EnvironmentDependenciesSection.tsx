import type { CSSProperties } from "react";
import type {
  EnvironmentDependencyStatus,
  EnvironmentInstallPlan,
  EnvironmentInstallStep,
} from "@/types";
import {
  type EnvironmentStepStatus,
  useEnvironmentInstaller,
} from "./hooks/useEnvironmentInstaller";

type EnvironmentDependenciesSectionProps = {
  // Mirrors the other settings sub-tabs: only the active panel is rendered, but the hook still owns
  // its own lifecycle so re-activating shows the latest detected state.
  active: boolean;
};

// On-demand Environment panel. Reuses the doctor/installer state machine via useEnvironmentInstaller
// so a missing dependency can be installed from settings without blocking app startup.
export function EnvironmentDependenciesSection({
  active,
}: EnvironmentDependenciesSectionProps) {
  const installer = useEnvironmentInstaller();

  if (!active) {
    return null;
  }

  const {
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
  } = installer;

  const busy = phase === "checking" || phase === "planning" || phase === "running";
  const hasSteps = (plan?.steps.length ?? 0) > 0;

  return (
    <section className="settings-section" aria-label="环境依赖">
      <div className="settings-section-title">环境依赖</div>
      <div className="settings-section-subtitle">
        查看本机依赖状态，并按需安装。缺少依赖不会阻止应用启动；Homebrew 安装需在终端输入管理员密码。
      </div>

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
        <button
          type="button"
          style={busy ? { ...secondaryButton, ...buttonDisabled } : secondaryButton}
          onClick={refresh}
          disabled={busy}
        >
          {phase === "checking" || phase === "planning" ? "检查中" : "检查依赖"}
        </button>
        <button
          type="button"
          style={
            busy || !hasSteps || plan?.canRun === false
              ? { ...button, ...buttonDisabled }
              : button
          }
          onClick={runInstall}
          disabled={busy || !hasSteps || plan?.canRun === false}
        >
          {phase === "running" ? "安装中" : "安装全部"}
        </button>
      </div>
    </section>
  );
}

function DependencyList({
  dependencies,
}: {
  dependencies: EnvironmentDependencyStatus[];
}) {
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
            {dependency.installed ? "已安装" : "未安装"}
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
  stepStatuses: Record<string, EnvironmentStepStatus>;
  failedStepId: string | null;
  retryingStepId: string | null;
  disabled: boolean;
  onRetryStep: (stepId: string) => void;
}) {
  if (!plan || plan.steps.length === 0) {
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
  status: EnvironmentStepStatus;
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
        <small style={ttyHint}>
          已在终端启动，输入管理员密码后点“检查依赖”刷新；若失败可点“重试此步”。
        </small>
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

function stepStatusLabel(status: EnvironmentStepStatus): string {
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

function stepBadgeStyle(status: EnvironmentStepStatus): CSSProperties {
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

const list: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 12,
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid var(--border-subtle, rgba(127,127,127,0.18))",
};

const okText: CSSProperties = { color: "#3fae54" };
const pendingText: CSSProperties = { color: "#c7901f" };
const runningText: CSSProperties = { color: "#3a78d6" };
const failedText: CSSProperties = { color: "#cf4040" };

const planBox: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 12,
  marginTop: 12,
  border: "1px solid var(--border-subtle, rgba(127,127,127,0.18))",
  borderRadius: 8,
  background: "var(--surface-muted, rgba(127,127,127,0.06))",
};

const planTitle: CSSProperties = { fontWeight: 700 };
const mirrorLine: CSSProperties = { opacity: 0.75, fontSize: 13 };

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

const ttyHint: CSSProperties = { color: "#c7901f" };
const optionalTag: CSSProperties = { marginLeft: 6, opacity: 0.7 };

const logBox: CSSProperties = {
  maxHeight: 160,
  overflow: "auto",
  padding: 12,
  marginTop: 12,
  borderRadius: 8,
  background: "var(--surface-inset, rgba(0,0,0,0.06))",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
};

const errorBox: CSSProperties = {
  padding: 10,
  marginTop: 12,
  borderRadius: 8,
  color: "#cf4040",
  background: "rgba(207, 64, 64, 0.12)",
};

const mutedLine: CSSProperties = { opacity: 0.7, marginTop: 12 };

const actions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 16,
};

const button: CSSProperties = {
  minWidth: 112,
  padding: "10px 16px",
  border: "none",
  borderRadius: 8,
  background: "var(--accent, #3a78d6)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const buttonDisabled: CSSProperties = { opacity: 0.55, cursor: "default" };

const secondaryButton: CSSProperties = {
  minWidth: 112,
  padding: "10px 16px",
  borderRadius: 8,
  background: "transparent",
  border: "1px solid var(--border-subtle, rgba(127,127,127,0.3))",
  fontWeight: 600,
  cursor: "pointer",
};

const retryButton: CSSProperties = {
  alignSelf: "flex-start",
  marginTop: 4,
  padding: "6px 12px",
  border: "1px solid var(--border-subtle, rgba(127,127,127,0.3))",
  borderRadius: 6,
  background: "transparent",
  fontWeight: 600,
  cursor: "pointer",
};
