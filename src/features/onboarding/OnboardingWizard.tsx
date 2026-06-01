import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

// new-api 预设(运行时注入，不依赖上游预设数组)。base_url 先用占位，后续可改。
const NEW_API_ENV = {
  ANTHROPIC_BASE_URL: "http://47.239.143.243:3000",
  ANTHROPIC_AUTH_TOKEN: "",
  ANTHROPIC_MODEL: "glm-4.7",
  ANTHROPIC_DEFAULT_HAIKU_MODEL: "glm-4.7",
  ANTHROPIC_DEFAULT_SONNET_MODEL: "glm-4.7",
  ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-4.7",
};

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const [key, setKey] = useState("");
  const [crawlerUrl, setCrawlerUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const env = { ...NEW_API_ENV, ANTHROPIC_AUTH_TOKEN: key };
      await invoke("vendor_add_claude_provider", {
        provider: { id: "new-api", name: "New API", settingsConfig: { env } },
      });
      await invoke("vendor_switch_claude_provider", { id: "new-api" });
      await invoke("install_bundled_skills");
      if (crawlerUrl) {
        await invoke("write_court_crawler_mcp", { url: crawlerUrl });
      }
      onDone();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding">
      <h2>首次配置</h2>
      <label>
        New API Key
        <input
          aria-label="new-api key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <label>
        案件查询服务地址(可选)
        <input
          aria-label="court crawler url"
          value={crawlerUrl}
          placeholder="https://host/mcp/sse"
          onChange={(e) => setCrawlerUrl(e.target.value)}
        />
      </label>
      {err && <p role="alert">{err}</p>}
      <button disabled={!key || busy} onClick={submit}>
        完成
      </button>
    </div>
  );
}
