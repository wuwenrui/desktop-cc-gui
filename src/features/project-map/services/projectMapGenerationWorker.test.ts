import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveThread,
  engineSendMessageSync,
  getWorkspaceFiles,
  readWorkspaceFile,
  sendUserMessage,
  startThread,
} from "../../../services/tauri";
import { subscribeAppServerEvents } from "../../../services/events";
import type { EngineType } from "../../../types";
import { createEmptyProjectMapDataset } from "./projectMapPersistence";
import { runProjectMapGenerationWorker } from "./projectMapGenerationWorker";
import type { ProjectMapRunMetadata } from "../types";

vi.mock("../../../services/events", () => ({
  subscribeAppServerEvents: vi.fn(() => () => {}),
}));

vi.mock("../../../services/tauri", () => ({
  archiveThread: vi.fn(),
  engineSendMessageSync: vi.fn(),
  getWorkspaceFiles: vi.fn(),
  readWorkspaceFile: vi.fn(),
  sendUserMessage: vi.fn(),
  startThread: vi.fn(),
}));

function baseRun(overrides: Partial<ProjectMapRunMetadata> = {}): ProjectMapRunMetadata {
  return {
    id: "global_run_1",
    kind: "global",
    status: "running",
    phase: "preparingSources",
    progress: 10,
    engine: "claude",
    model: "claude-sonnet",
    startedAt: "2026-05-26T02:00:00.000Z",
    completedAt: null,
    scope: "global",
    requestScope: { kind: "global", lensIds: [] },
    readSources: [],
    writePath: ".ccgui/project-map/demo",
    error: null,
    ...overrides,
  };
}

describe("runProjectMapGenerationWorker", () => {
  beforeEach(() => {
    vi.mocked(getWorkspaceFiles).mockReset();
    vi.mocked(readWorkspaceFile).mockReset();
    vi.mocked(engineSendMessageSync).mockReset();
    vi.mocked(startThread).mockReset();
    vi.mocked(sendUserMessage).mockReset();
    vi.mocked(archiveThread).mockReset();
    vi.mocked(subscribeAppServerEvents).mockReset();
    vi.mocked(subscribeAppServerEvents).mockReturnValue(() => {});
    vi.mocked(archiveThread).mockResolvedValue(null);
  });

  it("collects bounded evidence, asks the selected engine, and returns generated map data", async () => {
    const dataset = createEmptyProjectMapDataset({
      identity: {
        projectName: "demo",
        workspacePath: "/repo/demo",
        workspaceId: "ws-1",
      },
      now: "2026-05-26T01:59:00.000Z",
    });
    vi.mocked(getWorkspaceFiles).mockResolvedValue({
      files: ["package.json", "src/main.ts", "node_modules/skip.js"],
      directories: [],
      gitignored_files: [],
      gitignored_directories: [],
    });
    vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
      content: path === "package.json" ? '{"scripts":{"test":"vitest"}}' : "export const app = true;",
      truncated: false,
    }));
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        profile: {
          primaryLanguage: "typescript",
          languages: ["typescript"],
          shapes: ["frontend-app"],
          frameworks: [],
          interfaceKinds: ["library"],
          buildSystems: ["npm"],
        },
        lenses: [
          {
            id: "overview",
            title: "总览 Overview",
            shortTitle: "Overview",
            description: "Project profile",
            status: "detected",
            confidence: "medium",
            evidence: [{ type: "file", label: "package.json", path: "package.json" }],
          },
        ],
        nodes: [
          {
            id: "project-core",
            lensId: "overview",
            nodeKind: "concept",
            title: "项目核心 Project Core",
            summary: "TypeScript app shell.",
            detail: {
              coreDescription: "基于 package.json 和 src/main.ts 识别。",
              keyFacts: ["package.json defines scripts"],
              keyLogic: ["src/main.ts is an entry clue"],
              riskSignals: [],
              relatedArtifacts: [{ type: "file", label: "package.json", path: "package.json" }],
            },
            children: [],
            sources: [{ type: "file", label: "package.json", path: "package.json" }],
            confidence: "medium",
            stale: false,
            candidate: false,
          },
        ],
      }),
    });
    const updates: Array<{ phase?: string; progress?: number; log?: string }> = [];

    const result = await runProjectMapGenerationWorker({
      workspaceId: "ws-1",
      dataset,
      run: baseRun(),
      onRunUpdate: async (update) => {
        updates.push(update);
      },
    });

    expect(engineSendMessageSync).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        engine: "claude",
        model: "claude-sonnet",
        accessMode: "read-only",
      }),
    );
    expect(readWorkspaceFile).toHaveBeenCalledWith("ws-1", "package.json");
    expect(result.profile.primaryLanguage).toBe("typescript");
    expect(result.nodes[0]).toMatchObject({
      id: "project-core",
      generatedBy: {
        runId: "global_run_1",
      },
    });
    expect(updates.map((update) => update.phase)).toContain("validatingOutput");
    expect(updates.map((update) => update.phase)).toContain("writingMap");
  });

  it("rejects non-json AI output before map persistence", async () => {
    const dataset = createEmptyProjectMapDataset({
      identity: {
        projectName: "demo",
        workspacePath: "/repo/demo",
        workspaceId: "ws-1",
      },
    });
    vi.mocked(getWorkspaceFiles).mockResolvedValue({
      files: ["package.json"],
      directories: [],
      gitignored_files: [],
      gitignored_directories: [],
    });
    vi.mocked(readWorkspaceFile).mockResolvedValue({ content: "{}", truncated: false });
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: "not json",
    });

    await expect(
      runProjectMapGenerationWorker({
        workspaceId: "ws-1",
        dataset,
        run: baseRun(),
        onRunUpdate: async () => {},
      }),
    ).rejects.toThrow("AI output did not contain a JSON object.");
  });

  it("normalizes AI lens ids before they become persisted path segments", async () => {
    const dataset = createEmptyProjectMapDataset({
      identity: {
        projectName: "demo",
        workspacePath: "/repo/demo",
        workspaceId: "ws-1",
      },
    });
    vi.mocked(getWorkspaceFiles).mockResolvedValue({
      files: ["package.json"],
      directories: [],
      gitignored_files: [],
      gitignored_directories: [],
    });
    vi.mocked(readWorkspaceFile).mockResolvedValue({ content: "{}", truncated: false });
    vi.mocked(engineSendMessageSync).mockResolvedValue({
      engine: "claude",
      text: JSON.stringify({
        lenses: [
          {
            id: "API/Domain",
            title: "API Domain",
            shortTitle: "API",
            description: "Unsafe source id",
            status: "detected",
            confidence: "medium",
            evidence: [],
          },
        ],
        nodes: [
          {
            id: "project-core",
            lensId: "API/Domain",
            nodeKind: "concept",
            title: "Project Core",
            summary: "Core",
            detail: {
              coreDescription: "Core",
              keyFacts: [],
              keyLogic: [],
              riskSignals: [],
              relatedArtifacts: [],
            },
            children: [],
            sources: [],
            confidence: "medium",
            stale: false,
            candidate: false,
          },
        ],
      }),
    });

    const result = await runProjectMapGenerationWorker({
      workspaceId: "ws-1",
      dataset,
      run: baseRun(),
      onRunUpdate: async () => {},
    });

    expect(result.lenses.map((lens) => lens.id)).toContain("api-domain");
    expect(result.nodes[0]).toMatchObject({ lensId: "api-domain" });
  });

  it.each(["claude", "gemini", "opencode"] as const)(
    "normalizes oversized markdown evidence before asking %s",
    async (engine: EngineType) => {
      const dataset = createEmptyProjectMapDataset({
        identity: {
          projectName: "docs",
          workspacePath: "/repo/docs",
          workspaceId: "ws-1",
        },
      });
      const files = Array.from({ length: 30 }, (_, index) => `docs/topic-${String(index).padStart(2, "0")}.md`);
      vi.mocked(getWorkspaceFiles).mockResolvedValue({
        files,
        directories: [],
        gitignored_files: [],
        gitignored_directories: [],
      });
      vi.mocked(readWorkspaceFile).mockImplementation(async (_workspaceId, path) => ({
        content: [
          `# ${path}`,
          "",
          "第一段保留完整句子，用于验证边界截断不会制造半句断层。",
          "",
          `## ${path} 深层章节`,
          "",
          "长正文 ".repeat(3_000),
          "TAIL_SHOULD_NOT_APPEAR",
        ].join("\n"),
        truncated: false,
      }));
      vi.mocked(engineSendMessageSync).mockResolvedValue({
        engine,
        text: JSON.stringify({
          lenses: [
            {
              id: "overview",
              title: "Overview",
              shortTitle: "Overview",
              description: "Project overview",
              status: "detected",
              confidence: "medium",
              evidence: [],
            },
          ],
          nodes: [
            {
              id: "project-core",
              lensId: "overview",
              nodeKind: "concept",
              title: "normalized map",
              summary: "Generated from normalized evidence.",
              detail: {
                coreDescription: "Generated from normalized evidence.",
                keyFacts: [],
                keyLogic: [],
                riskSignals: [],
                relatedArtifacts: [],
              },
              children: [],
              sources: [],
              confidence: "medium",
              stale: false,
              candidate: false,
            },
          ],
        }),
      });
      const updates: Array<{ log?: string }> = [];

      await runProjectMapGenerationWorker({
        workspaceId: "ws-1",
        dataset,
        run: baseRun({ engine, model: `${engine}-model` }),
        onRunUpdate: async (update) => {
          updates.push(update);
        },
      });

      const prompt = vi.mocked(engineSendMessageSync).mock.calls[0]?.[1]?.text ?? "";
      expect(prompt.length).toBeLessThan(65_000);
      expect(prompt).toContain("PROJECT_MAP_TRUNCATED");
      expect(prompt).toContain("Markdown headings digest:");
      expect(prompt).toContain("# docs/topic-00.md");
      expect(prompt).not.toContain("TAIL_SHOULD_NOT_APPEAR");
      expect(updates.some((update) => update.log?.includes("normalized evidence files"))).toBe(true);
    },
  );

  it("routes codex generation through the app-server event stream", async () => {
    const dataset = createEmptyProjectMapDataset({
      identity: {
        projectName: "demo",
        workspacePath: "/repo/demo",
        workspaceId: "ws-1",
      },
    });
    const payload = JSON.stringify({
      lenses: [
        {
          id: "overview",
          title: "Overview",
          shortTitle: "Overview",
          description: "Project overview",
          status: "detected",
          confidence: "medium",
          evidence: [],
        },
      ],
      nodes: [
        {
          id: "project-core",
          lensId: "overview",
          nodeKind: "concept",
          title: "codex generated map",
          summary: "Generated by Codex.",
          detail: {
            coreDescription: "Generated by Codex.",
            keyFacts: [],
            keyLogic: [],
            riskSignals: [],
            relatedArtifacts: [],
          },
          children: [],
          sources: [],
          confidence: "medium",
          stale: false,
          candidate: false,
        },
      ],
    });
    let eventListener: Parameters<typeof subscribeAppServerEvents>[0] | null = null;
    vi.mocked(subscribeAppServerEvents).mockImplementation((listener) => {
      eventListener = listener;
      return () => {};
    });
    vi.mocked(startThread).mockResolvedValue({ result: { threadId: "codex-thread-1" } });
    vi.mocked(sendUserMessage).mockImplementation(async () => {
      eventListener?.({
        workspace_id: "ws-1",
        message: {
          method: "item/updated",
          params: {
            threadId: "codex-thread-1",
            item: {
              id: "assistant-1",
              type: "agentMessage",
              text: payload,
            },
          },
        },
      } as never);
      eventListener?.({
        workspace_id: "ws-1",
        message: {
          method: "turn/completed",
          params: {
            threadId: "codex-thread-1",
          },
        },
      } as never);
      return {};
    });
    vi.mocked(getWorkspaceFiles).mockResolvedValue({
      files: ["package.json"],
      directories: [],
      gitignored_files: [],
      gitignored_directories: [],
    });
    vi.mocked(readWorkspaceFile).mockResolvedValue({ content: "{}", truncated: false });

    const updates: Array<{ threadId?: string | null; log?: string }> = [];
    const result = await runProjectMapGenerationWorker({
      workspaceId: "ws-1",
      dataset,
      run: baseRun({ engine: "codex", model: "gpt-5.3-codex-spark" }),
      onRunUpdate: async (update) => {
        updates.push(update);
      },
    });

    expect(engineSendMessageSync).not.toHaveBeenCalled();
    expect(startThread).toHaveBeenCalledWith("ws-1");
    expect(sendUserMessage).toHaveBeenCalledWith(
      "ws-1",
      "codex-thread-1",
      expect.any(String),
      expect.objectContaining({
        model: "gpt-5.3-codex-spark",
        accessMode: "read-only",
      }),
    );
    expect(archiveThread).toHaveBeenCalledWith("ws-1", "codex-thread-1");
    expect(updates).toContainEqual(
      expect.objectContaining({
        threadId: "codex-thread-1",
      }),
    );
    expect(result.nodes[0]).toMatchObject({
      title: "codex generated map",
      generatedBy: {
        engine: "codex",
        model: "gpt-5.3-codex-spark",
      },
    });
  });

  it.each(["claude", "gemini", "opencode"] as const)(
    "routes %s generation through the same sync request contract",
    async (engine: EngineType) => {
      const dataset = createEmptyProjectMapDataset({
        identity: {
          projectName: "demo",
          workspacePath: "/repo/demo",
          workspaceId: "ws-1",
        },
      });
      vi.mocked(getWorkspaceFiles).mockResolvedValue({
        files: ["package.json"],
        directories: [],
        gitignored_files: [],
        gitignored_directories: [],
      });
      vi.mocked(readWorkspaceFile).mockResolvedValue({ content: "{}", truncated: false });
      vi.mocked(engineSendMessageSync).mockResolvedValue({
        engine,
        text: JSON.stringify({
          lenses: [
            {
              id: "overview",
              title: "Overview",
              shortTitle: "Overview",
              description: "Project overview",
              status: "detected",
              confidence: "medium",
              evidence: [],
            },
          ],
          nodes: [
            {
              id: "project-core",
              lensId: "overview",
              nodeKind: "concept",
              title: `${engine} generated map`,
              summary: "Generated by selected engine.",
              detail: {
                coreDescription: "Generated by selected engine.",
                keyFacts: [],
                keyLogic: [],
                riskSignals: [],
                relatedArtifacts: [],
              },
              children: [],
              sources: [],
              confidence: "medium",
              stale: false,
              candidate: false,
            },
          ],
        }),
      });

      const result = await runProjectMapGenerationWorker({
        workspaceId: "ws-1",
        dataset,
        run: baseRun({ engine, model: `${engine}-model` }),
        onRunUpdate: async () => {},
      });

      expect(engineSendMessageSync).toHaveBeenCalledWith(
        "ws-1",
        expect.objectContaining({
          engine,
          model: `${engine}-model`,
          accessMode: "read-only",
          continueSession: false,
        }),
      );
      expect(result.nodes[0]).toMatchObject({
        title: `${engine} generated map`,
        generatedBy: {
          engine,
          model: `${engine}-model`,
        },
      });
    },
  );
});
