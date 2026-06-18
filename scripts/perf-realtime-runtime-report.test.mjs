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
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = new Map(fragment.metrics.map((metric) => [metric.metric, metric]));
  assert.equal(byMetric.get("visibleTextLagP95")?.value, 35);
  assert.equal(byMetric.get("reducerAmplificationMedian")?.value, 3);
  assert.equal(byMetric.get("batchFlushDurationP95")?.evidenceClass, "measured");
  assert.match(fragment.notes.join("\n"), /contentSafety=/);
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
