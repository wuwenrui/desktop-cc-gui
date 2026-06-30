import { describe, expect, it, vi } from "vitest";
import { createEventBackpressure } from "./eventBackpressure";

type TestEvent = {
  id: string;
  kind: string;
  body?: string;
  critical?: boolean;
};

describe("eventBackpressure", () => {
  it("flushes non-critical events within event and byte caps", () => {
    const scheduled: Array<() => void> = [];
    const listener = vi.fn();
    const backpressure = createEventBackpressure<TestEvent>({
      surfaceId: "test",
      eventKind: "terminal-output",
      maxEventsPerFlush: 2,
      maxBytesPerFlush: 20,
      schedule: (callback) => scheduled.push(callback),
      estimateBytes: (event) => event.body?.length ?? 1,
    });
    backpressure.subscribe(listener);

    backpressure.push({ id: "1", kind: "line", body: "12345" });
    backpressure.push({ id: "2", kind: "line", body: "12345" });
    backpressure.push({ id: "3", kind: "line", body: "12345" });

    expect(listener).not.toHaveBeenCalled();
    scheduled.shift()?.();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(backpressure.queueDepth).toBe(1);
    scheduled.shift()?.();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("bypasses the lossy queue for critical events", () => {
    const scheduled: Array<() => void> = [];
    const listener = vi.fn();
    const backpressure = createEventBackpressure<TestEvent>({
      surfaceId: "test",
      eventKind: "runtime-status",
      maxQueueDepth: 1,
      schedule: (callback) => scheduled.push(callback),
      classify: (event) => (event.critical ? "critical" : "non-critical"),
    });
    backpressure.subscribe(listener);

    backpressure.push({ id: "1", kind: "line" });
    backpressure.push({ id: "2", kind: "line" });
    backpressure.push({ id: "exit", kind: "exit", critical: true });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ id: "exit", kind: "exit", critical: true });
    expect(backpressure.droppedCount).toBe(0);
    scheduled.shift()?.();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("coalesces duplicate status events by stable key", () => {
    const scheduled: Array<() => void> = [];
    const listener = vi.fn();
    const backpressure = createEventBackpressure<TestEvent>({
      surfaceId: "test",
      eventKind: "runtime-status",
      schedule: (callback) => scheduled.push(callback),
      coalesceKey: (event) => `${event.kind}:${event.id}`,
    });
    backpressure.subscribe(listener);

    backpressure.push({ id: "ws-1", kind: "running", body: "old" });
    backpressure.push({ id: "ws-1", kind: "running", body: "new" });

    expect(backpressure.coalescedCount).toBe(1);
    scheduled.shift()?.();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ id: "ws-1", kind: "running", body: "new" });
  });

  it("retains recent raw events separately from the display queue", () => {
    const backpressure = createEventBackpressure<TestEvent>({
      surfaceId: "test",
      eventKind: "terminal-output",
      maxQueueDepth: 1,
      rawRetainedLimit: 3,
      schedule: () => undefined,
    });

    backpressure.push({ id: "1", kind: "line" });
    backpressure.push({ id: "2", kind: "line" });
    backpressure.push({ id: "3", kind: "line" });
    backpressure.push({ id: "4", kind: "line" });

    expect(backpressure.queueDepth).toBe(4);
    expect(backpressure.getRawRecent().map((event) => event.id)).toEqual(["2", "3", "4"]);
  });

  it("normalizes zero caps so queued events do not spin forever", () => {
    const scheduled: Array<() => void> = [];
    const listener = vi.fn();
    const backpressure = createEventBackpressure<TestEvent>({
      surfaceId: "test",
      eventKind: "terminal-output",
      maxEventsPerFlush: 0,
      maxBytesPerFlush: 0,
      maxQueueDepth: 0,
      rawRetainedLimit: 0,
      schedule: (callback) => scheduled.push(callback),
    });
    backpressure.subscribe(listener);

    backpressure.push({ id: "1", kind: "line" });
    scheduled.shift()?.();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(backpressure.queueDepth).toBe(0);
    expect(backpressure.getRawRecent()).toHaveLength(1);
  });

  it("drops only events marked as drop-eligible snapshots on queue overflow", () => {
    const scheduled: Array<() => void> = [];
    const listener = vi.fn();
    const backpressure = createEventBackpressure<TestEvent>({
      surfaceId: "test",
      eventKind: "runtime-status",
      maxQueueDepth: 1,
      schedule: (callback) => scheduled.push(callback),
      coalesceKey: (event) => `${event.kind}:${event.id}`,
      dropPolicy: (event) =>
        event.kind === "snapshot" ? "drop-eligible-snapshot" : "protected",
    });
    backpressure.subscribe(listener);

    backpressure.push({ id: "ws-1", kind: "snapshot", body: "dropped" });
    backpressure.push({ id: "ws-2", kind: "protected", body: "queued" });
    backpressure.push({ id: "ws-3", kind: "protected", body: "also queued" });
    scheduled.shift()?.();

    expect(backpressure.droppedCount).toBe(1);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, {
      id: "ws-2",
      kind: "protected",
      body: "queued",
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      id: "ws-3",
      kind: "protected",
      body: "also queued",
    });
  });
});
