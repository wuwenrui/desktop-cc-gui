import { describe, expect, it } from "vitest";
import type { ThreadTokenUsage } from "../../../types";
import { resolveBudgetThresholdSignal } from "../budget/budgetThresholds";
import type { SessionBudgetConfig } from "../budget/budgetTypes";
import {
  budgetStoreInternals,
  createMonthlyBudgetStore,
} from "../budget/budgetStore";
import { aggregateWorkspaceCost } from "./costAggregate";
import {
  costHistoryStoreInternals,
  createCostHistoryStore,
} from "./costHistoryStore";
import {
  buildUnsupportedBlockLevelCostRecord,
  projectCostRecord,
} from "./projectCost";
import { buildTokenBreakdownViewModel } from "./tokenBreakdown";

const usage: ThreadTokenUsage = {
  total: {
    totalTokens: 10_000,
    inputTokens: 6_000,
    cachedInputTokens: 1_000,
    outputTokens: 4_000,
    reasoningOutputTokens: 500,
  },
  last: {
    totalTokens: 2_000,
    inputTokens: 1_200,
    cachedInputTokens: 200,
    outputTokens: 800,
    reasoningOutputTokens: 100,
  },
  modelContextWindow: 200_000,
};

describe("context ledger cost projection", () => {
  it("projects turn cost from ThreadTokenUsage and embeds pricing source metadata", () => {
    const record = projectCostRecord({
      engine: "codex",
      model: "gpt-5.4",
      usage,
      scope: "turn",
    });

    expect(record.amountUsd).toBeCloseTo(0.01455, 6);
    expect(record.pricingSource).toMatchObject({
      engine: "codex",
      model: "gpt-5.4",
      source: "fixture",
      lastUpdatedAt: "2026-05-19T00:00:00.000Z",
    });
    expect(record.degraded).toBe(false);
  });

  it("produces degraded cost when pricing is unavailable", () => {
    const record = projectCostRecord({
      engine: "opencode",
      model: "unknown/provider-model",
      usage,
      scope: "session",
    });

    expect(record.amountUsd).toBeNull();
    expect(record.degraded).toBe(true);
    expect(record.degradationReason).toBe("pricing-unavailable");
    expect(record.usage.totalTokens).toBe(10_000);
  });

  it("marks workspace aggregates partial when any record is degraded", () => {
    const aggregate = aggregateWorkspaceCost([
      projectCostRecord({
        engine: "gemini",
        model: "gemini-2.5-flash",
        usage,
        scope: "turn",
      }),
      projectCostRecord({
        engine: "opencode",
        model: "unknown/provider-model",
        usage,
        scope: "turn",
      }),
    ]);

    expect(aggregate.partial).toBe(true);
    expect(aggregate.amountUsd).not.toBeNull();
    expect(
      aggregate.byEngine.map((entry) => [entry.engine, entry.partial]),
    ).toEqual([
      ["gemini", false],
      ["opencode", true],
    ]);
  });

  it("keeps block-level cost explicitly unsupported", () => {
    const record = buildUnsupportedBlockLevelCostRecord({
      engine: "claude",
      model: "claude-sonnet-4.5",
    });

    expect(record.degraded).toBe(true);
    expect(record.degradationReason).toBe("block-level-cost-unsupported");
    expect(record.amountUsd).toBeNull();
  });
});

describe("context ledger token breakdown and local stores", () => {
  it("builds token breakdown segments and omits zero categories", () => {
    expect(buildTokenBreakdownViewModel(usage.total)).toEqual({
      totalTokens: 10_000,
      segments: [
        { kind: "input", tokens: 5_000, percent: 50 },
        { kind: "cached_input", tokens: 1_000, percent: 10 },
        { kind: "output", tokens: 3_500, percent: 35 },
        { kind: "reasoning", tokens: 500, percent: 5 },
      ],
    });

    expect(
      buildTokenBreakdownViewModel({
        totalTokens: 100,
        inputTokens: 100,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
      })?.segments,
    ).toEqual([{ kind: "input", tokens: 100, percent: 100 }]);
  });

  it("accumulates session, local day, and local month cost", () => {
    const pricedRecord = projectCostRecord({
      engine: "codex",
      model: "gpt-5.4",
      usage,
      scope: "session",
    });
    const store = createCostHistoryStore([
      {
        ...pricedRecord,
        sessionId: "session-a",
        occurredAt: "2026-05-20T01:00:00.000Z",
      },
      {
        ...pricedRecord,
        sessionId: "session-b",
        occurredAt: "2026-05-18T23:00:00.000Z",
      },
      {
        ...pricedRecord,
        sessionId: "session-a",
        occurredAt: "2026-04-20T01:00:00.000Z",
      },
    ]);
    const totals = store.totals(new Date("2026-05-20T12:00:00.000Z"));

    expect(totals.sessionUsd("session-a")).toBeCloseTo(
      (pricedRecord.amountUsd ?? 0) * 2,
      6,
    );
    expect(totals.todayUsd).toBeCloseTo(pricedRecord.amountUsd ?? 0, 6);
    expect(totals.monthUsd).toBeCloseTo((pricedRecord.amountUsd ?? 0) * 2, 6);
  });

  it("drops malformed persisted cost history entries before aggregation", () => {
    const parsed = costHistoryStoreInternals.parseEntries(
      JSON.stringify([
        {
          engine: "codex",
          model: "gpt-5.4",
          scope: "session",
          usage: usage.total,
          amountUsd: 0.25,
          currency: "USD",
          pricingSource: { untrusted: true },
          degraded: false,
          degradationReason: null,
          sessionId: "safe-session",
          occurredAt: "2026-05-20T01:00:00.000Z",
        },
        {
          engine: "codex",
          scope: "session",
          usage: usage.total,
          amountUsd: "100",
          sessionId: "",
          occurredAt: "not-a-date",
        },
      ]),
    );
    const totals = createCostHistoryStore(parsed).totals(
      new Date("2026-05-20T12:00:00.000Z"),
    );

    expect(parsed).toEqual([
      {
        engine: "codex",
        model: "gpt-5.4",
        scope: "session",
        usage: usage.total,
        amountUsd: 0.25,
        currency: "USD",
        pricingSource: null,
        degraded: false,
        degradationReason: null,
        sessionId: "safe-session",
        occurredAt: "2026-05-20T01:00:00.000Z",
      },
    ]);
    expect(totals.sessionUsd("safe-session")).toBe(0.25);
    expect(totals.todayUsd).toBe(0.25);
  });

  it("sanitizes stored monthly budget thresholds into monotonic ratios", () => {
    expect(
      budgetStoreInternals.parseMonthlyBudget(
        JSON.stringify({
          monthlyLimitUsd: 10,
          warnRatio: 2,
          exceededRatio: 1,
        }),
      ),
    ).toMatchObject({
      monthlyLimitUsd: 10,
      warnRatio: 2,
      exceededRatio: 2,
    });
  });

  it("stores and clears monthly budget config without requiring a backend", () => {
    const store = createMonthlyBudgetStore();

    expect(store.get().monthlyLimitUsd).toBeNull();
    store.set({
      currency: "USD",
      monthlyLimitUsd: 20,
      warnRatio: 0.8,
      exceededRatio: 1,
    });
    expect(store.get().monthlyLimitUsd).toBe(20);
    store.clear();
    expect(store.get().monthlyLimitUsd).toBeNull();
  });
});

describe("context ledger budget thresholds", () => {
  const budget: SessionBudgetConfig = {
    sessionId: "session-1",
    currency: "USD",
    thresholdsUsd: {
      info: 0.01,
      warn: 0.05,
      block: 0.1,
    },
  };

  it("emits info, warn, and block tiers without runtime interruption", () => {
    expect(
      resolveBudgetThresholdSignal({
        sessionId: "session-1",
        amountUsd: 0.02,
        budget,
      })?.tier,
    ).toBe("info");
    expect(
      resolveBudgetThresholdSignal({
        sessionId: "session-1",
        amountUsd: 0.07,
        budget,
      })?.tier,
    ).toBe("warn");
    expect(
      resolveBudgetThresholdSignal({
        sessionId: "session-1",
        amountUsd: 0.12,
        budget,
      }),
    ).toMatchObject({
      tier: "block",
      severity: "critical",
      shouldInterruptRuntime: false,
    });
  });

  it("does not emit a signal when no session budget exists", () => {
    expect(
      resolveBudgetThresholdSignal({
        sessionId: "session-1",
        amountUsd: 1,
        budget: null,
      }),
    ).toBeNull();
  });

  it("ignores invalid budget thresholds without false-positive escalation", () => {
    const invalidBudget: SessionBudgetConfig = {
      sessionId: "session-1",
      currency: "USD",
      thresholdsUsd: {
        info: 0.01,
        warn: Number.POSITIVE_INFINITY,
        block: -1,
      },
    };

    expect(
      resolveBudgetThresholdSignal({
        sessionId: "session-1",
        amountUsd: 0,
        budget: invalidBudget,
      }),
    ).toBeNull();
    expect(
      resolveBudgetThresholdSignal({
        sessionId: "session-1",
        amountUsd: 0.02,
        budget: invalidBudget,
      })?.tier,
    ).toBe("info");
  });
});
