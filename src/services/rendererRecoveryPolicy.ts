export type RendererRecoveryFailureKind =
  | "heartbeat_missed"
  | "renderer_unresponsive"
  | "native_process_failure";

export type RendererRecoveryPolicy = {
  maxAutomaticAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
};

export type RendererRecoveryState = {
  attemptCount: number;
  lastFailureAt: number | null;
  nextAllowedAt: number | null;
  automaticRecoveryBlocked: boolean;
  diagnosticReason: string | null;
};

export type RendererRecoveryDecision = {
  action: "wait" | "attempt-recovery" | "blocked";
  backoffMs: number;
  reason: string;
  state: RendererRecoveryState;
};

export type RendererRecoveryFailureInput = {
  failureKind: RendererRecoveryFailureKind;
  now: number;
  unsentComposerDraftLength: number;
  composerDraftPreserved: boolean;
  policy?: Partial<RendererRecoveryPolicy>;
};

const DEFAULT_POLICY: RendererRecoveryPolicy = {
  maxAutomaticAttempts: 2,
  baseBackoffMs: 5_000,
  maxBackoffMs: 60_000,
};

export function createRendererRecoveryState(): RendererRecoveryState {
  return {
    attemptCount: 0,
    lastFailureAt: null,
    nextAllowedAt: null,
    automaticRecoveryBlocked: false,
    diagnosticReason: null,
  };
}

function resolvePolicy(input?: Partial<RendererRecoveryPolicy>): RendererRecoveryPolicy {
  return {
    maxAutomaticAttempts: Math.max(
      0,
      Math.floor(input?.maxAutomaticAttempts ?? DEFAULT_POLICY.maxAutomaticAttempts),
    ),
    baseBackoffMs: Math.max(0, input?.baseBackoffMs ?? DEFAULT_POLICY.baseBackoffMs),
    maxBackoffMs: Math.max(0, input?.maxBackoffMs ?? DEFAULT_POLICY.maxBackoffMs),
  };
}

function boundedBackoffMs(attemptCount: number, policy: RendererRecoveryPolicy) {
  if (attemptCount <= 0 || policy.baseBackoffMs <= 0) {
    return 0;
  }
  const multiplier = 2 ** Math.max(0, attemptCount - 1);
  return Math.min(policy.maxBackoffMs, policy.baseBackoffMs * multiplier);
}

export function recordRendererRecoveryFailure(
  previous: RendererRecoveryState,
  input: RendererRecoveryFailureInput,
): RendererRecoveryDecision {
  const policy = resolvePolicy(input.policy);
  const hasUnpreservedDraft =
    input.unsentComposerDraftLength > 0 && !input.composerDraftPreserved;
  if (hasUnpreservedDraft) {
    return {
      action: "blocked",
      backoffMs: 0,
      reason: "composer-draft-preservation-required",
      state: {
        ...previous,
        lastFailureAt: input.now,
        automaticRecoveryBlocked: true,
        diagnosticReason: "composer-draft-preservation-required",
      },
    };
  }

  if (previous.automaticRecoveryBlocked || previous.attemptCount >= policy.maxAutomaticAttempts) {
    return {
      action: "blocked",
      backoffMs: 0,
      reason: "automatic-recovery-budget-exhausted",
      state: {
        ...previous,
        lastFailureAt: input.now,
        automaticRecoveryBlocked: true,
        diagnosticReason: "automatic-recovery-budget-exhausted",
      },
    };
  }

  const nextAttemptCount = previous.attemptCount + 1;
  const backoffMs = boundedBackoffMs(previous.attemptCount, policy);
  const nextAllowedAt = input.now + backoffMs;
  return {
    action: backoffMs > 0 ? "wait" : "attempt-recovery",
    backoffMs,
    reason: input.failureKind,
    state: {
      attemptCount: nextAttemptCount,
      lastFailureAt: input.now,
      nextAllowedAt,
      automaticRecoveryBlocked: false,
      diagnosticReason: input.failureKind,
    },
  };
}
