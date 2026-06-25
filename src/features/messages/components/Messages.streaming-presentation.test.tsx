// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import type { GroupedEntry } from "../utils/groupToolItems";

const timelineSnapshots = vi.hoisted(() => ({
  entries: [] as Array<{
    assistantFinalBoundaryIds: string[];
    renderedTexts: string[];
    threadId: string | null;
    liveAssistantIsFinal: boolean | null;
    liveAssistantText: string | null;
  }>,
}));

function collectGroupedEntryTexts(entries: GroupedEntry[]) {
  return entries.flatMap((entry) => {
    if (entry.kind === "item") {
      return entry.item.kind === "message" ? [entry.item.text] : [];
    }
    return entry.items.flatMap((item) => [item.title, item.output ?? ""]);
  });
}

vi.mock("./MessagesTimeline", () => ({
  MessagesTimeline: (props: {
    assistantFinalBoundarySet: Set<string>;
    groupedEntries: GroupedEntry[];
    threadId: string | null;
    liveAssistantItem: Extract<ConversationItem, { kind: "message" }> | null;
  }) => {
    timelineSnapshots.entries.push({
      assistantFinalBoundaryIds: Array.from(props.assistantFinalBoundarySet),
      renderedTexts: collectGroupedEntryTexts(props.groupedEntries),
      threadId: props.threadId,
      liveAssistantIsFinal: props.liveAssistantItem?.isFinal ?? null,
      liveAssistantText: props.liveAssistantItem?.text ?? null,
    });
    return <div data-testid="messages-timeline-probe" />;
  },
}));

vi.mock("./Markdown", () => ({
  Markdown: ({ value, className }: { value: string; className?: string }) => (
    <div className={className}>{value}</div>
  ),
}));

import { Messages } from "./Messages";

describe("Messages streaming presentation contract", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    timelineSnapshots.entries = [];
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

  it("keeps heavy timeline derivations on the stable snapshot while the live assistant row updates immediately", async () => {
    const liveAssistantItem: Extract<ConversationItem, { kind: "message" }> = {
      id: "assistant-1",
      kind: "message",
      role: "assistant",
      text: "第一段输出",
      isFinal: false,
    };
    const initialItems: ConversationItem[] = [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "继续分析",
      },
      liveAssistantItem,
    ];

    const view = render(
      <Messages
        items={initialItems}
        threadId="thread-stream-contract"
        workspaceId="ws-1"
        isThinking
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    timelineSnapshots.entries = [];

    view.rerender(
      <Messages
        items={[
          initialItems[0],
          {
            ...liveAssistantItem,
            text: "第一段输出\n\n第二段输出",
            isFinal: true,
          },
        ]}
        threadId="thread-stream-contract"
        workspaceId="ws-1"
        isThinking
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(
      timelineSnapshots.entries.some(
        (entry) =>
          entry.liveAssistantText === "第一段输出\n\n第二段输出"
          && entry.liveAssistantIsFinal === true
          && entry.assistantFinalBoundaryIds.length === 0,
      ),
    ).toBe(true);

    await waitFor(() => {
      expect(
        timelineSnapshots.entries.some((entry) =>
          entry.assistantFinalBoundaryIds.includes("assistant-1")
        ),
      ).toBe(true);
    });
  });

  it("does not reuse a stable presentation snapshot after switching threads", () => {
    const threadAItems: ConversationItem[] = [
      {
        id: "user-a",
        kind: "message",
        role: "user",
        text: "分析 A 会话",
      },
      {
        id: "assistant-a",
        kind: "message",
        role: "assistant",
        text: "A 会话的最终总结",
        isFinal: true,
      },
    ];
    const threadBItems: ConversationItem[] = [
      {
        id: "user-b",
        kind: "message",
        role: "user",
        text: "分析 B 会话",
      },
      {
        id: "assistant-b",
        kind: "message",
        role: "assistant",
        text: "B 会话正在输出",
        isFinal: false,
      },
    ];

    const view = render(
      <Messages
        items={threadAItems}
        threadId="thread-a"
        workspaceId="ws-1"
        isThinking
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    timelineSnapshots.entries = [];

    view.rerender(
      <Messages
        items={threadBItems}
        threadId="thread-b"
        workspaceId="ws-1"
        isThinking
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const threadBSnapshots = timelineSnapshots.entries.filter(
      (entry) => entry.threadId === "thread-b",
    );
    expect(threadBSnapshots.length).toBeGreaterThan(0);
    expect(
      threadBSnapshots.some((entry) =>
        entry.renderedTexts.some((text) => text.includes("A 会话")),
      ),
    ).toBe(false);
    expect(
      threadBSnapshots.some((entry) =>
        entry.renderedTexts.some((text) => text.includes("B 会话")),
      ),
    ).toBe(true);
  });
});
