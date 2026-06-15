// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { Messages } from "./Messages";

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

vi.mock("./Markdown", () => ({
  Markdown: ({ value }: { value: string }) => (
    <div className="markdown">{value}</div>
  ),
}));

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

afterEach(() => {
  cleanup();
});

describe("Messages shared session provenance", () => {
  it("renders per-message provenance badge for assistant messages", async () => {
    const items: ConversationItem[] = [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "Compare two implementations",
      },
      {
        id: "assistant-1",
        kind: "message",
        role: "assistant",
        text: "Codex answer",
        engineSource: "codex",
      },
      {
        id: "assistant-2",
        kind: "message",
        role: "assistant",
        text: "Claude answer",
        engineSource: "claude",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="shared:thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(await screen.findByText("Codex")).toBeTruthy();
    expect(await screen.findByText("Claude")).toBeTruthy();
  });
});
