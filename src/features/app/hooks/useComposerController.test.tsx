// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useComposerController } from "./useComposerController";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../composer/hooks/useComposerImages", () => ({
  useComposerImages: () => ({
    activeImages: [],
    attachImages: vi.fn(),
    pickImages: vi.fn(),
    removeImage: vi.fn(),
    clearActiveImages: vi.fn(),
    setImagesForThread: vi.fn(),
    removeImagesForThread: vi.fn(),
  }),
}));

vi.mock("../../threads/hooks/useQueuedSend", () => ({
  useQueuedSend: () => ({
    activeQueue: [],
    activeQueuedHandoffBubble: null,
    handleSend: vi.fn(),
    queueMessage: vi.fn(),
    removeQueuedMessage: vi.fn(),
    fuseQueuedMessage: vi.fn(),
    canFuseActiveQueue: false,
    activeFusingMessageId: null,
  }),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function makeOptions(
  overrides: Partial<Parameters<typeof useComposerController>[0]> = {},
): Parameters<typeof useComposerController>[0] {
  return {
    activeThreadId: "thread-1",
    activeTurnId: null,
    activeContinuationPulse: 0,
    activeTerminalPulse: 0,
    activeWorkspaceId: workspace.id,
    activeWorkspace: workspace,
    isProcessing: false,
    isReviewing: false,
    steerEnabled: false,
    activeEngine: "codex",
    connectWorkspace: vi.fn(async () => undefined),
    startThreadForWorkspace: vi.fn(async () => "thread-1"),
    sendUserMessage: vi.fn(async () => undefined),
    sendUserMessageToThread: vi.fn(async () => undefined),
    handleFusionStalled: vi.fn(),
    startFork: vi.fn(async () => undefined),
    startReview: vi.fn(async () => undefined),
    startResume: vi.fn(async () => undefined),
    startMcp: vi.fn(async () => undefined),
    startSpecRoot: vi.fn(async () => undefined),
    startStatus: vi.fn(async () => undefined),
    startContext: vi.fn(async () => undefined),
    startExport: vi.fn(async () => undefined),
    startImport: vi.fn(async () => undefined),
    startLsp: vi.fn(async () => undefined),
    startShare: vi.fn(async () => undefined),
    startCompact: vi.fn(async () => undefined),
    startFast: vi.fn(async () => undefined),
    startMode: vi.fn(async () => undefined),
    setCodexCollaborationMode: vi.fn(),
    getCodexCollaborationMode: vi.fn(() => null),
    getCodexCollaborationPayload: vi.fn(() => null),
    interruptTurn: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("useComposerController input responsiveness", () => {
  it("updates the active thread draft in the same interaction turn", () => {
    const { result } = renderHook(() =>
      useComposerController(makeOptions({ activeThreadId: "thread-1" })),
    );

    act(() => {
      result.current.handleDraftChange("typed without lag");
    });

    expect(result.current.activeDraft).toBe("typed without lag");
  });

  it("keeps detached draft updates immediate as well", () => {
    const { result } = renderHook(() =>
      useComposerController(makeOptions({ activeThreadId: null })),
    );

    act(() => {
      result.current.handleDraftChange("detached typed text");
    });

    expect(result.current.activeDraft).toBe("detached typed text");
  });
});
