import { useState } from "react";
import type { CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";

const NEW_API_HOST = "http://47.239.143.243:3000";

// new-api 预设(运行时注入，不依赖上游预设数组)。
const NEW_API_ENV = {
  ANTHROPIC_BASE_URL: NEW_API_HOST,
  ANTHROPIC_AUTH_TOKEN: "",
  ANTHROPIC_MODEL: "glm-4.7",
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "glm-4.7",
  ANTHROPIC_DEFAULT_SONNET_MODEL: "glm-4.7",
  ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-4.7",
};

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const env = { ...NEW_API_ENV, ANTHROPIC_AUTH_TOKEN: key.trim() };
      await invoke("vendor_add_claude_provider", {
        provider: { id: "new-api", name: "New API", settingsConfig: { env } },
      });
      await invoke("vendor_switch_claude_provider", { id: "new-api" });
      // skill 安装失败不应阻断 provider 配置完成
      // (dev 模式 resource_dir 可能缺 skills；打包后才完整)
      try {
        await invoke("install_bundled_skills");
      } catch (e) {
        console.warn("skill 安装失败(dev 模式可忽略):", e);
      }
      onDone();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={brand}>律师助理</div>
        <h2 style={titleStyle}>首次配置</h2>
        <p style={subtitle}>连接模型服务站点，几秒完成设置即可开始使用。</p>

        <div style={hostBadge}>
          <span style={hostDot} />
          模型站点 {NEW_API_HOST}
        </div>

        <label style={fieldLabel}>
          <span>
            New API Key <span style={reqMark}>*</span>
          </span>
          <input
            style={input}
            aria-label="new-api key"
            type="password"
            value={key}
            placeholder="粘贴你的 API Key"
            onChange={(e) => setKey(e.target.value)}
          />
        </label>

        {err && (
          <div style={errorBox} role="alert">
            {err}
          </div>
        )}

        <button
          style={{ ...button, ...(!key || busy ? buttonDisabled : null) }}
          disabled={!key || busy}
          onClick={submit}
        >
          {busy ? "配置中…" : "完成"}
        </button>
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

const card: CSSProperties = {
  width: "100%",
  maxWidth: 420,
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

const hostBadge: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: "#9ab4ff",
  background: "#1a1f33",
  border: "1px solid #283356",
  padding: "8px 12px",
  borderRadius: 8,
};

const hostDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#4ade80",
  flexShrink: 0,
};

const fieldLabel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  color: "#d1d5db",
};

const input: CSSProperties = {
  padding: "10px 12px",
  background: "#0e0e10",
  border: "1px solid #34343a",
  borderRadius: 8,
  color: "#f5f5f7",
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const reqMark: CSSProperties = { color: "#f87171" };

const errorBox: CSSProperties = {
  fontSize: 12,
  color: "#fca5a5",
  background: "#2a1517",
  border: "1px solid #4c2326",
  padding: "8px 12px",
  borderRadius: 8,
  wordBreak: "break-word",
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
