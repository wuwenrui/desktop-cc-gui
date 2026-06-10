import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("update release configuration", () => {
  it("points the updater endpoint at the self-hosted release feed", () => {
    const config = JSON.parse(readWorkspaceFile("src-tauri/tauri.conf.json")) as {
      plugins?: { updater?: { endpoints?: string[] } };
    };

    expect(config.plugins?.updater?.endpoints).toContain(
      "https://updates.codingrui.work/downloads/lawyer-copilot/latest.json",
    );
  });

  it("release workflow configures a self-hosted updater endpoint before packaging", () => {
    const workflow = readWorkspaceFile(".github/workflows/release.yml");

    expect(workflow).toContain("LAWYER_COPILOT_UPDATE_BASE_URL");
    expect(workflow).toContain("scripts/configure-updater-endpoint.mjs");
  });

  it("generates latest.json asset URLs from the self-hosted release base", () => {
    const workflow = readWorkspaceFile(".github/workflows/release.yml");

    expect(workflow).toContain("UPDATE_BASE_URL");
    expect(workflow).toContain('"version": os.environ["VERSION"]');
    expect(workflow).not.toContain('"version": "${VERSION}"');
    expect(workflow).not.toContain("github.com/wuwenrui/desktop-cc-gui/releases/download/v${VERSION}");
  });

  it("uploads updater artifacts over authenticated HTTPS", () => {
    const workflow = readWorkspaceFile(".github/workflows/release.yml");

    expect(workflow).toContain("LAWYER_COPILOT_UPDATE_UPLOAD_URL");
    expect(workflow).toContain("--upload-file");
    expect(workflow).not.toContain("LAWYER_COPILOT_UPDATE_SSH_KEY");
    expect(workflow).not.toContain("rsync");
  });
});
