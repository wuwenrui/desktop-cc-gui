import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PROVIDER_BOUNDARY_FILES = [
  "src/features/agent-orchestration/providers/manualProvider.ts",
  "src/features/agent-orchestration/providers/projectMapProvider.ts",
  "src/features/agent-orchestration/providers/taskRunProvider.ts",
  "src/features/agent-orchestration/providers/coreProviders.ts",
  "src/features/agent-orchestration/utils/dispatchTask.ts",
  "src/features/agent-orchestration/utils/reviewTask.ts",
  "src/features/agent-orchestration/utils/taskRunLifecycleProjection.ts",
];

const FORBIDDEN_PROVIDER_WRITE_PATTERNS = [
  /\bwriteFile\b/,
  /\bwriteTextFile\b/,
  /\bmkdir\b/,
  /\bremove\b/,
  /\brename\b/,
  /@tauri-apps\/plugin-fs/,
  /node:fs/,
  /\.trellis\/tasks/,
  /openspec\/changes/,
  /\.spec-kit/,
  /AGENTS\.md/,
  /\.claude\//,
  /\.codex\//,
];

describe("agent orchestration provider boundary", () => {
  it("keeps ingest, dispatch, and review code from writing provider artifacts", () => {
    for (const relativePath of PROVIDER_BOUNDARY_FILES) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      for (const pattern of FORBIDDEN_PROVIDER_WRITE_PATTERNS) {
        expect(source, `${relativePath} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
