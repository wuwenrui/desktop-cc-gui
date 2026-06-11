import { describe, expect, it } from "vitest";
import {
  buildArtifactUrl,
  buildUpdaterEndpoint,
  configureUpdaterConfig,
  normalizeUpdateBaseUrl,
} from "../../../scripts/configure-updater-endpoint.mjs";

describe("configure updater endpoint", () => {
  it("normalizes the self-hosted update base URL", () => {
    expect(normalizeUpdateBaseUrl("https://download.example.com/lawyer-copilot/")).toBe(
      "https://download.example.com/lawyer-copilot",
    );
  });

  it("rejects non-HTTPS update base URLs", () => {
    expect(() => normalizeUpdateBaseUrl("http://47.239.143.243/downloads/lawyer-copilot")).toThrow(
      /HTTPS/i,
    );
  });

  it("builds latest.json and artifact URLs from the same base", () => {
    const baseUrl = "https://download.example.com/lawyer-copilot";

    expect(buildUpdaterEndpoint(baseUrl)).toBe(
      "https://download.example.com/lawyer-copilot/latest.json",
    );
    expect(buildArtifactUrl(baseUrl, "LawyerCopilot_aarch64.app.tar.gz")).toBe(
      "https://download.example.com/lawyer-copilot/LawyerCopilot_aarch64.app.tar.gz",
    );
  });

  it("updates tauri config to use only the self-hosted endpoint", () => {
    const config = {
      plugins: {
        updater: {
          active: true,
          pubkey: "public-key",
          endpoints: ["https://github.com/wuwenrui/desktop-cc-gui/releases/latest/download/latest.json"],
        },
      },
    };

    expect(configureUpdaterConfig(config, "https://download.example.com/lawyer-copilot")).toEqual({
      plugins: {
        updater: {
          active: true,
          pubkey: "public-key",
          endpoints: ["https://download.example.com/lawyer-copilot/latest.json"],
        },
      },
    });
  });
});
