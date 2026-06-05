import { describe, expect, it } from "vitest";
import { readRepositorySignalOrchestrationCandidates } from "./repositorySignalProvider";

describe("readRepositorySignalOrchestrationCandidates", () => {
  it("treats absent repository signals as optional", () => {
    const snapshot = readRepositorySignalOrchestrationCandidates({
      workspaceId: "workspace-1",
      signals: [],
    });

    expect(snapshot).toEqual({
      providerId: "repo:generic",
      available: false,
      candidates: [],
      degraded: [],
    });
  });

  it("exposes package scripts, CI workflows, and agent rules as advisory candidates", () => {
    const snapshot = readRepositorySignalOrchestrationCandidates({
      workspaceId: "workspace-1",
      signals: [
        {
          kind: "package_script",
          id: "test",
          label: "npm test",
          path: "package.json",
        },
        {
          kind: "ci_workflow",
          id: "main-yml",
          label: "CI workflow",
          path: ".github/workflows/main.yml",
          summary: "CI runs unit and type checks.",
        },
        {
          kind: "agent_rule",
          id: "agents-md",
          label: "AGENTS.md",
          path: "AGENTS.md",
        },
      ],
      now: "2026-06-03T00:00:00.000Z",
    });

    expect(snapshot.available).toBe(true);
    expect(snapshot.candidates).toHaveLength(3);
    expect(snapshot.candidates[0]).toMatchObject({
      status: "candidate",
      sourceRefs: [
        expect.objectContaining({
          providerId: "repo:generic",
          kind: "repository_signal",
          metadata: {
            signalKind: "package_script",
          },
        }),
      ],
      riskMarkers: [
        expect.objectContaining({
          kind: "candidate_source",
        }),
      ],
    });
    expect(snapshot.candidates[1]?.scopeSummary).toBe("CI runs unit and type checks.");
  });
});
