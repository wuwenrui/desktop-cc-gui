import { afterEach, describe, expect, it, vi } from "vitest";
import { collectGovernanceEvidence } from "./collectGovernanceEvidence";
import { readGateArtifactEvidence } from "./gateArtifactEvidenceReader";
import {
  openspecEvidenceReaderInternals,
  readOpenSpecEvidence,
} from "./openspecEvidenceReader";
import {
  createGovernanceConfigTemplate,
  deriveProjectGovernanceProfile,
} from "./projectGovernanceProfile";
import { readScriptEvidence } from "./scriptEvidenceReader";
import { readTrellisEvidence } from "./trellisEvidenceReader";
import type { WorkspaceGovernanceSnapshot } from "./types";
import { readWorkflowEvidence } from "./workflowEvidenceReader";

function createSnapshot(
  files: Record<string, string>,
): WorkspaceGovernanceSnapshot {
  const normalizedFiles = Object.keys(files);
  return {
    files: normalizedFiles,
    readFile: async (path) => files[path.replace(/\\/g, "/")] ?? null,
  };
}

describe("governance evidence readers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses OpenSpec task progress across LF and CRLF markdown", async () => {
    const snapshot = createSnapshot({
      "openspec/changes/a/tasks.md": "- [x] done\r\n- [ ] todo\r\n",
      "openspec/changes/b/tasks.md": "- [X] done\n- [x] done\n",
    });

    await expect(readOpenSpecEvidence(snapshot)).resolves.toMatchObject([
      {
        id: "openspec:tasks",
        source: "openspec",
        status: "warn",
        degraded: false,
        updatedAt: "1970-01-01T00:00:00.000Z",
        title: "OpenSpec tasks",
        summary: "3/4 task(s) complete across 2 change(s).",
      },
    ]);
  });

  it("degrades OpenSpec evidence when task markdown is missing or malformed", async () => {
    const snapshot = createSnapshot({
      "openspec/changes/a/tasks.md": "## no checkboxes\n",
    });

    await expect(readOpenSpecEvidence(snapshot)).resolves.toMatchObject([
      {
        id: "openspec:tasks",
        source: "openspec",
        status: "unknown",
        degraded: true,
        degradationReason: "governance-evidence-unavailable",
        updatedAt: "1970-01-01T00:00:00.000Z",
        title: "OpenSpec tasks",
        summary:
          "1 task file(s) found, but none had parseable checkbox progress.",
        payload: {
          kind: "legacy-workspace-evidence",
        },
      },
    ]);
  });

  it("keeps OpenSpec task parsing local and deterministic", () => {
    expect(
      openspecEvidenceReaderInternals.parseTaskProgress("- [x] a\n- [ ] b\n"),
    ).toEqual({
      complete: 1,
      total: 2,
    });
  });

  it("normalizes package script evidence for known harness scripts", async () => {
    const snapshot = createSnapshot({
      "package.json": JSON.stringify({
        scripts: {
          "check:engine-capability-matrix": "node a.mjs",
          "check:capability-aware-policy-router": "node b.mjs",
          "check:context-ledger-cost-budget": "node c.mjs",
          "check:checkpoint-policy-chain": "node d.mjs",
          "check:agent-domain-event-schema": "node e.mjs",
          "check:heavy-test-noise": "node f.mjs",
          "check:large-files:near-threshold": "node g.mjs",
          "check:large-files:gate": "node h.mjs",
        },
      }),
    });

    await expect(readScriptEvidence(snapshot)).resolves.toMatchObject([
      {
        id: "script:harness",
        source: "script",
        status: "pass",
        degraded: false,
        updatedAt: "1970-01-01T00:00:00.000Z",
        title: "Harness check scripts",
        summary: "8/8 known governance script(s) configured.",
      },
    ]);
  });

  it("degrades script evidence for malformed package json when read directly", async () => {
    const snapshot = createSnapshot({
      "package.json": "{not-json",
    });

    await expect(readScriptEvidence(snapshot)).resolves.toMatchObject([
      {
        id: "script:package-json",
        source: "script",
        status: "unknown",
        degraded: true,
        degradationReason: "package-json-malformed",
        updatedAt: "1970-01-01T00:00:00.000Z",
        title: "Package scripts",
        summary: "package.json scripts could not be parsed.",
      },
    ]);
  });

  it("normalizes workflow paths across Windows and POSIX separators", () => {
    expect(
      readWorkflowEvidence({
        files: [
          ".github\\workflows\\large-file-governance.yml",
          ".github/workflows/heavy-test-noise-sentry.yml",
        ],
      }),
    ).toMatchObject([
      {
        id: "workflow:governance",
        source: "workflow",
        status: "pass",
        degraded: false,
        updatedAt: "1970-01-01T00:00:00.000Z",
        title: "Governance workflows",
        summary: "2/2 detected workflow(s) present.",
      },
    ]);
  });

  it("marks missing detected workflows as advisory evidence", () => {
    expect(
      readWorkflowEvidence({
        files: [".github/workflows/large-file-governance.yml"],
      }),
    ).toMatchObject([
      {
        id: "workflow:governance",
        source: "workflow",
        status: "warn",
        degraded: false,
        updatedAt: "1970-01-01T00:00:00.000Z",
        title: "Governance workflows",
        summary: "1/2 detected workflow(s) present.",
      },
    ]);
  });

  it("converts gate artifact JSON reports into governance evidence", async () => {
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-05-20T12:00:00.000Z").getTime(),
    );

    const largeFileGateReport = JSON.stringify({
      schemaVersion: 1,
      gate: "large-files",
      generatedAt: "2026-05-20T00:00:00.000Z",
      status: "pass",
      scope: "fail",
      findingCount: 0,
      blockingCount: 0,
      results: [],
    });
    const heavyTestNoiseReport =
      '{\r\n"schemaVersion":1,\r\n"gate":"heavy-test-noise",\r\n"generatedAt":"2026-05-20T00:00:00.000Z",\r\n"status":"fail",\r\n"breachCount":3\r\n}';
    const snapshot = createSnapshot({
      ".artifacts/large-files-gate.json": largeFileGateReport,
      ".artifacts/large-files-near-threshold.json": JSON.stringify({
        schemaVersion: 1,
        gate: "large-files",
        generatedAt: "2026-05-20T00:00:00.000Z",
        status: "warn",
        scope: "warn",
        findingCount: 2,
        blockingCount: 0,
        results: [],
      }),
      ".artifacts/heavy-test-noise.json": heavyTestNoiseReport,
    });
    const largeFileHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(largeFileGateReport),
    );
    const expectedLargeFileHash = Array.from(new Uint8Array(largeFileHash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    await expect(readGateArtifactEvidence(snapshot)).resolves.toMatchObject([
      {
        id: "large-file:.artifacts/large-files-gate.json",
        source: "large-file",
        status: "pass",
        degraded: false,
        title: "Large-file hard gate",
        payload: {
          kind: "large-file",
          scope: "fail",
          sourcePath: ".artifacts/large-files-gate.json",
        },
        provenance: {
          sourceType: "artifact",
          sourceId: "large-file:.artifacts/large-files-gate.json",
          observedAt: "2026-05-20T00:00:00.000Z",
          parserId: "large-file-json-report@1",
          adapterId: "gate-artifact-evidence-reader@1",
          artifactPath: ".artifacts/large-files-gate.json",
          artifactHash: expectedLargeFileHash,
        },
      },
      {
        id: "large-file:.artifacts/large-files-near-threshold.json",
        source: "large-file",
        status: "warn",
        degraded: false,
        title: "Large-file near-threshold watch",
        payload: {
          kind: "large-file",
          scope: "warn",
          sourcePath: ".artifacts/large-files-near-threshold.json",
        },
      },
      {
        id: "heavy-test-noise:.artifacts/heavy-test-noise.json",
        source: "heavy-test-noise",
        status: "warn",
        degraded: false,
        title: "Heavy test noise sentry",
        payload: {
          kind: "heavy-test-noise",
          breachCount: 3,
          sourcePath: ".artifacts/heavy-test-noise.json",
        },
        provenance: {
          sourceType: "artifact",
          sourceId: "heavy-test-noise:.artifacts/heavy-test-noise.json",
          observedAt: "2026-05-20T00:00:00.000Z",
          parserId: "heavy-test-noise-json-report@1",
          adapterId: "gate-artifact-evidence-reader@1",
          artifactPath: ".artifacts/heavy-test-noise.json",
        },
      },
    ]);
  });

  it("degrades missing and malformed gate artifacts without throwing", async () => {
    const snapshot = createSnapshot({
      ".artifacts/large-files-gate.json": "{not-json",
    });

    const evidence = await readGateArtifactEvidence(snapshot);

    expect(evidence).toHaveLength(3);
    expect(evidence[0]).toMatchObject({
      id: "large-file:.artifacts/large-files-gate.json",
      source: "large-file",
      status: "unknown",
      degraded: true,
      degradationReason: "governance-artifact-malformed",
      provenance: {
        sourceType: "artifact",
        sourceId: "large-file:.artifacts/large-files-gate.json",
        observedAt: "1970-01-01T00:00:00.000Z",
        adapterId: "gate-artifact-evidence-reader@1",
        artifactPath: ".artifacts/large-files-gate.json",
        qualifier: "artifact-malformed",
      },
    });
    expect(evidence[1]).toMatchObject({
      id: "large-file:.artifacts/large-files-near-threshold.json",
      source: "large-file",
      status: "unknown",
      degraded: true,
      degradationReason: "governance-artifact-missing",
      provenance: {
        qualifier: "artifact-missing",
      },
    });
    expect(evidence[2]).toMatchObject({
      id: "heavy-test-noise:.artifacts/heavy-test-noise.json",
      source: "heavy-test-noise",
      status: "unknown",
      degraded: true,
      degradationReason: "governance-artifact-missing",
    });
  });

  it("does not treat stale artifact evidence as fresh passing evidence", async () => {
    vi.spyOn(Date, "now").mockReturnValue(
      new Date("2026-05-20T12:00:00.000Z").getTime(),
    );

    const snapshot = createSnapshot({
      ".artifacts/large-files-gate.json": JSON.stringify({
        schemaVersion: 1,
        gate: "large-files",
        generatedAt: "2026-05-18T00:00:00.000Z",
        status: "pass",
        scope: "fail",
        findingCount: 0,
        blockingCount: 0,
        results: [],
      }),
    });

    const evidence = await readGateArtifactEvidence(snapshot);

    expect(evidence[0]).toMatchObject({
      id: "large-file:.artifacts/large-files-gate.json",
      status: "pass",
      degraded: true,
      degradationReason: "governance-artifact-stale",
      staleAt: "2026-05-19T00:00:00.000Z",
    });
  });

  it("parses stable Trellis session records but keeps Trellis optional", async () => {
    const snapshot = createSnapshot({
      ".trellis/workspace/dev/index.md": "Total Sessions: 12\n",
    });

    await expect(readTrellisEvidence(snapshot)).resolves.toMatchObject([
      {
        id: "trellis:session-record",
        source: "trellis",
        status: "pass",
        degraded: false,
        updatedAt: "1970-01-01T00:00:00.000Z",
        title: "Trellis session record",
        summary: "12 recorded session(s) across 1 developer workspace(s).",
      },
    ]);
  });

  it("degrades Trellis evidence when the schema is absent", async () => {
    await expect(
      readTrellisEvidence(createSnapshot({})),
    ).resolves.toMatchObject([
      {
        id: "trellis:session-record",
        source: "trellis",
        status: "unknown",
        degraded: true,
        degradationReason: "governance-evidence-unavailable",
        updatedAt: "1970-01-01T00:00:00.000Z",
        title: "Trellis session record",
        summary:
          "No Trellis workspace index was found; OpenSpec/script/workflow evidence is still available.",
        payload: {
          kind: "legacy-workspace-evidence",
        },
      },
    ]);
  });

  it("collects profile-aware evidence without writing through the snapshot reader", async () => {
    const readPaths: string[] = [];
    const snapshot: WorkspaceGovernanceSnapshot = {
      files: [
        "openspec/changes/a/tasks.md",
        "package.json",
        ".github/workflows/large-file-governance.yml",
        ".github/workflows/heavy-test-noise-sentry.yml",
      ],
      readFile: async (path) => {
        readPaths.push(path);
        if (path === "openspec/changes/a/tasks.md") {
          return "- [x] done\n";
        }
        if (path === "package.json") {
          return JSON.stringify({
            scripts: {
              "check:large-files:gate": "node scripts/check-large-files.mjs",
            },
          });
        }
        return null;
      },
    };

    const evidence = await collectGovernanceEvidence(snapshot);

    expect(evidence.map((entry) => entry.id)).toEqual([
      "heavy-test-noise:.artifacts/heavy-test-noise.json",
      "large-file:.artifacts/large-files-gate.json",
      "openspec:tasks",
      "script:harness",
      "workflow:governance",
    ]);
    expect(readPaths).toEqual([
      "package.json",
      "governance.config.json",
      "openspec/changes/a/tasks.md",
      ".artifacts/heavy-test-noise.json",
      ".artifacts/large-files-gate.json",
    ]);
  });

  it("does not emit mossx harness evidence for a generic repository", async () => {
    const evidence = await collectGovernanceEvidence(
      createSnapshot({
        "README.md": "# generic\n",
      }),
    );

    expect(evidence).toEqual([]);
  });

  it("keeps malformed package.json visible in profile-aware collection", async () => {
    const evidence = await collectGovernanceEvidence(
      createSnapshot({
        "package.json": "{bad-json",
      }),
    );

    expect(evidence).toMatchObject([
      {
        id: "script:package-json",
        source: "script",
        status: "unknown",
        degraded: true,
        degradationReason: "package-json-malformed",
      },
    ]);
  });

  it("derives project governance profiles across common ecosystems", async () => {
    await expect(
      deriveProjectGovernanceProfile(
        createSnapshot({
          "package.json": JSON.stringify({ scripts: { lint: "eslint ." } }),
          "tsconfig.json": "{}",
          "pnpm-lock.yaml": "",
        }),
      ),
    ).resolves.toMatchObject({
      ecosystems: ["node", "typescript"],
      packageManagers: ["pnpm"],
      scripts: { lint: "eslint ." },
    });

    await expect(
      deriveProjectGovernanceProfile(
        createSnapshot({ "pyproject.toml": "[tool.pytest.ini_options]\r\n" }),
      ),
    ).resolves.toMatchObject({
      ecosystems: ["python"],
    });
    await expect(
      deriveProjectGovernanceProfile(
        createSnapshot({ "Cargo.toml": "[package]\n" }),
      ),
    ).resolves.toMatchObject({
      ecosystems: ["rust"],
    });
    await expect(
      deriveProjectGovernanceProfile(
        createSnapshot({ "go.mod": "module example\n" }),
      ),
    ).resolves.toMatchObject({
      ecosystems: ["go"],
    });
    await expect(
      deriveProjectGovernanceProfile(
        createSnapshot({ "pom.xml": "<project />\n" }),
      ),
    ).resolves.toMatchObject({
      ecosystems: ["maven"],
    });
    await expect(
      deriveProjectGovernanceProfile(
        createSnapshot({ "build.gradle.kts": "plugins {}\n" }),
      ),
    ).resolves.toMatchObject({
      ecosystems: ["gradle"],
    });
    await expect(
      deriveProjectGovernanceProfile(
        createSnapshot({
          "package.json": JSON.stringify({ scripts: { build: "vite build" } }),
          "Cargo.toml": "[package]\n",
          "src-tauri/Cargo.toml": "[package]\n",
        }),
      ),
    ).resolves.toMatchObject({
      ecosystems: ["node", "rust"],
    });
  });

  it("merges optional governance config without suppressing auto evidence", async () => {
    const profile = await deriveProjectGovernanceProfile(
      createSnapshot({
        "package.json": JSON.stringify({ scripts: { test: "vitest" } }),
        "governance.config.json": JSON.stringify({
          version: 1,
          gates: [
            {
              name: "Custom audit",
              artifact: ".artifacts/custom-audit.json",
              severity: "warn",
            },
          ],
        }),
      }),
    );

    expect(profile.scripts).toMatchObject({ test: "vitest" });
    expect(profile.gates).toContainEqual(
      expect.objectContaining({
        name: "Custom audit",
        artifactPath: ".artifacts/custom-audit.json",
        source: "config",
      }),
    );
  });

  it("keeps auto profile when governance config is malformed", async () => {
    const profile = await deriveProjectGovernanceProfile(
      createSnapshot({
        "package.json": JSON.stringify({ scripts: { build: "vite build" } }),
        "governance.config.json": "{bad-json",
      }),
    );

    expect(profile.scripts).toMatchObject({ build: "vite build" });
    expect(profile.configEvidence).toMatchObject([
      {
        id: "governance-config:parse",
        status: "warn",
        degraded: true,
      },
    ]);
  });

  it("creates a minimal governance config template without mossx defaults", () => {
    const template = createGovernanceConfigTemplate();

    expect(template).toContain('"version": 1');
    expect(template).toContain('"scripts": []');
    expect(template).not.toContain("check:large-files:gate");
    expect(template).not.toContain("heavy-test-noise");
  });
});
