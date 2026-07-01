// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import type { ConversationState } from "../../threads/contracts/conversationCurtainContracts";
import { Messages } from "./Messages";

vi.mock("./Markdown", () => ({
  Markdown: ({ value, className }: { value: string; className?: string }) => (
    <div className={className}>{value}</div>
  ),
}));

// History collapsing ships effectively disabled in production (window = 10000).
// These behavior tests exercise the collapse/expand logic at its original
// threshold; only the three >30-item cases below are affected.
vi.mock("./messagesRenderUtils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./messagesRenderUtils")>();
  return {
    ...actual,
    VISIBLE_MESSAGE_WINDOW: 30,
  };
});

describe("Messages live behavior", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.setItem("ccgui.claude.hideReasoningModule", "0");
    window.localStorage.removeItem("ccgui.messages.live.autoFollow");
    window.localStorage.removeItem("ccgui.messages.live.collapseMiddleSteps");
  });

  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }
  });

  const getMessagesScroller = (container: HTMLElement) => {
    const scroller = container.querySelector(".messages");
    expect(scroller).toBeTruthy();
    return scroller as HTMLDivElement;
  };

  const setScrollerMetrics = (
    scroller: HTMLDivElement,
    scrollTop: number,
    scrollHeight: number | (() => number) = 2400,
  ) => {
    let currentScrollTop = scrollTop;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => currentScrollTop,
      set: (value: number) => {
        currentScrollTop = value;
      },
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      get: () => (typeof scrollHeight === "function" ? scrollHeight() : scrollHeight),
    });
  };

  it("scrolls the messages container when receiving a jump-to-message event", () => {
    const items: ConversationItem[] = [
      {
        id: "u1",
        kind: "message",
        role: "user",
        text: "older",
      },
      {
        id: "u2",
        kind: "message",
        role: "user",
        text: "latest",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-jump"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const scroller = getMessagesScroller(container);
    const scrollToSpy = vi.spyOn(scroller, "scrollTo");
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      value: 240,
      writable: true,
    });
    Object.defineProperty(scroller, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 120 }),
    });

    const targetNode = container.querySelector('[data-message-anchor-id="u2"]');
    expect(targetNode).toBeTruthy();
    Object.defineProperty(targetNode as HTMLDivElement, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 480 }),
    });

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("ccgui:jump-to-message", {
          detail: "u2",
        }),
      );
    });

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: Math.max(0, 240 + (480 - 120) - 720 * 0.28),
      behavior: "smooth",
    });
  });

  it("ignores the retired mossx jump event name after the ccgui event migration", () => {
    const items: ConversationItem[] = [
      {
        id: "u1",
        kind: "message",
        role: "user",
        text: "older",
      },
      {
        id: "u2",
        kind: "message",
        role: "user",
        text: "latest",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-jump-retired-event"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const scroller = getMessagesScroller(container);
    const scrollToSpy = vi.spyOn(scroller, "scrollTo");

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("mossx:jump-to-message", {
          detail: "u2",
        }),
      );
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("expands collapsed history before jumping to an older message", async () => {
    const items: ConversationItem[] = Array.from({ length: 35 }, (_, index) => ({
      id: `u${index + 1}`,
      kind: "message" as const,
      role: "user" as const,
      text: `message ${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-jump-collapsed"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector('[data-message-anchor-id="u1"]')).toBeNull();
    const showEarlierButton = container.querySelector(".messages-collapsed-indicator");
    expect(showEarlierButton).toBeTruthy();
    expect(showEarlierButton?.getAttribute("data-collapsed-count")).toBe("5");

    const scroller = getMessagesScroller(container);
    const scrollToSpy = vi.spyOn(scroller, "scrollTo");
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      value: 180,
      writable: true,
    });
    Object.defineProperty(scroller, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 120 }),
    });

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("ccgui:jump-to-message", {
          detail: "u1",
        }),
      );
    });

    await waitFor(() => {
      expect(container.querySelector('[data-message-anchor-id="u1"]')).toBeTruthy();
    });

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalled();
    });
    expect(scrollToSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      behavior: "smooth",
    });
  });

  it("keeps only the latest title-only reasoning row for gemini and mirrors it in the working indicator", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-title-only-old",
        kind: "reasoning",
        summary: "Planning old step",
        content: "",
      },
      {
        id: "reasoning-title-only",
        kind: "reasoning",
        summary: "Indexing workspace",
        content: "",
      },
      {
        id: "tool-after-reasoning",
        kind: "tool",
        title: "Command: rg --files",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "",
        status: "running",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="gemini:thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="gemini"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Indexing workspace");
    const reasoningRows = container.querySelectorAll(".thinking-block");
    expect(reasoningRows.length).toBe(1);
    expect(container.querySelector(".thinking-title")).toBeTruthy();
  });

  it("keeps the latest Claude title-only reasoning row on the curtain before the first assistant chunk", () => {
    const items: ConversationItem[] = [
      {
        id: "user-claude-reasoning-visible",
        kind: "message",
        role: "user",
        text: "帮我分析一下项目结构",
      },
      {
        id: "reasoning-claude-old",
        kind: "reasoning",
        summary: "先定位仓库入口",
        content: "",
      },
      {
        id: "reasoning-claude-latest",
        kind: "reasoning",
        summary: "这是一个包含多个子项目的目录。让我探索一下项目结构。",
        content: "",
      },
      {
        id: "tool-claude-read-old",
        kind: "tool",
        title: "批量读取文件 (2)",
        detail: "package.json pyproject.toml",
        toolType: "read",
        output: "",
        status: "completed",
      },
      {
        id: "tool-claude-read-latest",
        kind: "tool",
        title: "批量读取文件 (4)",
        detail: "AGENTS.md next.config.ts README.md",
        toolType: "read",
        output: "",
        status: "running",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="claude:thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const reasoningRows = container.querySelectorAll(".thinking-block");
    expect(reasoningRows.length).toBe(1);
    const reasoningTitle = container.querySelector(".thinking-title");
    expect(reasoningTitle?.textContent ?? "").toBeTruthy();
    expect(container.querySelector(".working-text")?.textContent ?? "").not.toContain(
      "这是一个包含多个子项目的目录。让我探索一下项目结构。",
    );
    expect(container.querySelector(".working-activity")?.textContent ?? "").toContain(
      "批量读取文件 (4)",
    );
  });

  it("renders Claude reasoning and assistant message together when conversation state reuses the same item id", () => {
    const conversationState: ConversationState = {
      items: [
        {
          id: "user-shared-id",
          kind: "message",
          role: "user",
          text: "分析一下这个项目",
        },
        {
          id: "claude-live-shared",
          kind: "reasoning",
          summary: "我先梳理目录结构。",
          content: "我先梳理目录结构。",
        },
        {
          id: "claude-live-shared",
          kind: "message",
          role: "assistant",
          text: "# 项目分析\n\n这里是实时正文。",
        },
      ],
      plan: null,
      userInputQueue: [],
      meta: {
        workspaceId: "ws-1",
        threadId: "claude:thread-shared-id",
        engine: "claude",
        activeTurnId: "turn-1",
        isThinking: true,
        heartbeatPulse: null,
        historyRestoredAtMs: null,
      },
    };

    const { container } = render(
      <Messages
        items={[]}
        threadId="claude:thread-shared-id"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="claude"
        conversationState={conversationState}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(1);
    expect(container.textContent ?? "").toContain("这里是实时正文。");
  });

  it("hides command cards in codex canvas while keeping non-command tool cards", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-codex-command-1",
        kind: "tool",
        title: "Command: pwd && ls -la",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "done",
        status: "completed",
      },
      {
        id: "tool-codex-command-2",
        kind: "tool",
        title: "Command: echo done",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "done",
        status: "completed",
      },
      {
        id: "tool-codex-edit-1",
        kind: "tool",
        title: "Tool: edit",
        detail: JSON.stringify({
          file_path: "src/keep.ts",
          old_string: "before",
          new_string: "after",
        }),
        toolType: "edit",
        status: "completed",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".bash-group-container")).toBeNull();
    expect(container.textContent ?? "").not.toContain("pwd && ls -la");
    expect(container.textContent ?? "").not.toContain("echo done");
    expect(container.textContent ?? "").toContain("keep.ts");
  });

  it("hides command cards in claude canvas", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-claude-command-1",
        kind: "tool",
        title: "Command: pwd && ls -la",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "done",
        status: "completed",
      },
      {
        id: "tool-claude-command-2",
        kind: "tool",
        title: "Command: echo done",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "done",
        status: "completed",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".bash-group-container")).toBeNull();
    expect(container.textContent ?? "").not.toContain("pwd && ls -la");
    expect(container.textContent ?? "").not.toContain("echo done");
  });

  it.each(["codex", "claude", "gemini"] as const)(
    "switches %s working spinner between waiting and ingress phases",
    (activeEngine) => {
      vi.useFakeTimers();
      try {
        const baseItems: ConversationItem[] = [
          {
            id: "user-stream-phase",
            kind: "message",
            role: "user",
            text: "继续输出",
          },
          {
            id: "assistant-stream-phase",
            kind: "message",
            role: "assistant",
            text: "",
          },
        ];

        const { container, rerender } = render(
          <Messages
            items={baseItems}
            threadId="thread-1"
            workspaceId="ws-1"
            isThinking
            processingStartedAt={Date.now() - 1_000}
            activeEngine={activeEngine}
            openTargets={[]}
            selectedOpenAppId=""
          />,
        );

        const waitingNode = container.querySelector(".working");
        expect(waitingNode?.className ?? "").toContain("is-waiting");

        rerender(
          <Messages
            items={[
              baseItems[0]!,
              {
                id: "assistant-stream-phase",
                kind: "message",
                role: "assistant",
                text: "增量片段",
              },
            ]}
            threadId="thread-1"
            workspaceId="ws-1"
            isThinking
            processingStartedAt={Date.now() - 1_000}
            activeEngine={activeEngine}
            openTargets={[]}
            selectedOpenAppId=""
          />,
        );

        const ingressNode = container.querySelector(".working");
        expect(ingressNode?.className ?? "").toContain("is-ingress");

        act(() => {
          vi.advanceTimersByTime(1_200);
        });

        const backToWaitingNode = container.querySelector(".working");
        expect(backToWaitingNode?.className ?? "").toContain("is-waiting");
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("shows a working indicator while context compaction is in progress", () => {
    const { container } = render(
      <Messages
        items={[
          {
            id: "assistant-before-compaction",
            kind: "message",
            role: "assistant",
            text: "已有上下文",
          },
        ]}
        threadId="claude:thread-compact-1"
        workspaceId="ws-1"
        isThinking={false}
        isContextCompacting={true}
        activeEngine="claude"
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingNode = container.querySelector(".working");
    const workingText = container.querySelector(".working-text");
    expect(workingNode).toBeTruthy();
    expect(workingText?.textContent ?? "").toContain("Compacting context");
  });

  it("shows Codex first-text waiting state before assistant text arrives", () => {
    const { container } = render(
      <Messages
        items={[
          {
            id: "user-codex-first-text",
            kind: "message",
            role: "user",
            text: "继续推进",
          },
        ]}
        threadId="codex-thread-first-text"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".working-text")?.textContent ?? "").toContain(
      "messages.codexWaitingForFirstText",
    );
  });

  it("keeps Codex silent suspected state above the first-text waiting state", () => {
    const { container } = render(
      <Messages
        items={[
          {
            id: "user-codex-silent",
            kind: "message",
            role: "user",
            text: "继续推进",
          },
        ]}
        threadId="codex-thread-silent"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 13_000}
        codexSilentSuspectedAt={Date.now() - 1_000}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const label = container.querySelector(".working-text")?.textContent ?? "";
    expect(label).toContain("messages.codexSilentSuspected");
    expect(label).not.toContain("messages.codexWaitingForFirstText");
  });

  it("shows approval resume status as the primary working label for Claude file approvals", () => {
    const { container } = render(
      <Messages
        items={[
          {
            id: "user-approval-resume",
            kind: "message",
            role: "user",
            text: "创建 3 个文件",
          },
          {
            id: "assistant-before-approval",
            kind: "message",
            role: "assistant",
            text: "我会先创建文件。",
            isFinal: true,
          },
          {
            id: "file-approval-running",
            kind: "tool",
            toolType: "fileChange",
            title: "Applying approved file change",
            detail: "{\"file_path\":\"aaa.txt\"}",
            status: "running",
            output: "Approved. Applying the change locally and resuming Claude...",
          },
        ]}
        threadId="claude:thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 800}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".working-text")?.textContent ?? "").toContain(
      "resuming Claude",
    );
    expect(container.querySelector(".working-activity")?.textContent ?? "").toContain(
      "Applying approved file change",
    );
  });

  it.each(["codex", "claude", "gemini"] as const)(
    "detects ingress for %s even when chunk length is unchanged",
    (activeEngine) => {
      vi.useFakeTimers();
      try {
        const { container, rerender } = render(
          <Messages
            items={[
              {
                id: "user-stream-same-length",
                kind: "message",
                role: "user",
                text: "继续输出",
              },
              {
                id: "assistant-stream-same-length",
                kind: "message",
                role: "assistant",
                text: "aaaa",
              },
            ]}
            threadId="thread-1"
            workspaceId="ws-1"
            isThinking
            processingStartedAt={Date.now() - 1_000}
            activeEngine={activeEngine}
            openTargets={[]}
            selectedOpenAppId=""
          />,
        );

        const baselineNode = container.querySelector(".working");
        expect(baselineNode?.className ?? "").toContain("is-waiting");

        rerender(
          <Messages
            items={[
              {
                id: "user-stream-same-length",
                kind: "message",
                role: "user",
                text: "继续输出",
              },
              {
                id: "assistant-stream-same-length",
                kind: "message",
                role: "assistant",
                text: "bbbb",
              },
            ]}
            threadId="thread-1"
            workspaceId="ws-1"
            isThinking
            processingStartedAt={Date.now() - 1_000}
            activeEngine={activeEngine}
            openTargets={[]}
            selectedOpenAppId=""
          />,
        );

        const ingressNode = container.querySelector(".working");
        expect(ingressNode?.className ?? "").toContain("is-ingress");
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("disables auto-follow scrolling when live auto-follow toggle is off", () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "0");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { rerender } = render(
      <Messages
        items={[
          {
            id: "assistant-live-scroll-1",
            kind: "message",
            role: "assistant",
            text: "first chunk",
          },
        ]}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    rerender(
      <Messages
        items={[
          {
            id: "assistant-live-scroll-1",
            kind: "message",
            role: "assistant",
            text: "first chunk",
          },
          {
            id: "assistant-live-scroll-2",
            kind: "message",
            role: "assistant",
            text: "second chunk",
          },
        ]}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("stops auto-follow after the user scrolls up, then resumes at the bottom", async () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const renderWith = (extraChunk: boolean) => (
      <Messages
        items={[
          {
            id: "assistant-live-follow-1",
            kind: "message",
            role: "assistant",
            text: "first chunk",
          },
          ...(extraChunk
            ? [
                {
                  id: "assistant-live-follow-2",
                  kind: "message" as const,
                  role: "assistant" as const,
                  text: "second chunk",
                },
              ]
            : []),
        ]}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith(false));

    const scroller = getMessagesScroller(container);
    // User scrolls up, far from the bottom — auto-follow must release.
    setScrollerMetrics(scroller, 400, 2000);
    fireEvent.scroll(scroller);

    let baselineCalls = scrollSpy.mock.calls.length;
    rerender(renderWith(true));
    await Promise.resolve();
    expect(scrollSpy.mock.calls.length).toBe(baselineCalls);

    // User scrolls back to the bottom — auto-follow re-arms.
    rerender(renderWith(false));
    setScrollerMetrics(scroller, 1280, 2000); // 2000 - 1280 - 720 = 0, at bottom
    fireEvent.scroll(scroller);

    baselineCalls = scrollSpy.mock.calls.length;
    rerender(renderWith(true));
    await waitFor(() => {
      expect(scrollSpy.mock.calls.length).toBeGreaterThan(baselineCalls);
    });
    scrollSpy.mockRestore();
  });

  it("does not auto-follow static history item changes", () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { rerender } = render(
      <Messages
        items={[
          {
            id: "history-static-1",
            kind: "message",
            role: "user",
            text: "历史消息 1",
          },
        ]}
        threadId="thread-history-static"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    rerender(
      <Messages
        items={[
          {
            id: "history-static-1",
            kind: "message",
            role: "user",
            text: "历史消息 1",
          },
          {
            id: "history-static-2",
            kind: "message",
            role: "assistant",
            text: "历史消息 2",
          },
        ]}
        threadId="thread-history-static"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("resets to the revealed history head when expanding collapsed history", async () => {
    const items: ConversationItem[] = Array.from({ length: 32 }, (_, index) => ({
      id: `history-reveal-${index + 1}`,
      kind: "message",
      role: index % 2 === 0 ? "user" : "assistant",
      text: `history reveal message ${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-history-reveal"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const scroller = getMessagesScroller(container);
    setScrollerMetrics(
      scroller,
      420,
      () => (container.querySelector(".messages-collapsed-indicator") ? 2400 : 2560),
    );

    const indicator = container.querySelector(".messages-collapsed-indicator");
    expect(indicator).toBeTruthy();
    if (!indicator) {
      return;
    }

    fireEvent.click(indicator);

    await waitFor(() => {
      expect(container.querySelector(".messages-collapsed-indicator")).toBeNull();
      expect(screen.getByText("history reveal message 1")).toBeTruthy();
      expect(scroller.scrollTop).toBe(0);
    });
  });

  it("keeps manual history expansion stable even when scroller metrics are non-finite", async () => {
    const items: ConversationItem[] = Array.from({ length: 32 }, (_, index) => ({
      id: `history-reveal-invalid-${index + 1}`,
      kind: "message",
      role: index % 2 === 0 ? "user" : "assistant",
      text: `history reveal invalid message ${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-history-reveal-invalid"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const scroller = getMessagesScroller(container);
    setScrollerMetrics(scroller, 420, Number.NaN);

    const indicator = container.querySelector(".messages-collapsed-indicator");
    expect(indicator).toBeTruthy();
    if (!indicator) {
      return;
    }

    fireEvent.click(indicator);

    await waitFor(() => {
      expect(container.querySelector(".messages-collapsed-indicator")).toBeNull();
      expect(screen.getByText("history reveal invalid message 1")).toBeTruthy();
      expect(scroller.scrollTop).toBe(0);
    });
  });

  it("collapses live middle steps when enabled", () => {
    window.localStorage.setItem("ccgui.messages.live.collapseMiddleSteps", "1");
    const items: ConversationItem[] = [
      {
        id: "user-live-collapse",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "reasoning-live-collapse",
        kind: "reasoning",
        summary: "分析中",
        content: "",
      },
      {
        id: "tool-live-collapse",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg --files",
        detail: "/tmp",
        status: "running",
        output: "",
      },
      {
        id: "assistant-live-collapse",
        kind: "message",
        role: "assistant",
        text: "最终输出",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".messages-live-middle-collapsed-indicator")).toBeTruthy();
    expect(container.querySelector(".thinking-block")).toBeNull();
    expect(container.textContent ?? "").toContain("最终输出");
    expect(container.textContent ?? "").not.toContain("Command: rg --files");
  });

  it("excludes hidden commands and batch commands from the live collapsed count", () => {
    window.localStorage.setItem("ccgui.messages.live.collapseMiddleSteps", "1");
    const items: ConversationItem[] = [
      {
        id: "user-live-collapse-count",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "reasoning-live-collapse-count",
        kind: "reasoning",
        summary: "分析中",
        content: "",
      },
      {
        id: "tool-live-collapse-count-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg --files",
        detail: "/tmp",
        status: "running",
        output: "",
      },
      {
        id: "tool-live-collapse-count-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: ls -la",
        detail: "/tmp",
        status: "running",
        output: "",
      },
      {
        id: "assistant-live-collapse-count",
        kind: "message",
        role: "assistant",
        text: "最终输出",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const indicator = container.querySelector(".messages-live-middle-collapsed-indicator");
    expect(indicator?.textContent ?? "").toContain("已折叠 1 条中间步骤（实时中）");
    expect(container.textContent ?? "").not.toContain("Command: rg --files");
    expect(container.textContent ?? "").not.toContain("Command: ls -la");
  });

  it("does not show a live collapsed indicator when only hidden commands were skipped", () => {
    window.localStorage.setItem("ccgui.messages.live.collapseMiddleSteps", "1");
    const items: ConversationItem[] = [
      {
        id: "user-live-collapse-commands-only",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "tool-live-collapse-commands-only-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg --files",
        detail: "/tmp",
        status: "running",
        output: "",
      },
      {
        id: "tool-live-collapse-commands-only-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: ls -la",
        detail: "/tmp",
        status: "running",
        output: "",
      },
      {
        id: "assistant-live-collapse-commands-only",
        kind: "message",
        role: "assistant",
        text: "最终输出",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".messages-live-middle-collapsed-indicator")).toBeNull();
    expect(container.textContent ?? "").toContain("最终输出");
  });

  it("collapses middle steps in history mode when enabled", () => {
    window.localStorage.setItem("ccgui.messages.live.collapseMiddleSteps", "1");
    const items: ConversationItem[] = [
      {
        id: "user-history-collapse",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "reasoning-history-collapse",
        kind: "reasoning",
        summary: "分析中",
        content: "",
      },
      {
        id: "tool-history-collapse",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg --files",
        detail: "/tmp",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-history-collapse",
        kind: "message",
        role: "assistant",
        text: "历史最终输出",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".thinking-block")).toBeNull();
    expect(container.textContent ?? "").toContain("历史最终输出");
    expect(container.textContent ?? "").not.toContain("Command: rg --files");
  });

  it("collapses middle steps for all previous turns in history mode", () => {
    window.localStorage.setItem("ccgui.messages.live.collapseMiddleSteps", "1");
    const items: ConversationItem[] = [
      {
        id: "user-history-turn-1",
        kind: "message",
        role: "user",
        text: "第一个问题",
      },
      {
        id: "reasoning-history-turn-1",
        kind: "reasoning",
        summary: "第一轮分析",
        content: "",
      },
      {
        id: "tool-history-turn-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: ls",
        detail: "/tmp",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-history-turn-1",
        kind: "message",
        role: "assistant",
        text: "第一轮答案",
      },
      {
        id: "user-history-turn-2",
        kind: "message",
        role: "user",
        text: "第二个问题",
      },
      {
        id: "reasoning-history-turn-2",
        kind: "reasoning",
        summary: "第二轮分析",
        content: "",
      },
      {
        id: "tool-history-turn-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg --files",
        detail: "/tmp",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-history-turn-2",
        kind: "message",
        role: "assistant",
        text: "第二轮答案",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.textContent ?? "").toContain("第一轮答案");
    expect(container.textContent ?? "").toContain("第二轮答案");
    expect(container.textContent ?? "").not.toContain("Command: ls");
    expect(container.textContent ?? "").not.toContain("Command: rg --files");
    expect(container.querySelector(".thinking-block")).toBeNull();
  });

  it("shows non-streaming hint for opencode when waiting long for first chunk", () => {
    vi.useFakeTimers();
    try {
      const items: ConversationItem[] = [
        {
          id: "user-latest",
          kind: "message",
          role: "user",
          text: "请解释一下",
        },
      ];

      const { container } = render(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 13_000}
          heartbeatPulse={1}
          activeEngine="opencode"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const hint = container.querySelector(".working-hint");
      expect(hint).toBeTruthy();
      const hintText = (hint?.textContent ?? "").trim();
      expect(hintText.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("updates opencode waiting hint only when heartbeat pulse changes", () => {
    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.05)
      .mockReturnValueOnce(0.85);
    try {
      const items: ConversationItem[] = [
        {
          id: "user-heartbeat",
          kind: "message",
          role: "user",
          text: "继续",
        },
      ];
      const { container, rerender } = render(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 13_000}
          heartbeatPulse={1}
          activeEngine="opencode"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const hint1 = container.querySelector(".working-hint")?.textContent ?? "";
      expect(hint1).toMatch(/(心跳|Heartbeat)\s*1/);

      rerender(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 13_000}
          heartbeatPulse={1}
          activeEngine="opencode"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );
      const hintStable = container.querySelector(".working-hint")?.textContent ?? "";
      expect(hintStable).toBe(hint1);

      rerender(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 13_000}
          heartbeatPulse={2}
          activeEngine="opencode"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );
      const hint2 = container.querySelector(".working-hint")?.textContent ?? "";
      expect(hint2).toMatch(/(心跳|Heartbeat)\s*2/);
      expect(hint2).not.toBe(hint1);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("shows latest backend activity while thinking", () => {
    const items: ConversationItem[] = [
      {
        id: "user-latest-activity",
        kind: "message",
        role: "user",
        text: "帮我检查项目",
      },
      {
        id: "tool-running-activity",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg -n TODO src",
        detail: "/repo",
        status: "running",
        output: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 3_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const activity = container.querySelector(".working-activity");
    expect(activity?.textContent ?? "").toContain("Command: rg -n TODO src @ /repo");
  });

  it("hides duplicated working activity when it mirrors reasoning label", () => {
    const items: ConversationItem[] = [
      {
        id: "user-reasoning-dup-1",
        kind: "message",
        role: "user",
        text: "继续执行",
      },
      {
        id: "reasoning-reasoning-dup-1",
        kind: "reasoning",
        summary: '用户回复了 "A"，表示选择了偏保守重构',
        content: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 3_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("用户回复了");
    expect(container.querySelector(".working-activity")).toBeNull();
  });

  it("does not show stale backend activity from previous turns", () => {
    const items: ConversationItem[] = [
      {
        id: "user-old",
        kind: "message",
        role: "user",
        text: "上一轮",
      },
      {
        id: "tool-old",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: ls -la",
        detail: "/old",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-old",
        kind: "message",
        role: "assistant",
        text: "上一轮结果",
      },
      {
        id: "user-new",
        kind: "message",
        role: "user",
        text: "新一轮问题",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".working-activity")).toBeNull();
  });
});
