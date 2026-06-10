import { describe, expect, it } from "vitest";

import {
  createRendererRecoveryState,
  recordRendererRecoveryFailure,
} from "./rendererRecoveryPolicy";

describe("rendererRecoveryPolicy", () => {
  it("blocks automatic recovery when an unsent Composer draft is not preserved", () => {
    const decision = recordRendererRecoveryFailure(createRendererRecoveryState(), {
      failureKind: "heartbeat_missed",
      now: 1_000,
      unsentComposerDraftLength: 12,
      composerDraftPreserved: false,
    });

    expect(decision.action).toBe("blocked");
    expect(decision.reason).toBe("composer-draft-preservation-required");
    expect(decision.state.automaticRecoveryBlocked).toBe(true);
  });

  it("uses bounded backoff and stops after the recovery budget is exhausted", () => {
    const first = recordRendererRecoveryFailure(createRendererRecoveryState(), {
      failureKind: "renderer_unresponsive",
      now: 1_000,
      unsentComposerDraftLength: 0,
      composerDraftPreserved: true,
      policy: { maxAutomaticAttempts: 2, baseBackoffMs: 5_000, maxBackoffMs: 5_000 },
    });
    const second = recordRendererRecoveryFailure(first.state, {
      failureKind: "renderer_unresponsive",
      now: 2_000,
      unsentComposerDraftLength: 0,
      composerDraftPreserved: true,
      policy: { maxAutomaticAttempts: 2, baseBackoffMs: 5_000, maxBackoffMs: 5_000 },
    });
    const third = recordRendererRecoveryFailure(second.state, {
      failureKind: "renderer_unresponsive",
      now: 3_000,
      unsentComposerDraftLength: 0,
      composerDraftPreserved: true,
      policy: { maxAutomaticAttempts: 2, baseBackoffMs: 5_000, maxBackoffMs: 5_000 },
    });

    expect(first.action).toBe("attempt-recovery");
    expect(second).toMatchObject({
      action: "wait",
      backoffMs: 5_000,
    });
    expect(third).toMatchObject({
      action: "blocked",
      reason: "automatic-recovery-budget-exhausted",
    });
  });
});
