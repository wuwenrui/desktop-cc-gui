import { describe, expect, it } from "vitest";
import {
  resolveMessagesAutoFollowAfterScroll,
  resolveMessagesBottomScrollTop,
} from "./messagesViewModel";

describe("messagesViewModel scroll helpers", () => {
  it("scrolls to the vertical bottom without overshooting the scroller range", () => {
    expect(resolveMessagesBottomScrollTop({ scrollHeight: 2400, clientHeight: 720 })).toBe(1680);
    expect(resolveMessagesBottomScrollTop({ scrollHeight: 480, clientHeight: 720 })).toBe(0);
  });

  it("keeps following when the user scrolls downward back near the bottom", () => {
    expect(
      resolveMessagesAutoFollowAfterScroll({
        previousScrollTop: 200,
        nextScrollTop: 280,
        nearBottom: true,
      }),
    ).toBe(true);
  });

  it("pauses following when the user scrolls upward even inside the bottom threshold", () => {
    expect(
      resolveMessagesAutoFollowAfterScroll({
        previousScrollTop: 280,
        nextScrollTop: 220,
        nearBottom: true,
      }),
    ).toBe(false);
  });
});
