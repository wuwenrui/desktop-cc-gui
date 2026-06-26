export type EventBackpressureCriticality = "critical" | "non-critical";

export type EventBackpressureEvidenceClass = "proxy" | "measured" | "unsupported";

export type EventBackpressureStats = {
  surfaceId: string;
  eventKind: string;
  queueDepth: number;
  droppedCount: number;
  coalescedCount: number;
  flushCount: number;
  lastFlushDurationMs: number;
  criticalBypassCount: number;
  deliveredCount: number;
  rawRetainedCount: number;
  evidenceClass: EventBackpressureEvidenceClass;
};

export type EventBackpressureOptions<T> = {
  surfaceId: string;
  eventKind: string;
  maxEventsPerFlush?: number;
  maxBytesPerFlush?: number;
  maxQueueDepth?: number;
  rawRetainedLimit?: number;
  classify?: (event: T) => EventBackpressureCriticality;
  coalesceKey?: (event: T) => string | null;
  dropPolicy?: (event: T) => "drop-eligible-snapshot" | "protected";
  estimateBytes?: (event: T) => number;
  schedule?: (callback: () => void) => void;
  now?: () => number;
  onStats?: (stats: EventBackpressureStats) => void;
};

type Listener<T> = (event: T) => void;

const DEFAULT_MAX_EVENTS_PER_FLUSH = 200;
const DEFAULT_MAX_BYTES_PER_FLUSH = 128 * 1024;
const DEFAULT_MAX_QUEUE_DEPTH = 2_000;
const DEFAULT_RAW_RETAINED_LIMIT = 5_000;

function defaultSchedule(callback: () => void) {
  const inputPending =
    typeof navigator !== "undefined" &&
    (
      navigator as Navigator & {
        scheduling?: { isInputPending?: () => boolean };
      }
    ).scheduling?.isInputPending?.() === true;
  if (inputPending) {
    setTimeout(callback, 32);
    return;
  }
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => callback());
    return;
  }
  setTimeout(callback, 0);
}

function defaultEstimateBytes(event: unknown) {
  if (typeof event === "string") {
    return event.length;
  }
  try {
    return JSON.stringify(event)?.length ?? 0;
  } catch {
    return 0;
  }
}

function deliverToListeners<T>(listeners: Set<Listener<T>>, event: T) {
  for (const listener of listeners) {
    listener(event);
  }
}

function toPositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

export function createEventBackpressure<T>(options: EventBackpressureOptions<T>) {
  const listeners = new Set<Listener<T>>();
  const queue: T[] = [];
  const rawRecent: T[] = [];
  const maxEventsPerFlush = toPositiveInteger(
    options.maxEventsPerFlush,
    DEFAULT_MAX_EVENTS_PER_FLUSH,
  );
  const maxBytesPerFlush = toPositiveInteger(
    options.maxBytesPerFlush,
    DEFAULT_MAX_BYTES_PER_FLUSH,
  );
  const maxQueueDepth = toPositiveInteger(options.maxQueueDepth, DEFAULT_MAX_QUEUE_DEPTH);
  const rawRetainedLimit = toPositiveInteger(
    options.rawRetainedLimit,
    DEFAULT_RAW_RETAINED_LIMIT,
  );
  const schedule = options.schedule ?? defaultSchedule;
  const estimateBytes = options.estimateBytes ?? defaultEstimateBytes;
  const now = options.now ?? (() => Date.now());
  const coalescedKeys = new Set<string>();
  let scheduled = false;
  let droppedCount = 0;
  let coalescedCount = 0;
  let flushCount = 0;
  let lastFlushDurationMs = 0;
  let criticalBypassCount = 0;
  let deliveredCount = 0;

  const snapshot = (): EventBackpressureStats => ({
    surfaceId: options.surfaceId,
    eventKind: options.eventKind,
    queueDepth: queue.length,
    droppedCount,
    coalescedCount,
    flushCount,
    lastFlushDurationMs,
    criticalBypassCount,
    deliveredCount,
    rawRetainedCount: rawRecent.length,
    evidenceClass: "proxy",
  });

  const emitStats = () => {
    options.onStats?.(snapshot());
  };

  const dropOverflowSnapshotIfPossible = () => {
    const dropIndex = queue.findIndex(
      (queued) => options.dropPolicy?.(queued) === "drop-eligible-snapshot",
    );
    if (dropIndex < 0) {
      return false;
    }
    const [dropped] = queue.splice(dropIndex, 1);
    const droppedKey = dropped ? options.coalesceKey?.(dropped) : null;
    if (droppedKey) {
      coalescedKeys.delete(droppedKey);
    }
    droppedCount += 1;
    return true;
  };

  const retainRawRecent = (event: T) => {
    rawRecent.push(event);
    while (rawRecent.length > rawRetainedLimit) {
      rawRecent.shift();
    }
  };

  const flush = () => {
    scheduled = false;
    const startedAt = now();
    let deliveredThisFlush = 0;
    let deliveredBytes = 0;

    while (queue.length > 0 && deliveredThisFlush < maxEventsPerFlush) {
      const next = queue[0] as T;
      const nextBytes = Math.max(0, estimateBytes(next));
      if (deliveredThisFlush > 0 && deliveredBytes + nextBytes > maxBytesPerFlush) {
        break;
      }
      queue.shift();
      const coalesceKey = options.coalesceKey?.(next);
      if (coalesceKey) {
        coalescedKeys.delete(coalesceKey);
      }
      deliveredBytes += nextBytes;
      deliveredThisFlush += 1;
      deliveredCount += 1;
      deliverToListeners(listeners, next);
    }

    flushCount += 1;
    lastFlushDurationMs = Math.max(0, now() - startedAt);
    emitStats();
    if (queue.length > 0) {
      scheduled = true;
      schedule(flush);
    }
  };

  const scheduleFlush = () => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    schedule(flush);
  };

  const push = (event: T) => {
    retainRawRecent(event);
    if (options.classify?.(event) === "critical") {
      criticalBypassCount += 1;
      deliveredCount += 1;
      deliverToListeners(listeners, event);
      emitStats();
      return;
    }

    const coalesceKey = options.coalesceKey?.(event);
    if (coalesceKey) {
      if (coalescedKeys.has(coalesceKey)) {
        coalescedCount += 1;
        const existingIndex = queue.findIndex(
          (queued) => options.coalesceKey?.(queued) === coalesceKey,
        );
        if (existingIndex >= 0) {
          queue[existingIndex] = event;
        }
        emitStats();
        scheduleFlush();
        return;
      }
      coalescedKeys.add(coalesceKey);
    }

    queue.push(event);
    while (queue.length > maxQueueDepth) {
      if (!dropOverflowSnapshotIfPossible()) {
        break;
      }
    }
    emitStats();
    scheduleFlush();
  };

  const subscribe = (listener: Listener<T>) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const clear = () => {
    queue.length = 0;
    rawRecent.length = 0;
    coalescedKeys.clear();
    scheduled = false;
  };

  // §11.2.b: test surface \u2014 reset all cumulative stats + queue. The default
  // `clear()` only empties queues, so unit tests that assert `criticalBypassCount`
  // between cases need an explicit reset.
  const __resetAllForTests = () => {
    clear();
    droppedCount = 0;
    coalescedCount = 0;
    flushCount = 0;
    lastFlushDurationMs = 0;
    criticalBypassCount = 0;
    deliveredCount = 0;
  };

  return {
    push,
    subscribe,
    flush,
    clear,
    __resetAllForTests,
    get queueDepth() {
      return queue.length;
    },
    get droppedCount() {
      return droppedCount;
    },
    get coalescedCount() {
      return coalescedCount;
    },
    getStats: snapshot,
    getRawRecent: () => [...rawRecent],
  };
}
