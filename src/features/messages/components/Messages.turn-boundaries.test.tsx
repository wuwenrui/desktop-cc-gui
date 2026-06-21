// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";

vi.mock("./Markdown", () => ({
  Markdown: ({ value, className }: { value: string; className?: string }) => (
    <div className={className}>{value}</div>
  ),
}));

describe("Messages turn boundaries", () => {
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
  });

  it("shows reasoning boundary when grouped tool entries exist before final message", () => {
    const items: ConversationItem[] = [
      {
        id: "user-tool-group-1",
        kind: "message",
        role: "user",
        text: "Q1",
      },
      {
        id: "tool-group-1",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "tool: read_file",
        detail: "read",
        status: "completed",
      },
      {
        id: "tool-group-2",
        kind: "tool",
        toolType: "mcpToolCall",
        title: "tool: read_file",
        detail: "read",
        status: "completed",
      },
      {
        id: "assistant-tool-group-final-1",
        kind: "message",
        role: "assistant",
        text: "A1",
        isFinal: true,
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

    const reasoningBoundaryNode = container.querySelector(".messages-reasoning-boundary");
    expect(reasoningBoundaryNode).toBeTruthy();
    expect(reasoningBoundaryNode?.textContent ?? "").toContain("Thinking Process");
  });

  it("does not show reasoning boundary when only hidden command cards exist before final message", () => {
    window.localStorage.setItem("ccgui.messages.live.collapseMiddleSteps", "1");
    const items: ConversationItem[] = [
      {
        id: "user-hidden-command-1",
        kind: "message",
        role: "user",
        text: "Q1",
      },
      {
        id: "tool-hidden-command-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg --files",
        detail: "/tmp",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-hidden-command-final-1",
        kind: "message",
        role: "assistant",
        text: "A1",
        isFinal: true,
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

    expect(container.querySelector(".messages-reasoning-boundary")).toBeNull();
    expect(container.querySelector(".messages-final-boundary")).toBeTruthy();
    expect(container.querySelector(".messages-final-boundary")?.textContent ?? "").toContain(
      "Final Message",
    );
    expect(container.textContent ?? "").not.toContain("Command: rg --files");
  });

  it("renders final and reasoning boundaries only once for the last final assistant in a turn", () => {
    const items: ConversationItem[] = [
      {
        id: "user-turn-1",
        kind: "message",
        role: "user",
        text: "Q1",
      },
      {
        id: "reasoning-turn-1",
        kind: "reasoning",
        summary: "先分析",
        content: "处理中间步骤",
      },
      {
        id: "assistant-final-mid",
        kind: "message",
        role: "assistant",
        text: "中间状态",
        isFinal: true,
      },
      {
        id: "assistant-final-last",
        kind: "message",
        role: "assistant",
        text: "最终结果",
        isFinal: true,
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

    const finalBoundaries = container.querySelectorAll(".messages-final-boundary");
    const reasoningBoundaries = container.querySelectorAll(".messages-reasoning-boundary");
    const finalMidNode = container.querySelector("[data-message-anchor-id='assistant-final-mid']");
    const finalLastNode = container.querySelector("[data-message-anchor-id='assistant-final-last']");
    expect(finalBoundaries).toHaveLength(1);
    expect(reasoningBoundaries).toHaveLength(1);
    expect(finalMidNode).toBeTruthy();
    expect(finalLastNode).toBeTruthy();
    if (finalMidNode && finalLastNode && finalBoundaries[0] && reasoningBoundaries[0]) {
      expect(
        finalMidNode.compareDocumentPosition(finalBoundaries[0]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        finalLastNode.compareDocumentPosition(finalBoundaries[0]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        reasoningBoundaries[0].compareDocumentPosition(finalLastNode) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("hides final boundary for the active live turn while keeping completed turn boundaries visible", () => {
    const items: ConversationItem[] = [
      {
        id: "user-turn-done",
        kind: "message",
        role: "user",
        text: "Q1",
      },
      {
        id: "assistant-turn-done",
        kind: "message",
        role: "assistant",
        text: "A1",
        isFinal: true,
      },
      {
        id: "user-turn-live",
        kind: "message",
        role: "user",
        text: "Q2",
      },
      {
        id: "reasoning-turn-live",
        kind: "reasoning",
        summary: "分析中",
        content: "处理中",
      },
      {
        id: "assistant-turn-live",
        kind: "message",
        role: "assistant",
        text: "A2",
        isFinal: true,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const finalBoundaries = container.querySelectorAll(".messages-final-boundary");
    const reasoningBoundaries = container.querySelectorAll(".messages-reasoning-boundary");
    const doneAssistantNode = container.querySelector("[data-message-anchor-id='assistant-turn-done']");
    const liveAssistantNode = container.querySelector("[data-message-anchor-id='assistant-turn-live']");
    expect(finalBoundaries).toHaveLength(1);
    expect(reasoningBoundaries).toHaveLength(0);
    expect(doneAssistantNode).toBeTruthy();
    expect(liveAssistantNode).toBeTruthy();
    if (doneAssistantNode && liveAssistantNode && finalBoundaries[0]) {
      expect(
        doneAssistantNode.compareDocumentPosition(finalBoundaries[0]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        liveAssistantNode.compareDocumentPosition(finalBoundaries[0]) &
          Node.DOCUMENT_POSITION_PRECEDING,
      ).toBeTruthy();
    }
  });

  it("shows completion time without total duration on final boundary", () => {
    const completedAt = new Date(2026, 3, 1, 10, 20, 30).getTime();
    const items: ConversationItem[] = [
      {
        id: "assistant-final-meta-1",
        kind: "message",
        role: "assistant",
        text: "A1",
        isFinal: true,
        finalCompletedAt: completedAt,
        finalDurationMs: 12_000,
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

    const finalMeta = container.querySelector(".messages-turn-boundary-meta");
    expect(finalMeta?.textContent ?? "").toContain("04-01 10:20:30");
    expect(finalMeta?.textContent ?? "").not.toContain("总耗时");
  });

  it("renders final boundary without reasoning boundary when no process items exist", () => {
    const items: ConversationItem[] = [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "Q1",
      },
      {
        id: "assistant-final-1",
        kind: "message",
        role: "assistant",
        text: "A1",
        isFinal: true,
      },
      {
        id: "user-2",
        kind: "message",
        role: "user",
        text: "Q2",
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

    const finalMessageNode = container.querySelector(
      "[data-message-anchor-id='assistant-final-1']",
    );
    const reasoningBoundaryNode = container.querySelector(".messages-reasoning-boundary");
    const boundaryNode = container.querySelector(".messages-final-boundary");
    const boundaryMetaNode = container.querySelector(
      ".messages-final-boundary .messages-turn-boundary-meta",
    );
    expect(finalMessageNode).toBeTruthy();
    expect(reasoningBoundaryNode).toBeNull();
    expect(boundaryNode).toBeTruthy();
    expect(boundaryMetaNode).toBeNull();
    if (finalMessageNode && boundaryNode) {
      expect(
        finalMessageNode.compareDocumentPosition(boundaryNode) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("shows reasoning boundary when visible process items exist before final message", () => {
    const completedAt = new Date(2026, 3, 10, 14, 41, 42).getTime();
    const items: ConversationItem[] = [
      {
        id: "user-process-1",
        kind: "message",
        role: "user",
        text: "Q1",
      },
      {
        id: "reasoning-process-1",
        kind: "reasoning",
        summary: "先分析",
        content: "检查变更范围",
      },
      {
        id: "assistant-process-final-1",
        kind: "message",
        role: "assistant",
        text: "A1",
        isFinal: true,
        finalCompletedAt: completedAt,
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

    const finalMessageNode = container.querySelector(
      "[data-message-anchor-id='assistant-process-final-1']",
    );
    const reasoningBoundaryNode = container.querySelector(".messages-reasoning-boundary");
    const reasoningBoundaryMetaNode = container.querySelector(
      ".messages-reasoning-boundary .messages-turn-boundary-meta",
    );
    const finalBoundaryMetaNode = container.querySelector(
      ".messages-final-boundary .messages-turn-boundary-meta",
    );
    expect(finalMessageNode).toBeTruthy();
    expect(reasoningBoundaryNode).toBeTruthy();
    expect(reasoningBoundaryNode?.textContent ?? "").toContain("Thinking Process");
    expect(reasoningBoundaryMetaNode?.textContent ?? "").toContain("04-10 14:41:42");
    expect(reasoningBoundaryMetaNode?.getAttribute("aria-hidden")).toBe("true");
    expect(reasoningBoundaryMetaNode?.textContent).toBe(finalBoundaryMetaNode?.textContent);
    if (finalMessageNode && reasoningBoundaryNode) {
      expect(
        reasoningBoundaryNode.compareDocumentPosition(finalMessageNode) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });
});
