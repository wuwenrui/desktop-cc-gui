import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type {
  EnvironmentDependencyStatus,
  EnvironmentInstallPlan,
  EnvironmentInstallProgressEvent,
} from "@/types";
import {
  getEnvironmentDoctor,
  getEnvironmentInstallPlan,
  runEnvironmentInstaller,
} from "@/services/tauri";
import { subscribeEnvironmentInstallerEvents } from "@/services/events";

type Phase = "checking" | "ready" | "planning" | "missing" | "running" | "failed";

const RUN_ID = "environment-bootstrap";

export function EnvironmentBootstrapGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [dependencies, setDependencies] = useState<EnvironmentDependencyStatus[]>([]);
  const [plan, setPlan] = useState<EnvironmentInstallPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);

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
    });
  }, []);

  const runInstall = useCallback(async () => {
    setPhase("running");
    setError(null);
    setLogLines([]);
    try {
      const result = await runEnvironmentInstaller(RUN_ID);
      if (!result.ok) {
        setDependencies(result.doctorResult.dependencies);
        setError(result.details || "环境安装失败");
        setPhase("failed");
        return;
      }

      const doctor = await getEnvironmentDoctor();
      setDependencies(doctor.dependencies);
      const ready = doctor.dependencies
        .filter((dependency) => dependency.required)
        .every((dependency) => dependency.installed);
      if (ready) {
        setPhase("ready");
      } else {
        setError("安装完成后仍有必需依赖未通过检测");
        setPhase("failed");
      }
    } catch (nextError) {
      setError(normalizeError(nextError));
      setPhase("failed");
    }
  }, []);

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
        <InstallPlan plan={plan} />

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
            <button style={button} onClick={refresh}>
              重试
            </button>
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
      {dependencies
        .filter((dependency) => dependency.required)
        .map((dependency) => (
          <div key={dependency.id} style={row}>
            <span>{dependency.label}</span>
            <strong style={dependency.installed ? okText : pendingText}>
              {dependency.installed ? "已安装" : "待安装"}
            </strong>
          </div>
        ))}
    </div>
  );
}

function InstallPlan({ plan }: { plan: EnvironmentInstallPlan | null }) {
  if (!plan) {
    return null;
  }

  return (
    <div style={planBox}>
      <div style={planTitle}>安装计划</div>
      <div style={mirrorLine}>Homebrew 默认使用 TUNA 国内源</div>
      {plan.steps.map((step, index) => (
        <div key={step.id} style={stepRow}>
          <span>{index + 1}. {step.label}</span>
          {step.warnings.length > 0 && <small>{step.warnings.join("；")}</small>}
        </div>
      ))}
      {plan.blockers.map((blocker) => (
        <div key={blocker} style={errorBox}>
          {blocker}
        </div>
      ))}
    </div>
  );
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
