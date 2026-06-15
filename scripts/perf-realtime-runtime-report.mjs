#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_INPUT_PATH = ".artifacts/realtime-runtime-diagnostics.json";
const DEFAULT_OUTPUT_PATH = "docs/perf/realtime-runtime-evidence.json";

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index !== -1) {
    return process.argv[index + 1] ?? null;
  }
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function percentile(values, ratio) {
  const finite = values
    .map(toFiniteNumber)
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  if (finite.length === 0) {
    return null;
  }
  const index = Math.min(finite.length - 1, Math.max(0, Math.ceil(finite.length * ratio) - 1));
  return Number((finite[index] ?? 0).toFixed(2));
}

function median(values) {
  const finite = values
    .map(toFiniteNumber)
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  if (finite.length === 0) {
    return null;
  }
  const middle = Math.floor(finite.length / 2);
  const value = finite.length % 2 === 0
    ? ((finite[middle - 1] ?? 0) + (finite[middle] ?? 0)) / 2
    : (finite[middle] ?? 0);
  return Number(value.toFixed(3));
}

function collectEntries(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (!isRecord(input)) {
    return [];
  }
  for (const key of ["entries", "diagnostics", "rendererDiagnostics", "rendererLifecycleLog"]) {
    if (Array.isArray(input[key])) {
      return input[key];
    }
  }
  if (isRecord(input.app) && Array.isArray(input.app.diagnostics?.rendererLifecycleLog)) {
    return input.app.diagnostics.rendererLifecycleLog;
  }
  return [];
}

function collectMeasuredSummaries(entries) {
  return entries
    .filter((entry) => isRecord(entry) && entry.label === "realtime.turnTrace.summary")
    .map((entry) => (isRecord(entry.payload) ? entry.payload : null))
    .filter((payload) => payload !== null)
    .filter((payload) => payload.evidenceClass === "measured");
}

function metricFromValues({ scenario, metric, values, unit, notes, unsupportedReason }) {
  const value = metric === "reducerAmplificationMedian"
    ? median(values)
    : percentile(values, 0.95);
  return {
    scenario,
    metric,
    value,
    unit,
    evidenceClass: value === null ? "unsupported" : "measured",
    notes: value === null ? undefined : notes,
    unsupportedReason: value === null ? unsupportedReason : undefined,
  };
}

function buildFragment(summaries, sourcePath) {
  const unsupportedReason = summaries.length === 0
    ? "No measured realtime.turnTrace.summary diagnostics were found. Enable turn trace in a Tauri/webview session and export renderer diagnostics."
    : undefined;
  const visibleTextLagValues = summaries.map((summary) => summary.deltas?.firstDeltaToFirstVisibleTextMs);
  const reducerAmplificationValues = summaries.map((summary) => summary.counters?.reducerAmplification);
  const batchFlushDurationValues = summaries.map((summary) => summary.counters?.batchFlushDurationAvgMs);
  const terminalSettlementValues = summaries.map((summary) =>
    summary.counters?.terminalSettlementLagMs ?? summary.deltas?.lastReducerCommitToTerminalSettlementMs
  );
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    source: "realtime-runtime",
    metrics: [
      metricFromValues({
        scenario: "S-RS-VL",
        metric: "visibleTextLagP95",
        values: visibleTextLagValues,
        unit: "ms",
        notes: `measured runtime turn trace from ${sourcePath}`,
        unsupportedReason,
      }),
      metricFromValues({
        scenario: "S-RS-RA",
        metric: "reducerAmplificationMedian",
        values: reducerAmplificationValues,
        unit: "ratio",
        notes: `measured runtime turn trace from ${sourcePath}`,
        unsupportedReason,
      }),
      metricFromValues({
        scenario: "S-RS-FD",
        metric: "batchFlushDurationP95",
        values: batchFlushDurationValues,
        unit: "ms",
        notes: `measured runtime turn trace from ${sourcePath}`,
        unsupportedReason,
      }),
      metricFromValues({
        scenario: "S-RS-TS",
        metric: "terminalSettlementP95",
        values: terminalSettlementValues,
        unit: "ms",
        notes: `measured runtime turn trace from ${sourcePath}`,
        unsupportedReason,
      }),
    ],
    notes: [
      `input=${sourcePath}`,
      `measuredSummaryCount=${summaries.length}`,
      "contentSafety=ids, durations, counters, and dimensions only; no prompt, assistant text, tool output, or file content",
    ],
  };
}

async function writeJson(path, value) {
  const absolutePath = resolve(process.cwd(), path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

async function main() {
  const inputPath = getArgValue("--input") ?? DEFAULT_INPUT_PATH;
  const outputPath = getArgValue("--output") ?? DEFAULT_OUTPUT_PATH;
  let input = null;
  if (existsSync(resolve(process.cwd(), inputPath))) {
    input = JSON.parse(await readFile(resolve(process.cwd(), inputPath), "utf-8"));
  }
  const summaries = collectMeasuredSummaries(collectEntries(input));
  await writeJson(outputPath, buildFragment(summaries, inputPath));
  if (process.argv.includes("--verbose")) {
    console.info(`realtime runtime measured summaries: ${summaries.length}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
