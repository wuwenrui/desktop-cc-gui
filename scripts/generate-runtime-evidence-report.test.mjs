import test from "node:test";
import assert from "node:assert/strict";

import { runtimeEvidenceReportInternals } from "./generate-runtime-evidence-report.mjs";

const {
  buildBackendBridgeSummary,
  buildLargeFileSummary,
  buildPerfEvidence,
  buildRealtimeProfileEvidence,
  buildRendererResourceSummary,
  buildRealtimeSummary,
  buildMarkdownPrecomputeSummary,
  buildWorkspaceFileListingSummary,
  buildRealtimeInputRenderBudgetSummary,
  buildFileChangeEventDebounceSummary,
  buildBackendFileIoIsolationSummary,
} = runtimeEvidenceReportInternals;

test("buildPerfEvidence emits unsupported evidence when browser source is missing", () => {
  const evidence = buildPerfEvidence([
    { path: "docs/perf/long-list-browser-scroll.json", fragment: null },
  ]);

  assert.equal(evidence.length, 1);
  assert.deepEqual(
    {
      scenario: evidence[0]?.scenario,
      metric: evidence[0]?.metric,
      value: evidence[0]?.value,
      evidenceClass: evidence[0]?.evidenceClass,
    },
    {
      scenario: "S-LL-1000",
      metric: "browserScrollFrameDropPct",
      value: null,
      evidenceClass: "unsupported",
    },
  );
  assert.match(evidence[0]?.reason ?? "", /Missing source file/);
});

test("buildPerfEvidence emits unsupported evidence when baseline source is missing", () => {
  const evidence = buildPerfEvidence([
    { path: "docs/perf/baseline.json", fragment: null },
  ]);

  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.scenario, "runtime-perf-baseline");
  assert.equal(evidence[0]?.metric, "sourceFileAvailable");
  assert.equal(evidence[0]?.evidenceClass, "unsupported");
});

test("buildPerfEvidence preserves structured budget metadata", () => {
  const evidence = buildPerfEvidence([
    {
      path: "docs/perf/baseline.json",
      fragment: {
        metrics: [
          {
            scenario: "S-CS-COLD",
            metric: "bundleSizeMain",
            value: 1200,
            unit: "bytes",
            budget: {
              observed: 1200,
              target: 1000,
              hardFail: 1500,
              unit: "bytes-gzip",
              evidenceClass: "measured",
              source: "docs/perf/baseline.json",
            },
          },
        ],
      },
    },
  ]);

  assert.equal(evidence[0]?.budget?.target, 1000);
  assert.equal(evidence[0]?.budget?.hardFail, 1500);
});

test("buildPerfEvidence classifies composer input fixture evidence as proxy", () => {
  const evidence = buildPerfEvidence([
    {
      path: "docs/perf/composer-baseline.json",
      fragment: {
        metrics: [
          {
            scenario: "S-CI-50",
            metric: "keystrokeToCommitP95",
            value: 12,
            unit: "ms",
          },
        ],
      },
    },
  ]);

  assert.equal(evidence[0]?.source, "docs/perf/composer-baseline.json");
  assert.equal(evidence[0]?.scenario, "S-CI-50");
  assert.equal(evidence[0]?.evidenceClass, "proxy");
  assert.match(evidence[0]?.reason ?? "", /Fixture/);
});

test("buildRealtimeProfileEvidence maps profiler artifact metrics into prop-chain evidence", () => {
  const evidence = buildRealtimeProfileEvidence([
    {
      scenario: "S-IO-FP",
      metric: "thread_row_rerender_count_per_1000_delta",
      value: 1,
      unit: "count",
      evidenceClass: "proxy",
      notes: "ThreadList selector fixture",
    },
  ]);

  assert.deepEqual(evidence[0], {
    source: "docs/perf/realtime-profile.jsonl",
    scenario: "S-IO-FP",
    metric: "thread_row_rerender_count_per_1000_delta",
    value: 1,
    unit: "count",
    evidenceClass: "proxy",
    budget: null,
    reason: "ThreadList selector fixture",
    nextAction: "Promote proxy fixture evidence to measured live-session evidence when available.",
  });
});

test("buildRealtimeProfileEvidence accepts backend file I/O metrics", () => {
  const evidence = buildRealtimeProfileEvidence([
    {
      scenario: "S-IO-FS",
      metric: "file_io_command_wall_ms_p95",
      value: 12.5,
      unit: "ms",
      evidenceClass: "measured",
      notes: "run_blocking_file_io wall time",
    },
  ]);

  assert.equal(evidence[0]?.source, "docs/perf/realtime-profile.jsonl");
  assert.equal(evidence[0]?.scenario, "S-IO-FS");
  assert.equal(evidence[0]?.metric, "file_io_command_wall_ms_p95");
  assert.equal(evidence[0]?.value, 12.5);
  assert.equal(evidence[0]?.evidenceClass, "measured");
});

test("buildPerfEvidence preserves v0.5.11 S-IO producer evidence", () => {
  const evidence = buildPerfEvidence([
    {
      path: "docs/perf/v0511-runtime-evidence.json",
      fragment: {
        metrics: [
          {
            scenario: "S-IO-FC",
            metric: "fs_event_same_path_coalesce_ratio",
            value: 0.999,
            unit: "ratio",
            evidenceClass: "proxy",
            notes: "same-path burst fixture",
            measurementBlocker: "native watcher diagnostic is not available",
            requiredSourceArtifact: "native file watcher throughput artifact",
          },
        ],
      },
    },
  ]);

  assert.equal(evidence[0]?.source, "docs/perf/v0511-runtime-evidence.json");
  assert.equal(evidence[0]?.scenario, "S-IO-FC");
  assert.equal(evidence[0]?.metric, "fs_event_same_path_coalesce_ratio");
  assert.equal(evidence[0]?.value, 0.999);
  assert.equal(evidence[0]?.evidenceClass, "proxy");
  assert.match(evidence[0]?.reason ?? "", /same-path burst/);
  assert.match(evidence[0]?.reason ?? "", /native watcher diagnostic is not available/);
  assert.match(evidence[0]?.nextAction ?? "", /native file watcher throughput artifact/);
});

test("S-IO summaries use producer-aware reason text", () => {
  const inputSummary = buildRealtimeInputRenderBudgetSummary([
    {
      scenario: "S-IO-RR",
      metric: "prepareThreadItems_calls_per_1000_delta",
      value: 0,
      evidenceClass: "proxy",
    },
  ]);
  assert.equal(inputSummary.evidenceClass, "proxy");
  assert.match(inputSummary.reason, /Producer artifact is present/);
  assert.doesNotMatch(inputSummary.nextAction, /Wire prepareThreadItems/);

  const completeInputSummary = buildRealtimeInputRenderBudgetSummary([
    {
      scenario: "S-IO-RR",
      metric: "prepareThreadItems_calls_per_1000_delta",
      value: 0,
      evidenceClass: "proxy",
    },
    {
      scenario: "S-IO-RR",
      metric: "thread_reducer_flush_ms_p95",
      value: 0.03,
      evidenceClass: "proxy",
    },
    {
      scenario: "S-IO-RR",
      metric: "realtime_delta_route_ms_p95",
      value: 0.01,
      evidenceClass: "proxy",
    },
  ]);
  assert.match(completeInputSummary.reason, /route timing proxy evidence/);
  assert.doesNotMatch(completeInputSummary.reason, /unsupported/);

  const debounceSummary = buildFileChangeEventDebounceSummary([
    {
      scenario: "S-IO-FC",
      metric: "fs_event_same_path_coalesce_ratio",
      value: 0.999,
      evidenceClass: "proxy",
    },
  ]);
  assert.equal(debounceSummary.evidenceClass, "proxy");
  assert.match(debounceSummary.reason, /same-path burst/);

  const backendSummary = buildBackendFileIoIsolationSummary([
    {
      scenario: "S-IO-FS",
      metric: "file_io_command_wall_ms_p95",
      value: null,
      evidenceClass: "unsupported",
      reason: "No reproducible backend file I/O timing producer exists yet.",
    },
  ]);
  assert.equal(backendSummary.evidenceClass, "unsupported");
  assert.match(backendSummary.reason, /No reproducible backend file I\/O timing producer/);
});

test("buildRealtimeSummary keeps malformed proxy values from looking bounded", () => {
  const summary = buildRealtimeSummary([
    {
      scenario: "S-RS-FT",
      metric: "firstTokenLatency",
      value: "unsupported",
      evidenceClass: "unsupported",
    },
  ]);

  assert.equal(summary.visibleLagRisk, "unsupported");
  assert.equal(summary.evidenceClass, "unsupported");
});

test("buildRendererResourceSummary exposes backpressure listener and media fields", () => {
  const summary = buildRendererResourceSummary([
    {
      source: "docs/perf/realtime-extended-baseline.json",
      scenario: "S-RS-FD",
      metric: "batchFlushDurationP95",
      value: 8,
      evidenceClass: "proxy",
      reason: "fixture",
    },
  ]);

  assert.equal(summary.backpressure.eventFlushCap, 200);
  assert.equal(summary.backpressure.byteFlushCap, 128 * 1024);
  assert.equal(summary.backpressure.evidenceClass, "proxy");
  assert.ok(summary.listenerOwners.ownerTaxonomy.includes("workspace"));
  assert.ok(summary.mediaOwners.migratedPilotSurfaces.includes("message-image-grid"));
});

test("buildBackendBridgeSummary exposes substrate and payload budget fields", () => {
  const summary = buildBackendBridgeSummary();

  assert.equal(summary.bridgePayload.pilotCommand, "get_git_log");
  assert.equal(summary.bridgePayload.targetBytes, 1024 * 1024);
  assert.ok(summary.bridgePayload.metadataFields.includes("estimatedBytes"));
  assert.match(summary.bridgePayload.contentSafety, /excludes absolute paths/);
  assert.ok(summary.residualRisk.includes("workspace files"));
});

test("buildWorkspaceFileListingSummary exposes listing budget and shared index contract", () => {
  const summary = buildWorkspaceFileListingSummary([
    {
      source: "docs/perf/long-list-baseline.json",
      scenario: "S-LL-1000",
      metric: "commitDurationP95",
      value: 14,
      evidenceClass: "proxy",
    },
  ]);

  assert.equal(summary.diagnosticsLabel, "workspaces.file.listing-budget");
  assert.equal(summary.initialListing.targetPayloadBytes, 1024 * 1024);
  assert.equal(summary.subtreeListing.targetEntries, 500);
  assert.ok(summary.metadataFields.includes("payloadBytes"));
  assert.ok(summary.sharedIndex.contract.includes("sourceVersion"));
  assert.match(summary.contentSafety, /raw paths are excluded/);
});

test("buildMarkdownPrecomputeSummary exposes modes threshold and safety boundary", () => {
  const summary = buildMarkdownPrecomputeSummary();

  assert.equal(summary.diagnosticsLabel, "perf.messages.markdown.precompute");
  assert.equal(summary.threshold.minLengthChars, 10_000);
  assert.ok(summary.modes.includes("worker-precompute"));
  assert.ok(summary.metadataFields.includes("fallbackReason"));
  assert.match(summary.unsafeHtmlBoundary, /not trusted DOM/);
  assert.match(summary.contentSafety, /raw Markdown/);
});

test("buildLargeFileSummary tolerates older reports without fail thresholds", () => {
  const summary = buildLargeFileSummary({
    status: "warn",
    results: [
      {
        path: "src/features/messages/components/MessagesTimeline.tsx",
        lines: 756,
        priority: "P1",
      },
    ],
  });

  assert.equal(summary.candidates.length, 1);
  assert.equal(summary.candidates[0]?.headroom, null);
});
