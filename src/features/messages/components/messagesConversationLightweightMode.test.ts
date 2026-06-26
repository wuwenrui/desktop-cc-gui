import { describe, expect, it } from "vitest";
import {
  addBoundedConversationRenderModeKey,
  CONVERSATION_LIGHTWEIGHT_SUGGEST_HEAVY_ROWS,
  CONVERSATION_LIGHTWEIGHT_SUGGEST_RENDER_WEIGHT,
  CONVERSATION_OVERSIZED_HISTORY_RENDER_WEIGHT,
  CONVERSATION_OVERSIZED_HISTORY_ROWS,
  resolveConversationLightweightModeState,
  resolveConversationLightweightPolicy,
} from "./messagesConversationLightweightMode";

describe("messagesConversationLightweightMode", () => {
  it("suggests lightweight mode for render-heavy timelines below oversized thresholds", () => {
    const policy = resolveConversationLightweightPolicy({
      rowCount: 24,
      renderWeight: CONVERSATION_LIGHTWEIGHT_SUGGEST_RENDER_WEIGHT,
      heavyRowCount: 1,
    });

    expect(policy).toEqual({ suggested: true, oversized: false });
  });

  it("suggests lightweight mode for repeated heavy rows", () => {
    const policy = resolveConversationLightweightPolicy({
      rowCount: 24,
      renderWeight: 64,
      heavyRowCount: CONVERSATION_LIGHTWEIGHT_SUGGEST_HEAVY_ROWS,
    });

    expect(policy).toEqual({ suggested: true, oversized: false });
  });

  it("marks severe histories as oversized by row count or render weight", () => {
    expect(
      resolveConversationLightweightPolicy({
        rowCount: CONVERSATION_OVERSIZED_HISTORY_ROWS,
        renderWeight: 1,
        heavyRowCount: 0,
      }),
    ).toEqual({ suggested: true, oversized: true });
    expect(
      resolveConversationLightweightPolicy({
        rowCount: 1,
        renderWeight: CONVERSATION_OVERSIZED_HISTORY_RENDER_WEIGHT,
        heavyRowCount: 0,
      }),
    ).toEqual({ suggested: true, oversized: true });
  });

  it("keeps oversized histories lightweight until the user requests detail hydration", () => {
    const policy = { suggested: true, oversized: true };

    expect(
      resolveConversationLightweightModeState({
        policy,
        manualEnabled: false,
        detailHydrationRequested: false,
      }),
    ).toEqual({ active: true, reason: "oversized" });
    expect(
      resolveConversationLightweightModeState({
        policy,
        manualEnabled: false,
        detailHydrationRequested: true,
      }),
    ).toEqual({ active: false, reason: "inactive" });
  });

  it("honors manual lightweight mode even after detail hydration was requested", () => {
    expect(
      resolveConversationLightweightModeState({
        policy: { suggested: false, oversized: false },
        manualEnabled: true,
        detailHydrationRequested: true,
      }),
    ).toEqual({ active: true, reason: "manual" });
  });

  it("bounds remembered conversation render mode keys", () => {
    const first = addBoundedConversationRenderModeKey(new Set(["a", "b", "c"]), "d", 3);
    expect([...first]).toEqual(["b", "c", "d"]);

    const repeated = addBoundedConversationRenderModeKey(first, "d", 3);
    expect(repeated).toBe(first);
  });
});
