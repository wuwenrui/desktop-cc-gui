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
            batchFlushDurationAvgMs: 10,
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
            batchFlushDurationAvgMs: 14,
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

test("realtime runtime report keeps missing diagnostics unsupported", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-realtime-runtime-"));
  const outputPath = join(dir, "runtime.json");
  await runScript(["--input", join(dir, "missing.json"), "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  assert.equal(fragment.metrics[0]?.evidenceClass, "unsupported");
  assert.match(fragment.metrics[0]?.unsupportedReason, /No measured realtime/);
});
