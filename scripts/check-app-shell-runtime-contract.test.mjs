import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-app-shell-runtime-contract.mjs",
);

async function writeFixtureFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function writeFlatAppShellFixture(root) {
  await writeFixtureFile(
    root,
    "src/app-shell.tsx",
    `
import { useAppShellSearchAndComposerSection } from "./app-shell-parts/useAppShellSearchAndComposerSection";
import { useAppShellSections } from "./app-shell-parts/useAppShellSections";
import { useAppShellLayoutNodesSection } from "./app-shell-parts/useAppShellLayoutNodesSection";
import { renderAppShell } from "./app-shell-parts/renderAppShell";

export function AppShell() {
  const appShellContext = {
    searchValue: "search",
    sectionValue: "section",
    layoutValue: "layout",
    renderValue: "render",
  };
  const searchAndComposerSection = useAppShellSearchAndComposerSection(appShellContext);
  const sections = useAppShellSections({
    ...appShellContext,
    ...searchAndComposerSection,
  });
  const layoutNodes = useAppShellLayoutNodesSection({
    ...appShellContext,
    ...searchAndComposerSection,
    ...sections,
  });
  return renderAppShell({
    ...appShellContext,
    ...searchAndComposerSection,
    ...sections,
    ...layoutNodes,
  });
}
`,
  );
  await writeFixtureFile(
    root,
    "src/app-shell-parts/useAppShellSearchAndComposerSection.ts",
    `
export function useAppShellSearchAndComposerSection(ctx) {
  const { searchValue } = ctx;
  return { searchResult: searchValue };
}
`,
  );
  await writeFixtureFile(
    root,
    "src/app-shell-parts/useAppShellSections.ts",
    `
export function useAppShellSections(ctx) {
  const { sectionValue, searchResult } = ctx;
  return { sectionResult: sectionValue, searchEcho: searchResult };
}
`,
  );
  await writeFixtureFile(
    root,
    "src/app-shell-parts/useAppShellLayoutNodesSection.tsx",
    `
export function useAppShellLayoutNodesSection(ctx) {
  const { layoutValue, sectionResult } = ctx;
  return { layoutResult: layoutValue, sectionEcho: sectionResult };
}
`,
  );
  await writeFixtureFile(
    root,
    "src/app-shell-parts/renderAppShell.tsx",
    `
export function renderAppShell(ctx) {
  const { renderValue, layoutResult } = ctx;
  return renderValue || layoutResult;
}
`,
  );
  await writeFixtureFile(
    root,
    "src/app-shell-parts/lazyViews.tsx",
    `
import { lazy } from "react";

export const SettingsView = lazy(() =>
  import("../features/settings/components/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);
`,
  );
  await writeFixtureFile(
    root,
    "src/features/settings/components/SettingsView.tsx",
    `
import "../../../styles/settings.css";

export function SettingsView() {
  return null;
}
`,
  );
}

async function writeSettingsViewFixture(root, settingsViewContent) {
  await writeFlatAppShellFixture(root);
  await writeFixtureFile(
    root,
    "src/features/settings/components/SettingsView.tsx",
    settingsViewContent,
  );
}

test("accepts fork appShellContext as a flat runtime contract source", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "app-shell-contract-"));
  try {
    await symlink(path.resolve("node_modules"), path.join(root, "node_modules"), "dir");
    await writeFlatAppShellFixture(root);
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: "utf8",
    });

    assert.equal(
      result.status,
      0,
      `${result.stdout}\n${result.stderr}`,
    );
    assert.match(result.stdout, /check-app-shell-runtime-contract: OK/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("requires SettingsView to statically import settings styles", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "app-shell-contract-"));
  try {
    await symlink(path.resolve("node_modules"), path.join(root, "node_modules"), "dir");
    await writeSettingsViewFixture(
      root,
      `
export function SettingsView() {
  return null;
}
`,
    );
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /SettingsView component must statically import settings\.css/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
