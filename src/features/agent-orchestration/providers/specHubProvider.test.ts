import { describe, expect, it } from "vitest";
import type { SpecWorkspaceSnapshot } from "../../../lib/spec-core/types";
import { readSpecHubOrchestrationCandidates } from "./specHubProvider";

function makeSnapshot(
  overrides: Partial<SpecWorkspaceSnapshot> = {},
): SpecWorkspaceSnapshot {
  return {
    provider: "openspec",
    supportLevel: "full",
    environment: {
      mode: "managed",
      status: "healthy",
      checks: [],
      blockers: [],
      hints: [],
    },
    changes: [
      {
        id: "add-feature",
        status: "ready",
        updatedAt: Date.parse("2026-06-03T00:00:00.000Z"),
        artifacts: {
          proposalPath: "openspec/changes/add-feature/proposal.md",
          designPath: "openspec/changes/add-feature/design.md",
          tasksPath: "openspec/changes/add-feature/tasks.md",
          verificationPath: null,
          specPaths: ["openspec/changes/add-feature/specs/example/spec.md"],
        },
        blockers: [],
      },
    ],
    blockers: [],
    ...overrides,
  };
}

describe("readSpecHubOrchestrationCandidates", () => {
  it("reads OpenSpec changes as write-capable provider-neutral candidates", () => {
    const snapshot = readSpecHubOrchestrationCandidates({
      workspaceId: "workspace-1",
      snapshot: makeSnapshot(),
      now: "2026-06-03T00:01:00.000Z",
    });

    expect(snapshot).toMatchObject({
      providerId: "spec:openspec",
      available: true,
      degraded: [],
    });
    expect(snapshot.candidates[0]).toMatchObject({
      taskId: "spec-openspec-add-feature",
      status: "ready",
      title: "Spec change: add-feature",
      sourceRefs: [
        expect.objectContaining({
          providerId: "spec:openspec",
          kind: "spec_change",
          id: "add-feature",
          capabilities: ["read_candidates", "open_source", "write_back"],
        }),
      ],
    });
    expect(snapshot.candidates[0]?.evidenceRefs).toHaveLength(4);
  });

  it("reads spec-kit minimal changes as degraded read-only candidates", () => {
    const snapshot = readSpecHubOrchestrationCandidates({
      workspaceId: "workspace-1",
      snapshot: makeSnapshot({
        provider: "speckit",
        supportLevel: "minimal",
        changes: [
          {
            id: "speckit",
            status: "implementing",
            updatedAt: Date.parse("2026-06-03T00:02:00.000Z"),
            artifacts: {
              proposalPath: "spec.md",
              designPath: null,
              tasksPath: null,
              verificationPath: null,
              specPaths: [],
            },
            blockers: ["Spec-Kit CLI is optional in minimal mode."],
          },
        ],
      }),
    });

    expect(snapshot.providerId).toBe("spec:speckit");
    expect(snapshot.degraded).toHaveLength(1);
    expect(snapshot.candidates[0]).toMatchObject({
      status: "running",
      riskMarkers: [
        expect.objectContaining({
          kind: "provider_degraded",
        }),
      ],
    });
    expect(snapshot.candidates[0]?.sourceRefs[0]?.capabilities).not.toContain("write_back");
  });

  it("returns degraded empty candidates for unknown spec providers", () => {
    const snapshot = readSpecHubOrchestrationCandidates({
      workspaceId: "workspace-1",
      snapshot: makeSnapshot({
        provider: "unknown",
        supportLevel: "none",
        changes: [],
        blockers: ["No supported spec provider detected."],
      }),
    });

    expect(snapshot).toMatchObject({
      providerId: "spec:unknown",
      available: false,
      candidates: [],
      degraded: [
        expect.objectContaining({
          reason: "No supported spec provider detected.",
        }),
      ],
    });
  });
});
