export type RenderLoopGuardBudget = {
  signature: string;
  count: number;
  lastDiagnosticAt: number;
};

export const DEFAULT_RENDER_LOOP_GUARD_BUDGET: RenderLoopGuardBudget = {
  signature: "",
  count: 0,
  lastDiagnosticAt: 0,
};

export const DEFAULT_RENDER_LOOP_GUARD_THRESHOLD = 8;
export const DEFAULT_RENDER_LOOP_GUARD_DIAGNOSTIC_COOLDOWN_MS = 5_000;

export function resolveIdempotentRenderLoopGuard(input: {
  previous: RenderLoopGuardBudget;
  signature: string;
  changed: boolean;
  now: number;
  threshold?: number;
  diagnosticCooldownMs?: number;
}) {
  if (input.changed) {
    return {
      nextBudget: DEFAULT_RENDER_LOOP_GUARD_BUDGET,
      shouldCommit: true,
      shouldDiagnose: false,
      suppressedCount: 0,
    };
  }

  const threshold = input.threshold ?? DEFAULT_RENDER_LOOP_GUARD_THRESHOLD;
  const diagnosticCooldownMs =
    input.diagnosticCooldownMs ?? DEFAULT_RENDER_LOOP_GUARD_DIAGNOSTIC_COOLDOWN_MS;
  const previous =
    input.previous.signature === input.signature
      ? input.previous
      : DEFAULT_RENDER_LOOP_GUARD_BUDGET;
  const nextCount = previous.count + 1;
  const shouldDiagnose =
    nextCount >= threshold &&
    input.now - previous.lastDiagnosticAt >= diagnosticCooldownMs;
  const nextBudget: RenderLoopGuardBudget = {
    signature: input.signature,
    count: nextCount,
    lastDiagnosticAt: shouldDiagnose ? input.now : previous.lastDiagnosticAt,
  };

  return {
    nextBudget,
    shouldCommit: false,
    shouldDiagnose,
    suppressedCount: nextCount,
  };
}

export type HydrationRemeasureBudget = {
  signature: string;
  remeasureCount: number;
  lastRemeasureAt: number;
  lastDiagnosticAt: number;
};

export const DEFAULT_HYDRATION_REMEASURE_BUDGET: HydrationRemeasureBudget = {
  signature: "",
  remeasureCount: 0,
  lastRemeasureAt: 0,
  lastDiagnosticAt: 0,
};

export const DEFAULT_HYDRATION_REMEASURE_MAX_COUNT = 2;
export const DEFAULT_HYDRATION_REMEASURE_COOLDOWN_MS = 250;

export function resolveHydrationRemeasureGuard(input: {
  previous: HydrationRemeasureBudget;
  signature: string;
  hydratedHeavyRowCount: number;
  now: number;
  maxRemeasureCount?: number;
  remeasureCooldownMs?: number;
  diagnosticCooldownMs?: number;
}) {
  if (input.hydratedHeavyRowCount <= 0 || input.signature.length === 0) {
    return {
      nextBudget: DEFAULT_HYDRATION_REMEASURE_BUDGET,
      shouldRemeasure: false,
      shouldDiagnose: false,
      remeasureSuppressed: false,
    };
  }

  const maxRemeasureCount =
    input.maxRemeasureCount ?? DEFAULT_HYDRATION_REMEASURE_MAX_COUNT;
  const remeasureCooldownMs =
    input.remeasureCooldownMs ?? DEFAULT_HYDRATION_REMEASURE_COOLDOWN_MS;
  const diagnosticCooldownMs =
    input.diagnosticCooldownMs ?? DEFAULT_RENDER_LOOP_GUARD_DIAGNOSTIC_COOLDOWN_MS;
  const previous =
    input.previous.signature === input.signature
      ? input.previous
      : DEFAULT_HYDRATION_REMEASURE_BUDGET;
  const canRemeasure =
    previous.remeasureCount < maxRemeasureCount &&
    input.now - previous.lastRemeasureAt >= remeasureCooldownMs;
  const remeasureSuppressed = !canRemeasure && previous.remeasureCount >= maxRemeasureCount;
  const shouldDiagnose =
    remeasureSuppressed &&
    input.now - previous.lastDiagnosticAt >= diagnosticCooldownMs;
  const nextBudget: HydrationRemeasureBudget = {
    signature: input.signature,
    remeasureCount: canRemeasure
      ? previous.remeasureCount + 1
      : previous.remeasureCount,
    lastRemeasureAt: canRemeasure ? input.now : previous.lastRemeasureAt,
    lastDiagnosticAt: shouldDiagnose ? input.now : previous.lastDiagnosticAt,
  };

  return {
    nextBudget,
    shouldRemeasure: canRemeasure,
    shouldDiagnose,
    remeasureSuppressed,
  };
}
