// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";

vi.mock("./Markdown", () => ({
  Markdown: ({ value, className }: { value: string; className?: string }) => (
    <div className={className}>{value}</div>
  ),
}));

describe("Messages codex live streaming", () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("renders large codex assistant streaming output on the live Markdown surface", () => {
    const assistantText = Array.from(
      { length: 14 },
      (_, index) => `- 第 ${index + 1} 条审计结论：这是长段 streaming 输出`,
    ).join("\n");
    const items: ConversationItem[] = [
      {
        id: "user-codex-live-1",
        kind: "message",
        role: "user",
        text: "继续做项目审计",
      },
      {
        id: "assistant-codex-live-1",
        kind: "message",
        role: "assistant",
        text: assistantText,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-codex-live-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const liveSurface = container.querySelector(".message.assistant .markdown-live-streaming");
    expect(liveSurface).toBeTruthy();
    const plainTextSurface = container.querySelector(
      ".message.assistant .markdown-live-plain-text",
    );
    expect(plainTextSurface).toBeNull();
    expect(liveSurface?.textContent).toContain("第 14 条审计结论");
    expect(container.querySelector(".message.assistant.is-live-streaming")).toBeTruthy();
  });
});
