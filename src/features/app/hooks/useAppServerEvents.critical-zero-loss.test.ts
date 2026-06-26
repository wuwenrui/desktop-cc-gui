// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  getAppServerEventBackpressureForTests,
  resetAppServerEventBackpressureForTests,
} from "./useAppServerEvents";

const CRITICAL_METHODS = [
  "turn/completed",
  "turn/error",
  "runtime/ended",
  "item/tool/requestUserInput",
  "approval/request",
];

function buildNonCriticalEvent(threadId: string, index: number) {
  return {
    workspace_id: "ws-1",
    message: {
      method: "item/updated",
      params: {
        threadId,
        item: {
          type: "agentMessage",
          id: `agent-${index}`,
          text: "x".repeat(200),
        },
      },
    },
  };
}

function buildCriticalEvent(method: string, turnId: string) {
  return {
    workspace_id: "ws-1",
    message: {
      method,
      params: { turnId, threadId: "thread-1" },
    },
  };
}

describe("appServerEventBackpressure §11.2.b critical zero-loss", () => {
  afterEach(() => {
    resetAppServerEventBackpressureForTests();
  });

  it("all 50 critical events bypass the queue and reach subscriber (1024 burst mixed)", async () => {
    const backpressure = getAppServerEventBackpressureForTests();
    const received: { method: string; event: unknown }[] = [];
    const unsubscribe = backpressure.subscribe((event) => {
      const method = (event as { message: { method?: string } }).message.method;
      received.push({ method: method ?? "<none>", event });
    });

    // 974 non-critical (item/updated) + 50 critical (turn/completed etc) = 1024
    for (let i = 0; i < 974; i++) {
      backpressure.push(buildNonCriticalEvent("thread-1", i));
    }
    for (let i = 0; i < 50; i++) {
      const method = CRITICAL_METHODS[i % CRITICAL_METHODS.length];
      backpressure.push(buildCriticalEvent(method, `turn-${i}`));
    }

    // Wait for scheduled flush to drain.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 50));

    const criticalReceived = received.filter((r) =>
      CRITICAL_METHODS.includes(r.method),
    );
    expect(criticalReceived.length).toBe(50);

    // criticalBypassCount >= 50 (covers 11.2 acceptance)
    const stats = backpressure.getStats();
    expect(stats.criticalBypassCount).toBeGreaterThanOrEqual(50);

    unsubscribe();
  });

  it("critical events do not occupy the coalescing queue (queue cap unaffected)", () => {
    const backpressure = getAppServerEventBackpressureForTests();
    let received = 0;
    const unsubscribe = backpressure.subscribe(() => {
      received += 1;
    });
    // 50 critical pushed in tight loop; they bypass coalesce/queue
    for (let i = 0; i < 50; i++) {
      backpressure.push(buildCriticalEvent("turn/completed", `t-${i}`));
    }
    const stats = backpressure.getStats();
    expect(stats.criticalBypassCount).toBe(50);
    expect(stats.queueDepth).toBe(0);
    expect(received).toBe(50);
    unsubscribe();
  });
});
