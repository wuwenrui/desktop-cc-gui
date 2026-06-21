// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";

const baseItem: ConversationItem = {
  id: "user-1",
  kind: "message",
  role: "user",
  text: "hello",
};

const baseProps = {
  workspaceId: "ws-1",
  items: [baseItem],
  plan: null,
  userInputRequests: [],
  heartbeatPulse: 0,
  expandedItems: new Set<string>(),
  toggleExpanded: () => {},
  copiedMessageId: null,
  setCopiedMessageId: () => {},
  onAssistantVisibleTextRender: undefined,
  onShowAllHistoryItems: () => {},
  pendingJumpMessageId: null,
  setPendingJumpMessageId: () => {},
  liveAutoFollowEnabled: true,
  setLiveAutoFollowEnabled: () => {},
  collapseLiveMiddleStepsEnabled: true,
  setCollapseLiveMiddleStepsEnabled: () => {},
  isMacDesktop: false,
  isWindowsDesktop: false,
  showFileLinkMenu: undefined,
  onOpenDiffPath: undefined,
  openTargets: [] as Array<{ id: string; label: string; isPrimary?: boolean; kind: "app" | "command" | "finder"; args: string[] }>,
  selectedOpenAppId: "" as string,
  openFileLink: undefined,
  hiddenClaudeReasoningOnly: false,
};

describe("Messages transient timer cleanup on threadId change", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }
  });
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.removeItem("ccgui.messages.live.autoFollow");
    window.localStorage.removeItem("ccgui.messages.live.collapseMiddleSteps");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls cancelAnimationFrame and clearTimeout at least once when active threadId changes", () => {
    const cafSpy = vi.spyOn(window, "cancelAnimationFrame");
    const clearSpy = vi.spyOn(window, "clearTimeout");
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");

    try {
      const { rerender } = render(
        <Messages {...baseProps} threadId="thread-A" isThinking={false} />,
      );
      act(() => {
        rafSpy.mockImplementationOnce(((_cb: FrameRequestCallback) => {
          return 1 as unknown as number;
        }) as typeof window.requestAnimationFrame);
        window.requestAnimationFrame(() => {});
        rafSpy.mockImplementationOnce(((_cb: FrameRequestCallback) => {
          return 2 as unknown as number;
        }) as typeof window.requestAnimationFrame);
        window.requestAnimationFrame(() => {});
        window.setTimeout(() => {}, 100);
      });
      rerender(
        <Messages {...baseProps} threadId="thread-B" isThinking={false} />,
      );
      expect(cafSpy).toHaveBeenCalled();
      expect(clearSpy).toHaveBeenCalled();
    } finally {
      rafSpy.mockRestore();
      cafSpy.mockRestore();
      clearSpy.mockRestore();
    }
  });
});
