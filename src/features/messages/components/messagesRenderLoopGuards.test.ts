import { describe, expect, it } from "vitest";
import {
  DEFAULT_HYDRATION_REMEASURE_BUDGET,
  DEFAULT_RENDER_LOOP_GUARD_BUDGET,
  resolveHydrationRemeasureGuard,
  resolveIdempotentRenderLoopGuard,
} from "./messagesRenderLoopGuards";

describe("messagesRenderLoopGuards", () => {
  it("suppresses equivalent overlay state writes and rate-limits diagnostics", () => {
    let budget = DEFAULT_RENDER_LOOP_GUARD_BUDGET;

    for (let index = 0; index < 11; index += 1) {
      const guard = resolveIdempotentRenderLoopGuard({
        previous: budget,
        signature: "anchor:scroll:u1",
        changed: false,
        now: index * 100,
        threshold: 3,
        diagnosticCooldownMs: 1_000,
      });
      budget = guard.nextBudget;
      expect(guard.shouldCommit).toBe(false);
    }

    expect(budget.count).toBe(11);
    expect(budget.lastDiagnosticAt).toBe(1_000);

    const changedGuard = resolveIdempotentRenderLoopGuard({
      previous: budget,
      signature: "anchor:scroll:u2",
      changed: true,
      now: 2_000,
    });

    expect(changedGuard.shouldCommit).toBe(true);
    expect(changedGuard.nextBudget).toBe(DEFAULT_RENDER_LOOP_GUARD_BUDGET);
  });

  it("bounds hydration remeasure attempts for one hydrated heavy row signature", () => {
    let budget = DEFAULT_HYDRATION_REMEASURE_BUDGET;

    const first = resolveHydrationRemeasureGuard({
      previous: budget,
      signature: "row:a",
      hydratedHeavyRowCount: 2,
      now: 1_000,
      maxRemeasureCount: 2,
      remeasureCooldownMs: 1,
      diagnosticCooldownMs: 1,
    });
    expect(first.shouldRemeasure).toBe(true);
    budget = first.nextBudget;

    const second = resolveHydrationRemeasureGuard({
      previous: budget,
      signature: "row:a",
      hydratedHeavyRowCount: 2,
      now: 2_000,
      maxRemeasureCount: 2,
      remeasureCooldownMs: 1,
      diagnosticCooldownMs: 1,
    });
    expect(second.shouldRemeasure).toBe(true);
    budget = second.nextBudget;

    const suppressed = resolveHydrationRemeasureGuard({
      previous: budget,
      signature: "row:a",
      hydratedHeavyRowCount: 2,
      now: 3_000,
      maxRemeasureCount: 2,
      remeasureCooldownMs: 1,
      diagnosticCooldownMs: 1,
    });

    expect(suppressed.shouldRemeasure).toBe(false);
    expect(suppressed.remeasureSuppressed).toBe(true);
    expect(suppressed.shouldDiagnose).toBe(true);
  });
});
