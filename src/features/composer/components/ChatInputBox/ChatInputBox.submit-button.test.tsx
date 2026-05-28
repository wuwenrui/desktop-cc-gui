// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatInputBox } from "./ChatInputBox";

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
}

describe("ChatInputBox submit button", () => {
  afterEach(() => {
    cleanup();
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
});
