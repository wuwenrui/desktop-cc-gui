import { describe, expect, it } from "vitest";

import { mockProjectMapData } from "../mockProjectMapData";
import {
  buildDatasetFromProjectMapRead,
  serializeProjectMapDataset,
  type ProjectMapReadResponse,
} from "./projectMapPersistence";

describe("project map persistence mapper", () => {
  it("serializes manifest, profile, lenses, lens nodes, settings, cursor, candidates, evidence, and runs", () => {
    const files = serializeProjectMapDataset({
      ...mockProjectMapData,
      candidates: [],
      evidenceRecords: [],
    });

    expect(files.map((file) => file.relativePath)).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "profile.json",
        "lenses/manifest.json",
        "lenses/overview/nodes.json",
        "settings.json",
        "memory-ingestion/cursor.json",
        "memory-ingestion/processed.json",
        "runs/latest.json",
        "candidates/latest.json",
        "evidence/latest.json",
      ]),
    );
  });

  it("serializes unsafe lens ids into platform-safe node file paths", () => {
    const files = serializeProjectMapDataset({
      ...mockProjectMapData,
      lenses: [
        {
          ...mockProjectMapData.lenses[0]!,
          id: "API/Domain",
        },
      ],
      nodes: [
        {
          ...mockProjectMapData.nodes[0]!,
          lensId: "API/Domain",
        },
      ],
    });

    expect(files.map((file) => file.relativePath)).toContain("lenses/api-domain/nodes.json");
    expect(files.map((file) => file.relativePath)).not.toContain("lenses/API/Domain/nodes.json");
  });

  it("builds a dataset from persisted read payloads and sanitizes settings/cursor", () => {
    const response: ProjectMapReadResponse = {
      storageKey: "mossx-abcd",
      storageDir: "/repo/.ccgui/project-map/mossx-abcd",
      exists: true,
      manifest: mockProjectMapData.manifest,
      profile: mockProjectMapData.profile,
      lenses: { items: mockProjectMapData.lenses },
      lensNodes: {
        overview: { items: mockProjectMapData.nodes.filter((node) => node.lensId === "overview") },
      },
      settings: {
        enabled: true,
        engine: "codex",
        model: "gpt-5.4",
        newSessionThreshold: 0,
        checkIntervalMinutes: 1,
        applyMode: "autoApplyEvidenceBacked",
      },
      cursor: {
        lastCheckedAt: "2026-05-26T00:00:00Z",
        processedMessages: [{ sessionId: "s1", messageHash: "h1" }],
        pendingMessages: [{ sessionId: "s2", messageHash: "h2" }],
      },
      processed: { items: [] },
      candidates: {},
      evidence: {},
      runs: {},
    };

    const dataset = buildDatasetFromProjectMapRead(response, {
      projectName: "mossx",
      workspacePath: "/repo",
      workspaceId: "ws-1",
    });

    expect(dataset?.autoIngestionSettings.newSessionThreshold).toBe(1);
    expect(dataset?.autoIngestionSettings.checkIntervalMinutes).toBe(5);
    expect(dataset?.memoryCursor.processedMessages).toHaveLength(1);
    expect(dataset?.nodes.length).toBeGreaterThan(0);
  });

  it("restores queued runs even before generated lenses exist", () => {
    const dataset = buildDatasetFromProjectMapRead(
      {
        storageKey: "mossx-abcd",
        storageDir: "/repo/.ccgui/project-map/mossx-abcd",
        exists: true,
        manifest: mockProjectMapData.manifest,
        profile: mockProjectMapData.profile,
        lenses: { items: [] },
        lensNodes: {},
        candidates: {},
        evidence: {},
        runs: {
          latest: {
            items: [
              {
                id: "global_run_1",
                kind: "global",
                status: "pending",
                engine: "codex",
                model: "gpt-5.3-codex-spark",
                startedAt: "2026-05-26T02:40:00.000Z",
                completedAt: null,
                scope: "global",
              },
            ],
          },
        },
      },
      { projectName: "mossx", workspacePath: "/repo", workspaceId: "ws-1" },
    );

    expect(dataset?.lenses).toEqual([]);
    expect(dataset?.runs[0]).toMatchObject({
      id: "global_run_1",
      status: "pending",
    });
  });

  it("rejects future schema versions", () => {
    const dataset = buildDatasetFromProjectMapRead(
      {
        storageKey: "future",
        storageDir: "/repo/.ccgui/project-map/future",
        exists: true,
        manifest: { ...mockProjectMapData.manifest, schemaVersion: 999 },
        profile: mockProjectMapData.profile,
        lenses: { items: mockProjectMapData.lenses },
        lensNodes: {},
        candidates: {},
        evidence: {},
        runs: {},
      },
      { projectName: "mossx", workspacePath: "/repo", workspaceId: "ws-1" },
    );

    expect(dataset).toBeNull();
  });
});
