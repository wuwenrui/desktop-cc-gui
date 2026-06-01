import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

type ClaudeCliStatus = { installed: boolean; version?: string };

type Phase =
  | "checking"
  | "missing"
  | "installing"
  | "ready"
  | "needsRestart"
  | "failed";

const MANUAL_UNIX = "curl -fsSL https://claude.ai/install.sh | bash";
const MANUAL_WINDOWS = "irm https://claude.ai/install.ps1 | iex";

/**
 * Gate that self-checks for the Claude CLI before rendering children.
 *
 * - Detected → renders children unchanged.
 * - Missing → offers a one-click official native install, then re-checks.
 *   If still undetected (PATH not refreshed) → prompts to restart.
 */
export function DependencyGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState("");

  const runCheck = useCallback(async () => {
    setPhase("checking");
    setError("");
    try {
      const status = await invoke<ClaudeCliStatus>("check_claude_cli");
      setPhase(status.installed ? "ready" : "missing");
    } catch (e) {
      // A failed check is treated as "missing" so the user can still install.
      setError(String(e));
      setPhase("missing");
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const handleInstall = useCallback(async () => {
    setPhase("installing");
    setError("");
    try {
      await invoke<string>("install_claude_cli");
      const status = await invoke<ClaudeCliStatus>("check_claude_cli");
      setPhase(status.installed ? "ready" : "needsRestart");
    } catch (e) {
      setError(String(e));
      setPhase("failed");
    }
  }, []);

  if (phase === "ready") {
    return <>{children}</>;
  }

  if (phase === "checking") {
    return (
      <div style={overlay}>
        <div style={centeredText}>正在检查运行环境…</div>
      </div>
    );
  }

  const installing = phase === "installing";

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={brand}>律师助理</div>
        <h2 style={titleStyle}>准备运行环境</h2>
        <p style={subtitle}>
          需要安装 Claude 运行时(约 1-2 分钟，从官方 claude.ai 下载，无需其他依赖)
        </p>

        {phase === "needsRestart" && (
          <div style={infoBox}>安装完成，请重启应用以生效。</div>
        )}

        {error && (
          <div style={errorBox} role="alert">
            {error}
          </div>
        )}

        {phase === "failed" && (
          <div style={manualBox}>
            <div style={manualTitle}>手动安装命令</div>
            <div style={manualLabel}>macOS / Linux</div>
            <code style={manualCode}>{MANUAL_UNIX}</code>
            <div style={manualLabel}>Windows</div>
            <code style={manualCode}>{MANUAL_WINDOWS}</code>
          </div>
        )}

        {phase === "missing" || installing ? (
          <button
            style={{ ...button, ...(installing ? buttonDisabled : null) }}
            disabled={installing}
            onClick={handleInstall}
          >
            {installing ? "安装中…请稍候" : "一键自动安装"}
          </button>
        ) : (
          <button style={button} onClick={runCheck}>
            重新检测
          </button>
        )}
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0b0b0d",
  zIndex: 9999,
  padding: 24,
};

const centeredText: CSSProperties = {
  fontSize: 14,
  color: "#9aa0a6",
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 32,
  background: "#161618",
  border: "1px solid #2a2a2e",
  borderRadius: 14,
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
};

const brand: CSSProperties = {
  fontSize: 12,
  letterSpacing: 1,
  color: "#6b7280",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 600,
  color: "#f5f5f7",
};

const subtitle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: "#9aa0a6",
};

const infoBox: CSSProperties = {
  fontSize: 13,
  color: "#9ab4ff",
  background: "#1a1f33",
  border: "1px solid #283356",
  padding: "8px 12px",
  borderRadius: 8,
};

const errorBox: CSSProperties = {
  fontSize: 12,
  color: "#fca5a5",
  background: "#2a1517",
  border: "1px solid #4c2326",
  padding: "8px 12px",
  borderRadius: 8,
  wordBreak: "break-word",
};

const manualBox: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
  color: "#9aa0a6",
};

const manualTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#d1d5db",
};

const manualLabel: CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
};

const manualCode: CSSProperties = {
  display: "block",
  padding: "8px 10px",
  background: "#0e0e10",
  border: "1px solid #34343a",
  borderRadius: 6,
  color: "#e5e7eb",
  fontFamily: "monospace",
  fontSize: 12,
  wordBreak: "break-all",
};

const button: CSSProperties = {
  marginTop: 4,
  padding: "11px 16px",
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const buttonDisabled: CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};
