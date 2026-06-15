import { describe, expect, it } from "vitest";
import {
  loadCodeMirrorExtensionsForEditorLanguage,
  loadCodeMirrorExtensionsForPath,
} from "./codemirrorLanguageExtensions";

describe("codeMirrorExtensionsForPath", () => {
  it("returns editor extensions for java/spring/python/sql/toml/gitignore/lock/shell-group paths", async () => {
    await expect(loadCodeMirrorExtensionsForPath("src/main/java/App.java")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("src/main/resources/pom.xml")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("src/main/resources/application.properties")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("scripts/main.py")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("src/main/resources/application.yml")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("queries/report.sql")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("configs/settings.toml")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath(".gitignore")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("Cargo.lock")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("yarn.lock")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("scripts/dev-local.sh")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath("scripts/release.zsh")).resolves.toHaveLength(1);
    await expect(loadCodeMirrorExtensionsForPath(".envrc")).resolves.toHaveLength(1);
  });

  it("keeps baseline editor language coverage", async () => {
    expect((await loadCodeMirrorExtensionsForPath("src/main.ts")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForPath("src/main.js")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForPath("src/view.json")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForPath("README.md")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForPath("styles/main.css")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForPath("config/settings.yaml")).length).toBeGreaterThan(0);
  });

  it("falls back to plain text for unsupported types", async () => {
    await expect(loadCodeMirrorExtensionsForPath("assets/logo.bmp")).resolves.toEqual([]);
    await expect(loadCodeMirrorExtensionsForPath("README")).resolves.toEqual([]);
  });

  it("keeps first-round config and language capability boundaries explicit", async () => {
    expect((await loadCodeMirrorExtensionsForPath("docker-compose.yml")).length).toBeGreaterThan(0);
    expect(await loadCodeMirrorExtensionsForPath("README.env")).toHaveLength(0);
    expect((await loadCodeMirrorExtensionsForPath(".env.production")).length).toBeGreaterThan(0);
    await expect(loadCodeMirrorExtensionsForPath("src/App.vue")).resolves.toEqual([]);
    await expect(loadCodeMirrorExtensionsForPath("server/index.php")).resolves.toEqual([]);
    await expect(loadCodeMirrorExtensionsForPath("scripts/task.rb")).resolves.toEqual([]);
    await expect(loadCodeMirrorExtensionsForPath("src/Program.cs")).resolves.toEqual([]);
    await expect(loadCodeMirrorExtensionsForPath("lib/main.dart")).resolves.toEqual([]);
    expect((await loadCodeMirrorExtensionsForPath("android/app/build.gradle")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForPath("build.gradle.kts")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForPath("config/app.ini")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForPath("config/supervisor.conf")).length).toBeGreaterThan(0);
  });

  it("supports direct editor-language lookup for shared render-profile orchestration", async () => {
    expect((await loadCodeMirrorExtensionsForEditorLanguage("yaml")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForEditorLanguage("shell")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForEditorLanguage("properties")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForEditorLanguage("groovy")).length).toBeGreaterThan(0);
    expect((await loadCodeMirrorExtensionsForEditorLanguage("kotlin")).length).toBeGreaterThan(0);
    await expect(loadCodeMirrorExtensionsForEditorLanguage(null)).resolves.toEqual([]);
  });
});
