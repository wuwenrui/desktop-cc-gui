import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

const residualProxyMetricKeys = [
  "S-IO-RR/prepareThreadItems_calls_per_1000_delta",
  "S-IO-AS/main_thread_long_task_count_during_stream",
  "S-IO-FC/fs_event_raw_per_sec",
  "S-IO-FC/fs_event_emitted_per_sec",
  "S-IO-FC/fs_event_same_path_coalesce_ratio",
  "S-IO-FC/fs_event_empty_batch_emit_count",
  "S-IO-FS/file_io_async_worker_stall_ms_p95",
  "S-IO-FS/file_io_blocking_pool_call_count",
  "S-IO-FS/tauri_command_during_stream_ms_p95",
  "S-IO-FP/composer_render_count_per_streaming_minute",
  "S-IO-FP/sidebar_render_count_per_streaming_minute",
  "S-IO-FP/thread_row_rerender_count_per_1000_delta",
  "S-IO-FP/layout_nodes_recompute_count_per_1000_delta",
];

test("v0.5.11 runtime producer emits proxy evidence for the four performance gaps", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-v0511-runtime-evidence-"));
  const outputPath = join(dir, "runtime-evidence.json");

  await runProducer(["--diagnostics=none", `--output=${outputPath}`]);

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
  assert.deepEqual(fragment.evidenceClassCounts, {
    measured: 0,
    proxy: 21,
    unsupported: 0,
  });
  for (const key of residualProxyMetricKeys) {
    const row = byMetric.get(key);
    assert.equal(row?.evidenceClass, "proxy", `${key} should remain proxy without runtime artifact`);
    assert.equal(typeof row?.measurementBlocker, "string", `${key} should document blocker`);
    assert.equal(typeof row?.requiredSourceArtifact, "string", `${key} should document required artifact`);
    assert.equal(row?.sourceArtifact, undefined, `${key} must not claim a source artifact`);
    assert.equal(row?.sampleCount, undefined, `${key} must not claim samples`);
  }
  assert.equal(fragment.proxyRatio, 1);
  assert.match(fragment.notes.join("\n"), /not release-grade desktop runtime proof/);
});

test("v0.5.11 runtime producer promotes whitelisted diagnostics to measured evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-v0511-runtime-evidence-"));
  const diagnosticsPath = join(dir, "renderer-diagnostics.json");
  const outputPath = join(dir, "runtime-evidence.json");

  await writeFile(
    diagnosticsPath,
    JSON.stringify({
      rendererDiagnostics: [
        {
          timestamp: Date.now(),
          label: "perf.v0511.runtime-evidence",
          payload: {
            scenario: "S-IO-RR",
            metric: "thread_reducer_flush_ms_p95",
            value: 7.25,
            unit: "ms",
            notes: "Measured from Tauri WebView profiler",
          },
        },
        {
          timestamp: Date.now(),
          label: "perf.v0511.runtime-evidence",
          payload: {
            scenario: "S-IO-FP",
            metric: "composer_render_count_per_streaming_minute",
            value: 42,
            unit: "count",
          },
        },
      ],
    }),
    "utf-8",
  );

  await runProducer([`--diagnostics=${diagnosticsPath}`, `--output=${outputPath}`]);

  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = metricMap(fragment);

  assert.equal(byMetric.get("S-IO-RR/thread_reducer_flush_ms_p95")?.value, 7.25);
  assert.equal(byMetric.get("S-IO-RR/thread_reducer_flush_ms_p95")?.evidenceClass, "measured");
  assert.equal(byMetric.get("S-IO-RR/thread_reducer_flush_ms_p95")?.sourceArtifact, diagnosticsPath);
  assert.equal(byMetric.get("S-IO-RR/thread_reducer_flush_ms_p95")?.sampleCount, 1);
  assert.equal(byMetric.get("S-IO-FP/composer_render_count_per_streaming_minute")?.value, 42);
  assert.equal(byMetric.get("S-IO-FP/composer_render_count_per_streaming_minute")?.evidenceClass, "measured");
  assert.equal(byMetric.get("S-IO-FP/composer_render_count_per_streaming_minute")?.sourceArtifact, diagnosticsPath);
  assert.equal(byMetric.get("S-IO-FP/composer_render_count_per_streaming_minute")?.sampleCount, 1);
  assert.equal(
    byMetric.get("S-IO-FP/composer_render_count_per_streaming_minute")?.measurementBlocker,
    undefined,
  );
  assert.equal(fragment.evidenceClassCounts.measured, 2);
  assert.equal(fragment.evidenceClassCounts.proxy, 19);
  assert.equal(fragment.proxyRatio, 0.9048);
  assert.match(fragment.notes.join("\n"), /accepted measuredMetricCount=2/);
});

test("v0.5.11 runtime producer records explicit evidence-class upgrade mode", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-v0511-runtime-evidence-"));
  const outputPath = join(dir, "runtime-evidence.json");

  await runProducer(["--diagnostics=none", "--mode=evidenceClassUpgrade", `--output=${outputPath}`]);

  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));

  assert.equal(fragment.mode, "evidenceClassUpgrade");
  assert.match(fragment.notes.join("\n"), /Evidence class upgrade mode was requested/);
});

test("v0.5.11 runtime producer ignores unsafe or malformed diagnostics", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-v0511-runtime-evidence-"));
  const diagnosticsPath = join(dir, "renderer-diagnostics.json");
  const outputPath = join(dir, "runtime-evidence.json");

  await writeFile(
    diagnosticsPath,
    JSON.stringify({
      entries: [
        {
          timestamp: Date.now(),
          label: "perf.v0511.runtime-evidence",
          payload: {
            scenario: "S-IO-RR",
            metric: "thread_reducer_flush_ms_p95",
            value: -1,
            unit: "ms",
          },
        },
        {
          timestamp: Date.now(),
          label: "perf.v0511.runtime-evidence",
          payload: {
            scenario: "S-IO-RR",
            metric: "prompt_text_should_not_be_accepted",
            value: 1,
            unit: "count",
            prompt: "sensitive user text",
          },
        },
      ],
    }),
    "utf-8",
  );

  await runProducer([`--diagnostics=${diagnosticsPath}`, `--output=${outputPath}`]);

  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = metricMap(fragment);

  assert.equal(byMetric.get("S-IO-RR/thread_reducer_flush_ms_p95")?.evidenceClass, "proxy");
  assert.match(fragment.notes.join("\n"), /accepted measuredMetricCount=0/);
  assert.doesNotMatch(JSON.stringify(fragment), /sensitive user text/);
});

test("v0.5.11 runtime producer derives measured timing from turn trace summaries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-v0511-runtime-evidence-"));
  const diagnosticsPath = join(dir, "turn-trace-diagnostics.json");
  const outputPath = join(dir, "runtime-evidence.json");

  await writeFile(
    diagnosticsPath,
    JSON.stringify({
      app: {
        diagnostics: {
          rendererLifecycleLog: [
            {
              timestamp: Date.now(),
              label: "realtime.turnTrace.summary",
              payload: {
                evidenceClass: "measured",
                startedAtMs: 1000,
                endedAtMs: 3000,
                deltas: {
                  batchFlushEndToReducerCommitMs: 3,
                },
                counters: {
                  deltaCount: 2,
                  reducerCommitCount: 2,
                  batchFlushCount: 1,
                  realtimeDeltaRouteDurationAvgMs: 4,
                  appServerEventRouteDurationAvgMs: 5,
                },
              },
            },
            {
              timestamp: Date.now(),
              label: "realtime.turnTrace.summary",
              payload: {
                evidenceClass: "measured",
                startedAtMs: 1000,
                endedAtMs: 3000,
                deltas: {
                  batchFlushEndToReducerCommitMs: 6,
                },
                counters: {
                  deltaCount: 4,
                  reducerCommitCount: 4,
                  batchFlushCount: 0,
                  realtimeDeltaRouteDurationAvgMs: 8,
                  appServerEventRouteDurationAvgMs: 9,
                },
              },
            },
          ],
        },
      },
    }),
    "utf-8",
  );

  await runProducer([`--diagnostics=${diagnosticsPath}`, `--output=${outputPath}`]);

  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = metricMap(fragment);

  assert.equal(byMetric.get("S-IO-RR/realtime_delta_route_ms_p95")?.value, 8);
  assert.equal(byMetric.get("S-IO-RR/thread_reducer_flush_ms_p95")?.value, 6);
  assert.equal(byMetric.get("S-IO-AS/app_server_event_raw_per_sec")?.value, 2);
  assert.equal(byMetric.get("S-IO-AS/app_server_event_ipc_emit_per_sec")?.value, 0.5);
  assert.equal(byMetric.get("S-IO-AS/app_server_event_route_ms_p95")?.value, 9);
  assert.equal(byMetric.get("S-IO-AS/app_server_event_route_ms_p95")?.evidenceClass, "measured");
  assert.equal(byMetric.get("S-IO-AS/app_server_event_route_ms_p95")?.sourceArtifact, diagnosticsPath);
  assert.equal(byMetric.get("S-IO-AS/app_server_event_route_ms_p95")?.sampleCount, 2);
  assert.match(byMetric.get("S-IO-AS/app_server_event_route_ms_p95")?.notes ?? "", /sampleCount=2/);
});

test("v0.5.11 runtime producer derives reducer dispatch rate from measured turn trace counters", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-v0511-runtime-evidence-"));
  const diagnosticsPath = join(dir, "turn-trace-diagnostics.json");
  const outputPath = join(dir, "runtime-evidence.json");

  await writeFile(
    diagnosticsPath,
    JSON.stringify({
      entries: [
        {
          timestamp: Date.now(),
          label: "realtime.turnTrace.summary",
          payload: {
            evidenceClass: "measured",
            startedAtMs: 1000,
            endedAtMs: 3000,
            counters: {
              deltaCount: 12,
              reducerCommitCount: 24,
              batchFlushCount: 3,
              appServerEventRouteDurationAvgMs: 10,
            },
          },
        },
        {
          timestamp: Date.now(),
          label: "realtime.turnTrace.summary",
          payload: {
            evidenceClass: "measured",
            startedAtMs: 1000,
            endedAtMs: 3000,
            counters: {
              deltaCount: 14,
              reducerCommitCount: 56,
              batchFlushCount: 4,
              appServerEventRouteDurationAvgMs: 14,
            },
          },
        },
      ],
    }),
    "utf-8",
  );

  await runProducer([`--diagnostics=${diagnosticsPath}`, `--output=${outputPath}`]);

  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = metricMap(fragment);
  const reducerDispatchRate = byMetric.get(
    "S-IO-RR/realtime_reducer_dispatches_per_1000_delta",
  );
  const appServerRoute = byMetric.get("S-IO-AS/app_server_event_route_ms_p95");
  const appServerDispatchRate = byMetric.get(
    "S-IO-AS/realtime_reducer_dispatches_per_1000_delta",
  );
  const appServerEventRate = byMetric.get("S-IO-AS/app_server_event_raw_per_sec");
  const appServerIpcRate = byMetric.get("S-IO-AS/app_server_event_ipc_emit_per_sec");

  assert.equal(reducerDispatchRate?.value, 4000);
  assert.equal(reducerDispatchRate?.evidenceClass, "measured");
  assert.equal(reducerDispatchRate?.sourceArtifact, diagnosticsPath);
  assert.equal(reducerDispatchRate?.sampleCount, 2);
  assert.equal(appServerDispatchRate?.value, 4000);
  assert.equal(appServerDispatchRate?.evidenceClass, "measured");
  assert.equal(appServerEventRate?.value, 7);
  assert.equal(appServerIpcRate?.value, 2);
  assert.equal(appServerRoute?.value, 14);
  assert.doesNotMatch(JSON.stringify(fragment), /firstDeltaToFirstVisibleTextMs/);
});

test("v0.5.11 runtime producer derives file I/O wall time from measured workspace listing diagnostics", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-v0511-runtime-evidence-"));
  const diagnosticsPath = join(dir, "workspace-listing-diagnostics.json");
  const outputPath = join(dir, "runtime-evidence.json");

  await writeFile(
    diagnosticsPath,
    JSON.stringify({
      entries: [
        {
          timestamp: Date.now(),
          label: "workspaces.file.listing-budget",
          payload: {
            evidenceClass: "measured",
            durationMs: 123.45,
            surfaceId: "initial-listing",
          },
        },
      ],
    }),
    "utf-8",
  );

  await runProducer([`--diagnostics=${diagnosticsPath}`, `--output=${outputPath}`]);

  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = metricMap(fragment);
  const fileIoWallTime = byMetric.get("S-IO-FS/file_io_command_wall_ms_p95");

  assert.equal(fileIoWallTime?.value, 123.45);
  assert.equal(fileIoWallTime?.evidenceClass, "measured");
  assert.equal(fileIoWallTime?.sourceArtifact, diagnosticsPath);
  assert.equal(fileIoWallTime?.sampleCount, 1);
  assert.match(fileIoWallTime?.notes ?? "", /workspace file listing command duration/);
});

test("v0.5.11 runtime producer does not promote legacy turn-window timings as measured route evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-v0511-runtime-evidence-"));
  const diagnosticsPath = join(dir, "legacy-turn-trace-diagnostics.json");
  const outputPath = join(dir, "runtime-evidence.json");

  await writeFile(
    diagnosticsPath,
    JSON.stringify({
      entries: [
        {
          timestamp: Date.now(),
          label: "realtime.turnTrace.summary",
          payload: {
            evidenceClass: "measured",
            deltas: {
              firstDeltaToBatchFlushEndMs: 35_600,
              batchFlushEndToReducerCommitMs: 2_065,
            },
            counters: {
              deltaCount: 32,
              reducerCommitCount: 32,
              batchFlushDurationAvgMs: 9_647.5,
            },
          },
        },
      ],
    }),
    "utf-8",
  );

  await runProducer([`--diagnostics=${diagnosticsPath}`, `--output=${outputPath}`]);

  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = metricMap(fragment);

  assert.equal(byMetric.get("S-IO-RR/realtime_delta_route_ms_p95")?.evidenceClass, "proxy");
  assert.notEqual(byMetric.get("S-IO-RR/realtime_delta_route_ms_p95")?.value, 35_600);
  assert.equal(byMetric.get("S-IO-AS/app_server_event_route_ms_p95")?.evidenceClass, "proxy");
  assert.notEqual(byMetric.get("S-IO-AS/app_server_event_route_ms_p95")?.value, 9_647.5);
  assert.equal(byMetric.get("S-IO-RR/thread_reducer_flush_ms_p95")?.value, 2_065);
  assert.equal(byMetric.get("S-IO-RR/thread_reducer_flush_ms_p95")?.evidenceClass, "measured");
});
