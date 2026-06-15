// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { RequestUserInputRequest } from "../../../types";
import { focusUserInputRequestCard } from "./userInputRequestFocus";

function makeRequest(): RequestUserInputRequest {
  return {
    request_id: "req-1",
    workspace_id: "workspace-1",
    params: {
      thread_id: "thread-1",
      turn_id: "turn-1",
      item_id: "item-1",
      questions: [],
    },
  };
}

describe("focusUserInputRequestCard", () => {
  it("keeps the messages scroller pinned horizontally when focusing a request card", () => {
    document.body.innerHTML = `
      <div class="messages">
        <div
          data-request-user-input-id="req-1"
          data-workspace-id="workspace-1"
          data-thread-id="thread-1"
          tabindex="-1"
        ></div>
      </div>
    `;
    const scroller = document.querySelector<HTMLElement>(".messages");
    const card = document.querySelector<HTMLElement>("[data-request-user-input-id]");
    if (!scroller || !card) {
      throw new Error("missing test DOM");
    }
    scroller.scrollLeft = 240;
    scroller.scrollTop = 100;
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 400,
    });
    scroller.getBoundingClientRect = vi.fn(() => ({
      bottom: 500,
      height: 400,
      left: 0,
      right: 750,
      top: 100,
      width: 750,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    }));
    card.getBoundingClientRect = vi.fn(() => ({
      bottom: 420,
      height: 160,
      left: 40,
      right: 720,
      top: 260,
      width: 680,
      x: 40,
      y: 260,
      toJSON: () => ({}),
    }));
    const scrollTo = vi.fn((options?: ScrollToOptions) => {
      scroller.scrollTop = Number(options?.top ?? scroller.scrollTop);
      scroller.scrollLeft = Number(options?.left ?? scroller.scrollLeft);
    });
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
    card.scrollIntoView = vi.fn(() => {
      scroller.scrollLeft = 240;
    });
    card.focus = vi.fn();

    expect(focusUserInputRequestCard(makeRequest())).toBe(true);

    expect(card.scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      left: 0,
      top: 140,
    });
    expect(scroller.scrollLeft).toBe(0);
    expect(card.focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});
