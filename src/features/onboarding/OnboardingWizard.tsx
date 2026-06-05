import { useState } from "react";
import type { CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  fetchSiteModels,
  type SiteModel,
} from "../../services/tauri/vendors";
import {
  SiteModelPicker,
  type SlotMapping,
} from "../vendors/components/SiteModelPicker";
import { STORAGE_KEYS } from "../vendors/types";

const NEW_API_HOST = "http://47.239.143.243:3000";

type Step = "key" | "models";

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("key");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [models, setModels] = useState<SiteModel[]>([]);

  async function handleKeySubmit() {
    setBusy(true);
    setErr("");
    try {
      const list = await fetchSiteModels(NEW_API_HOST, key.trim());
      if (list.length === 0) {
        setErr("No models available for this key.");
        return;
      }
      setModels(list);
      setStep("models");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleModelConfirm(
    claudeSlots: SlotMapping,
    codexModels: string[],
  ) {
    setBusy(true);
    setErr("");
    try {
      const env = {
        ANTHROPIC_BASE_URL: NEW_API_HOST,
        ANTHROPIC_AUTH_TOKEN: key.trim(),
        ANTHROPIC_MODEL: claudeSlots.sonnet,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: claudeSlots.haiku,
        ANTHROPIC_DEFAULT_SONNET_MODEL: claudeSlots.sonnet,
        ANTHROPIC_DEFAULT_OPUS_MODEL: claudeSlots.opus,
      };
      await invoke("vendor_add_claude_provider", {
        provider: { id: "new-api", name: "New API", settingsConfig: { env } },
      });
      await invoke("vendor_switch_claude_provider", { id: "new-api" });

      if (codexModels.length > 0) {
        const codexCustom = codexModels.map((id) => ({
          id,
          label: id,
        }));
        localStorage.setItem(
          STORAGE_KEYS.CODEX_CUSTOM_MODELS,
          JSON.stringify(codexCustom),
        );
        window.dispatchEvent(new Event("localStorageChange"));
      }

      try {
        await invoke("install_bundled_skills");
      } catch {
        // skill install failure should not block onboarding
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
        <div style={brand}>Lawyer Copilot</div>

        {step === "key" && (
          <>
            <h2 style={titleStyle}>Setup</h2>
            <p style={subtitle}>
              Connect to the model site, then select which models to use.
            </p>

            <div style={hostBadge}>
              <span style={hostDot} />
              {NEW_API_HOST}
            </div>

            <label style={fieldLabel}>
              <span>
                API Key <span style={reqMark}>*</span>
              </span>
              <input
                style={input}
                aria-label="new-api key"
                type="password"
                value={key}
                placeholder="Paste your API Key"
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && key.trim()) handleKeySubmit();
                }}
              />
            </label>

            {err && (
              <div style={errorBox} role="alert">
                {err}
              </div>
            )}

            <button
              type="button"
              style={{ ...button, ...(!key.trim() || busy ? buttonDisabled : undefined) }}
              disabled={!key.trim() || busy}
              onClick={handleKeySubmit}
            >
              {busy ? "Loading models..." : "Next"}
            </button>
          </>
        )}

        {step === "models" && (
          <>
            <SiteModelPicker
              models={models}
              loading={busy}
              onBack={() => {
                setStep("key");
                setErr("");
              }}
              onConfirm={handleModelConfirm}
            />
            {err && (
              <div style={errorBox} role="alert">
                {err}
              </div>
            )}
          </>
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

const card: CSSProperties = {
  width: "100%",
  maxWidth: 480,
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
