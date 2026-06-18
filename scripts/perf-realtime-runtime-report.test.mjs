import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { test } from "node:test";

function runScript(args) {
  return new Promise((resolve, reject) => {
    execFile("node", ["scripts/perf-realtime-runtime-report.mjs", ...args], { cwd: process.cwd() }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test("realtime runtime report derives measured metrics from content-safe diagnostics", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "runtime.json");
  await writeFile(inputPath, JSON.stringify({
    entries: [
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          evidenceClass: "measured",
          deltas: {
            sendToFirstDeltaMs: 20,
            firstDeltaToFirstVisibleTextMs: 25,
            lastReducerCommitToTerminalSettlementMs: 50,
          },
          counters: {
            reducerAmplification: 2,
            appServerEventRouteDurationAvgMs: 10,
            terminalSettlementLagMs: 50,
          },
        },
      },
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          evidenceClass: "measured",
          deltas: {
            sendToFirstDeltaMs: 40,
            firstDeltaToFirstVisibleTextMs: 35,
            lastReducerCommitToTerminalSettlementMs: 70,
          },
          counters: {
            reducerAmplification: 4,
            appServerEventRouteDurationAvgMs: 14,
            terminalSettlementLagMs: 70,
          },
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/codex-turn-start-ack",
        payload: {
          workspaceId: "ws-1",
          threadId: "thread-1",
          model: "MiniMax-M3",
          durationMs: 18,
          outcome: "ok",
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/codex-turn-start-ack",
        payload: {
          workspaceId: "ws-1",
          threadId: "thread-2",
          model: "MiniMax-M3",
          durationMs: 28,
          outcome: "ok",
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/app-server-event",
        payload: {
          traceSource: "codex-app-server",
          workspaceId: "ws-1",
          threadId: "thread-1",
          turnId: "turn-1",
          method: "item/agentMessage/delta",
          turnStartResponseToFirstRuntimeEventMs: 5,
          turnStartResponseToFirstTextDeltaMs: 12,
          firstRuntimeEventToFirstTextDeltaMs: 7,
          firstRuntimeEventToFirstAssistantItemEventMs: 6,
          firstAssistantItemEventToFirstTextDeltaMs: 1,
          eventCountBeforeFirstTextDelta: 1,
          reasoningEventCountBeforeFirstTextDelta: 1,
          toolEventCountBeforeFirstTextDelta: 0,
          methodsBeforeFirstTextDelta: ["item/reasoning/textDelta"],
          firstRuntimeEventMethod: "item/reasoning/textDelta",
          firstReasoningEventMethod: "item/reasoning/textDelta",
          firstAssistantItemEventMethod: "item/started",
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/app-server-event",
        payload: {
          traceSource: "codex-app-server",
          workspaceId: "ws-1",
          threadId: "thread-2",
          turnId: "turn-2",
          method: "item/agentMessage/delta",
          turnStartResponseToFirstRuntimeEventMs: 4,
          turnStartResponseToFirstTextDeltaMs: 24,
          firstRuntimeEventToFirstTextDeltaMs: 20,
          firstRuntimeEventToFirstAssistantItemEventMs: 18,
          firstAssistantItemEventToFirstTextDeltaMs: 2,
          eventCountBeforeFirstTextDelta: 2,
          reasoningEventCountBeforeFirstTextDelta: 1,
          toolEventCountBeforeFirstTextDelta: 1,
          methodsBeforeFirstTextDelta: ["item/reasoning/textDelta", "item/started"],
          firstRuntimeEventMethod: "item/reasoning/textDelta",
          firstReasoningEventMethod: "item/reasoning/textDelta",
          firstAssistantItemEventMethod: "item/started",
          firstToolEventMethod: "item/started",
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = new Map(fragment.metrics.map((metric) => [metric.metric, metric]));
  assert.equal(byMetric.get("firstDeltaLatencyP95")?.value, 40);
  assert.equal(byMetric.get("turnStartAckLatencyP95")?.value, 28);
  assert.equal(byMetric.get("codexPostAckFirstDeltaP95")?.value, 24);
  assert.equal(byMetric.get("codexPostAckFirstRuntimeEventP95")?.value, 5);
  assert.equal(byMetric.get("codexFirstRuntimeEventToFirstTextDeltaP95")?.value, 20);
  assert.equal(byMetric.get("codexFirstRuntimeEventToFirstAssistantItemP95")?.value, 18);
  assert.equal(byMetric.get("codexFirstAssistantItemToFirstTextDeltaP95")?.value, 2);
  assert.deepEqual(
    fragment.diagnostics.codexPostAckFirstDeltaByTurn.map((entry) => ({
      turnId: entry.turnId,
      firstTextDeltaMs: entry.firstTextDeltaMs,
      firstRuntimeEventMs: entry.firstRuntimeEventMs,
      firstRuntimeEventToFirstTextDeltaMs: entry.firstRuntimeEventToFirstTextDeltaMs,
      firstRuntimeEventToFirstAssistantItemEventMs:
        entry.firstRuntimeEventToFirstAssistantItemEventMs,
      firstAssistantItemEventToFirstTextDeltaMs:
        entry.firstAssistantItemEventToFirstTextDeltaMs,
      eventCountBeforeFirstTextDelta: entry.eventCountBeforeFirstTextDelta,
      methodsBeforeFirstTextDelta: entry.methodsBeforeFirstTextDelta,
    })),
    [
      {
        turnId: "turn-2",
        firstTextDeltaMs: 24,
        firstRuntimeEventMs: 4,
        firstRuntimeEventToFirstTextDeltaMs: 20,
        firstRuntimeEventToFirstAssistantItemEventMs: 18,
        firstAssistantItemEventToFirstTextDeltaMs: 2,
        eventCountBeforeFirstTextDelta: 2,
        methodsBeforeFirstTextDelta: ["item/reasoning/textDelta", "item/started"],
      },
      {
        turnId: "turn-1",
        firstTextDeltaMs: 12,
        firstRuntimeEventMs: 5,
        firstRuntimeEventToFirstTextDeltaMs: 7,
        firstRuntimeEventToFirstAssistantItemEventMs: 6,
        firstAssistantItemEventToFirstTextDeltaMs: 1,
        eventCountBeforeFirstTextDelta: 1,
        methodsBeforeFirstTextDelta: ["item/reasoning/textDelta"],
      },
    ],
  );
  assert.equal(byMetric.get("visibleTextLagP95")?.value, 35);
  assert.equal(byMetric.get("reducerAmplificationMedian")?.value, 3);
  assert.equal(byMetric.get("batchFlushDurationP95")?.evidenceClass, "measured");
  assert.match(fragment.notes.join("\n"), /contentSafety=/);
  assert.match(fragment.notes.join("\n"), /codexPostAckFirstDeltaTurnCount=2/);
  assert.match(fragment.notes.join("\n"), /codexPostAckPhaseBreakdown=/);
});

test("realtime runtime report separates first-delta latency from visible lag", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "runtime.json");
  await writeFile(inputPath, JSON.stringify({
    entries: [
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          traceId: "tt-slow-first-delta",
          engine: "codex",
          model: "MiniMax-M3",
          evidenceClass: "measured",
          deltas: {
            sendToFirstDeltaMs: 14_602,
            firstDeltaToFirstVisibleTextMs: 177,
            lastReducerCommitToTerminalSettlementMs: 462,
          },
          counters: {
            reducerAmplification: 1,
            appServerEventRouteDurationAvgMs: 0.167,
            terminalSettlementLagMs: 462,
          },
        },
      },
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          traceId: "tt-normal-first-delta",
          engine: "codex",
          model: "MiniMax-M3",
          evidenceClass: "measured",
          deltas: {
            sendToFirstDeltaMs: 1_272,
            firstDeltaToFirstVisibleTextMs: 177,
            lastReducerCommitToTerminalSettlementMs: 462,
          },
          counters: {
            reducerAmplification: 1,
            appServerEventRouteDurationAvgMs: 0.167,
            terminalSettlementLagMs: 462,
          },
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/codex-turn-start-ack",
        payload: {
          workspaceId: "ws-1",
          threadId: "thread-slow",
          model: "MiniMax-M3",
          durationMs: 320,
          outcome: "ok",
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/codex-turn-start-ack",
        payload: {
          workspaceId: "ws-1",
          threadId: "thread-normal",
          model: "MiniMax-M3",
          durationMs: 180,
          outcome: "ok",
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/app-server-event",
        payload: {
          traceSource: "codex-app-server",
          workspaceId: "ws-1",
          threadId: "thread-slow",
          method: "item/agentMessage/delta",
          turnStartResponseToFirstTextDeltaMs: 14_200,
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/app-server-event",
        payload: {
          traceSource: "codex-app-server",
          workspaceId: "ws-1",
          threadId: "thread-normal",
          method: "item/agentMessage/delta",
          turnStartResponseToFirstTextDeltaMs: 900,
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = new Map(fragment.metrics.map((metric) => [metric.metric, metric]));

  assert.equal(byMetric.get("firstDeltaLatencyP95")?.value, 14602);
  assert.equal(byMetric.get("turnStartAckLatencyP95")?.value, 320);
  assert.equal(byMetric.get("codexPostAckFirstDeltaP95")?.value, 14200);
  assert.equal(byMetric.get("visibleTextLagP95")?.value, 177);
  assert.match(
    fragment.notes.join("\n"),
    /firstDeltaDominates=tt-slow-first-delta/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /upstream\/provider\/startup phase/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /turnStartAckComparison=firstDeltaLatencyP95:14602ms turnStartAckLatencyP95:320ms postAckFirstDeltaWaitApprox:14282ms/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /codexPostAckComparison=firstDeltaLatencyP95:14602ms turnStartAckLatencyP95:320ms codexPostAckFirstDeltaP95:14200ms/,
  );
});

test("realtime runtime report flags provider first-response dominated Codex turns", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "runtime.json");
  await writeFile(inputPath, JSON.stringify({
    entries: [
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          traceId: "tt-provider-first-response",
          engine: "codex",
          model: "MiniMax-M3",
          evidenceClass: "measured",
          deltas: {
            sendToFirstDeltaMs: 3_146,
            firstDeltaToFirstVisibleTextMs: 145,
            lastReducerCommitToTerminalSettlementMs: 20,
          },
          counters: {
            reducerAmplification: 1,
            appServerEventRouteDurationAvgMs: 0,
            terminalSettlementLagMs: 20,
          },
        },
      },
      {
        timestamp: Date.now(),
        label: "stream-latency/app-server-event",
        payload: {
          traceSource: "codex-app-server",
          workspaceId: "ws-1",
          threadId: "thread-provider-first-response",
          turnId: "turn-provider-first-response",
          model: "MiniMax-M3",
          method: "item/agentMessage/delta",
          turnStartResponseToFirstRuntimeEventMs: 1,
          turnStartResponseToFirstTextDeltaMs: 2_371,
          firstRuntimeEventToFirstTextDeltaMs: 2_370,
          firstRuntimeEventToFirstAssistantItemEventMs: 2_365,
          firstAssistantItemEventToFirstTextDeltaMs: 5,
          eventCountBeforeFirstTextDelta: 7,
          reasoningEventCountBeforeFirstTextDelta: 0,
          toolEventCountBeforeFirstTextDelta: 0,
          methodsBeforeFirstTextDelta: [
            "thread/settings/updated",
            "warning",
            "thread/status/changed",
            "turn/started",
            "item/started",
            "item/completed",
          ],
          firstRuntimeEventMethod: "thread/settings/updated",
          firstAssistantItemEventMethod: "item/started",
          firstTextDeltaMethod: "item/agentMessage/delta",
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));

  assert.match(
    fragment.notes.join("\n"),
    /providerFirstResponseDominates=turn-provider-first-response/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /MiniMax-M3 waited 2365ms from first runtime event to first assistant item, then 5ms to first text/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /reasoningBeforeFirstText=0 toolBeforeFirstText=0/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /investigate provider\/model first-response phase before client render optimization/,
  );
});

test("realtime runtime report does not use legacy batch wait windows as measured flush duration", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "runtime.json");
  await writeFile(inputPath, JSON.stringify({
    entries: [
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          evidenceClass: "measured",
          deltas: {
            firstDeltaToFirstVisibleTextMs: 25,
            lastReducerCommitToTerminalSettlementMs: 50,
          },
          counters: {
            reducerAmplification: 2,
            batchFlushDurationAvgMs: 9_647.5,
            terminalSettlementLagMs: 50,
          },
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = new Map(fragment.metrics.map((metric) => [metric.metric, metric]));

  assert.equal(byMetric.get("batchFlushDurationP95")?.evidenceClass, "unsupported");
  assert.match(
    byMetric.get("batchFlushDurationP95")?.unsupportedReason,
    /appServerEventRouteDurationAvgMs/,
  );
});

test("realtime runtime report flags fast visible output with large summary windows as consistency caution", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "runtime.json");
  await writeFile(inputPath, JSON.stringify({
    entries: [
      {
        timestamp: Date.now(),
        label: "realtime.turnTrace.summary",
        payload: {
          traceId: "tt-fast-visible-large-summary",
          evidenceClass: "measured",
          deltas: {
            firstDeltaToFirstVisibleTextMs: 177,
            firstDeltaToBatchFlushEndMs: 21_095,
            batchFlushEndToReducerCommitMs: 12_433,
            lastReducerCommitToTerminalSettlementMs: 1_788,
          },
          counters: {
            visibleTextGrowthCount: 1,
            reducerAmplification: 1,
            batchFlushDurationAvgMs: 19_962,
            appServerEventRouteDurationAvgMs: 3,
            terminalSettlementLagMs: 1_788,
          },
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));

  assert.match(
    fragment.notes.join("\n"),
    /traceConsistencyCaution=tt-fast-visible-large-summary/,
  );
  assert.match(
    fragment.notes.join("\n"),
    /inspect turnTrace\/snapshot consistency before claiming client batch or reducer lag/,
  );
});

test("realtime runtime report keeps missing diagnostics unsupported", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const outputPath = join(dir, "runtime.json");
  await runScript(["--input", join(dir, "missing.json"), "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  assert.equal(fragment.metrics[0]?.evidenceClass, "unsupported");
  assert.match(fragment.metrics[0]?.unsupportedReason, /No measured realtime/);
});
