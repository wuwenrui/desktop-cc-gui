import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function runProducer(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "npm",
      ["exec", "vite-node", "--", "scripts/perf-v0511-runtime-evidence.ts", ...args],
      { cwd: process.cwd() },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
  });
}

function metricMap(fragment) {
  return new Map(
    fragment.metrics.map((metric) => [`${metric.scenario}/${metric.metric}`, metric]),
  );
}

test("v0.5.11 runtime producer emits proxy evidence for the four performance gaps", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mossx-v0511-runtime-evidence-"));
  const outputPath = join(dir, "runtime-evidence.json");

  await runProducer([`--output=${outputPath}`]);

  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = metricMap(fragment);

  for (const key of [
    "S-IO-RR/thread_reducer_flush_ms_p95",
    "S-IO-RR/realtime_delta_route_ms_p95",
    "S-IO-AS/app_server_event_route_ms_p95",
    "S-IO-AS/main_thread_long_task_count_during_stream",
    "S-IO-FS/file_io_command_wall_ms_p95",
    "S-IO-FS/file_io_async_worker_stall_ms_p95",
    "S-IO-FS/file_io_blocking_pool_call_count",
    "S-IO-FS/tauri_command_during_stream_ms_p95",
    "S-IO-FP/composer_render_count_per_streaming_minute",
    "S-IO-FP/sidebar_render_count_per_streaming_minute",
    "S-IO-FP/thread_row_rerender_count_per_1000_delta",
    "S-IO-FP/layout_nodes_recompute_count_per_1000_delta",
  ]) {
    const row = byMetric.get(key);
    assert.equal(row?.evidenceClass, "proxy", `${key} should be proxy evidence`);
    assert.equal(typeof row?.value, "number", `${key} should have a numeric value`);
  }

  assert.equal(byMetric.get("S-IO-RR/prepareThreadItems_calls_per_1000_delta")?.value, 0);
  assert.equal(byMetric.get("S-IO-AS/realtime_reducer_dispatches_per_1000_delta")?.value, 1000);
  assert.match(fragment.notes.join("\n"), /not release-grade desktop runtime proof/);
});
