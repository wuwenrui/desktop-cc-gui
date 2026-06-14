// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatInputBox } from "./ChatInputBox";

const rangeGetBoundingClientRect = Range.prototype.getBoundingClientRect;

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    initReactI18next: {
      type: "3rdParty" as const,
      init: () => {},
    },
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

function setEditableText(editable: HTMLDivElement, text: string) {
  editable.innerText = text;
  let textNode = editable.firstChild as Text | null;
  if (!(textNode instanceof Text)) {
    textNode = document.createTextNode(text);
    editable.innerHTML = "";
    editable.appendChild(textNode);
  }
  textNode.textContent = text;

  const range = document.createRange();
  range.setStart(textNode, text.length);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe("ChatInputBox submit button", () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: rangeGetBoundingClientRect,
    });
  });

  it("enables the send button immediately after plain text input", () => {
    render(<ChatInputBox showHeader={false} />);

    const editable = document.querySelector(".input-editable") as HTMLDivElement | null;
    expect(editable).toBeTruthy();
    if (!editable) {
      return;
    }

    const sendButton = screen.getByTitle("chat.sendMessageEnter") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);

    editable.focus();
    setEditableText(editable, "00000000000000000000");
    fireEvent.input(editable);

    expect(sendButton.disabled).toBe(false);
  });

  it("shows skill display names in the dollar completion dropdown", async () => {
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 1, 20),
    });
    render(
      <ChatInputBox
        showHeader={false}
        skillCompletionProvider={async () => [
          {
            name: "criminal-defense-workflow",
            displayName: "刑事辩护全流程",
            path: "/Users/me/.claude/skills/criminal-defense-workflow/SKILL.md",
            source: "global_claude",
          },
        ]}
      />,
    );

    const editable = document.querySelector(".input-editable") as HTMLDivElement | null;
    expect(editable).toBeTruthy();
    if (!editable) {
      return;
    }

    editable.focus();
    setEditableText(editable, "$");
    fireEvent.input(editable);

    await waitFor(() => {
      expect(screen.getByText("刑事辩护全流程")).toBeTruthy();
    });
    expect(screen.queryByText("criminal-defense-workflow")).toBeNull();
  });
});
