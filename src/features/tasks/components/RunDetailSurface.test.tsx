// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RunDetailSurface } from "./RunDetailSurface";
import type { TaskRunRecord } from "../types";

function makeRun(overrides: Partial<TaskRunRecord> = {}): TaskRunRecord {
  return {
    runId: "run-1",
    task: {
      taskId: "task-1",
      source: "kanban",
      workspaceId: "ws-1",
      title: "Review cockpit",
    },
    engine: "codex",
    status: "running",
    trigger: "manual",
    linkedThreadId: "thread-1",
    currentStep: "Checking detail state",
    latestOutputSummary: "Detail model is shared",
    blockedReason: null,
    failureReason: null,
    artifacts: [{ kind: "summary", label: "Run summary" }],
    availableRecoveryActions: ["open_conversation", "retry"],
    updatedAt: 20,
    ...overrides,
  };
}

describe("RunDetailSurface", () => {
  it("renders shared run details, browser evidence, and supported actions only", () => {
    const handleOpenConversation = vi.fn();
    const handleRetryRun = vi.fn();
    const run = makeRun({
      browserEvidence: {
        attachmentId: "attachment-1",
        browserSessionId: "browser-1",
        snapshotId: "snapshot-1",
        url: "https://example.com/cockpit",
        title: "Cockpit evidence",
        capturedAt: 100,
        state: "available",
        diagnostics: ["selector matched"],
        codeCandidates: [
          {
            filePath: "src/features/home/components/HomeChat.tsx",
            reason: "component_symbol_match",
            confidence: "high",
          },
        ],
      },
    });

    render(
      <RunDetailSurface
        run={run}
        comparisonRuns={[run]}
        onOpenConversation={handleOpenConversation}
        onRetryRun={handleRetryRun}
      />,
    );

    expect(screen.getByText("Review cockpit")).toBeTruthy();
    expect(screen.getByText("Checking detail state")).toBeTruthy();
    expect(screen.getByText("Run summary")).toBeTruthy();
    expect(screen.getByText(/Cockpit evidence/)).toBeTruthy();
    expect(screen.getByText(/selector matched/)).toBeTruthy();
    expect(screen.queryByText("taskCenter.action.cancel")).toBeNull();

    fireEvent.click(screen.getByText("taskCenter.action.openConversation"));
    fireEvent.click(screen.getByText("taskCenter.action.retry"));

    expect(handleOpenConversation).toHaveBeenCalledWith("thread-1");
    expect(handleRetryRun).toHaveBeenCalledWith(run);
  });

  it("uses honest empty states when no linked evidence or conversation exists", () => {
    render(
      <RunDetailSurface
        run={makeRun({
          linkedThreadId: null,
          browserEvidence: null,
          artifacts: [],
          availableRecoveryActions: [],
        })}
      />,
    );

    expect(screen.getByText("taskCenter.noBrowserEvidence")).toBeTruthy();
    expect(screen.getByText("taskCenter.noArtifacts")).toBeTruthy();
    expect(screen.queryByText("taskCenter.action.openConversation")).toBeNull();
  });
});
