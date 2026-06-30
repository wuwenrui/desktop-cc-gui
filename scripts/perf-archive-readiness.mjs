#!/usr/bin/env node

// perf-archive-readiness.mjs
//
// Archive-readiness gate for P0/P1 performance changes.
//
// Reads:
//   - docs/perf/baseline.json
//   - docs/perf/runtime-evidence-gates.json
//
// Checks (hard fail -> exit 1):
//   1. Evidence class coverage: every metric record must declare evidenceClass.
//   2. Unit consistency: observed unit and budget.unit must match when both present.
//   3. HardFail annotation: every record with budget.hardFail must carry
//      budget.rollout, top-level rollout, or top-level status.
//   4. ArchiveReadiness staleness: archiveReadiness.completed must not list
//      change names that are absent from current `openspec list --json` active
//      changes (excluding this closure change).
//   5. Large-file debt ownership: every P0/P1 candidate in
//      largeFileSummary.candidates[] must include owner and followUp.
//
// Checks (residual -> exit 2, not 1):
//   - Missing budget block (warn).
//   - Unsupported evidence class (residual risk; must remain visible).
//
// Release mode (`--release`) is stricter:
//   - Metrics above budget.hardFail are hard failures.
//   - Release-required runtime evidence cannot remain unsupported.
//   - Proxy release evidence remains visible as residual debt.
//
// Exit codes:
//   0  pass (no hard fail, no warn/residual)
//   1  hard failure
//   2  no hard failure, but warn/residual items exist
//   3  unexpected script error (input missing, etc.)

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const PERF_BASELINE_PATH = "docs/perf/baseline.json";
const RUNTIME_EVIDENCE_GATES_PATH = "docs/perf/runtime-evidence-gates.json";
const SELF_CHANGE_NAME = "close-performance-iteration-2026-06";

const RELEASE_REQUIRED_RECORDS = new Map([
  ["S-CS-COLD/bundleSizeMain", { owner: "bundle-size-optimization", nextAction: "Reduce main bundle below hardFail or record release blocker." }],
  ["S-CS-COLD/firstPaintMs", { owner: "release-grade-evidence-collection", nextAction: "Collect measured Tauri/webview first-paint timing." }],
  ["S-CS-COLD/firstInteractiveMs", { owner: "release-grade-evidence-collection", nextAction: "Collect measured Tauri/webview first-interactive timing." }],
  ["S-RS-VL/visibleTextLagP95", { owner: "release-grade-evidence-collection", nextAction: "Collect runtime visible text lag from correlated runtime milestones." }],
  ["S-RS-RA/reducerAmplificationMedian", { owner: "release-grade-evidence-collection", nextAction: "Collect runtime reducer amplification counters." }],
  ["S-RS-FD/batchFlushDurationP95", { owner: "release-grade-evidence-collection", nextAction: "Collect runtime batch flush duration timings." }],
  ["S-RS-TS/terminalSettlementP95", { owner: "release-grade-evidence-collection", nextAction: "Collect runtime terminal settlement timings." }],
]);

const BUDGET_RESIDUALS = new Map([
  ["S-LL-200/commitDurationP50", ["release-grade-evidence-collection", "Define owner-approved long-list commit budget by row count."]],
  ["S-LL-200/commitDurationP95", ["release-grade-evidence-collection", "Define owner-approved long-list commit budget by row count."]],
  ["S-LL-200/firstPaintAfterMount", ["release-grade-evidence-collection", "Define browser/runtime first-paint budget before hard gate."]],
  ["S-LL-500/commitDurationP50", ["release-grade-evidence-collection", "Define owner-approved long-list commit budget by row count."]],
  ["S-LL-500/commitDurationP95", ["release-grade-evidence-collection", "Define owner-approved long-list commit budget by row count."]],
  ["S-LL-500/firstPaintAfterMount", ["release-grade-evidence-collection", "Define browser/runtime first-paint budget before hard gate."]],
  ["S-LL-1000/commitDurationP50", ["release-grade-evidence-collection", "Define owner-approved long-list commit budget by row count."]],
  ["S-LL-1000/commitDurationP95", ["release-grade-evidence-collection", "Define owner-approved long-list commit budget by row count."]],
  ["S-LL-1000/firstPaintAfterMount", ["release-grade-evidence-collection", "Define browser/runtime first-paint budget before hard gate."]],
  ["S-CI-50/compositionToCommit", ["input-latency-budget", "Define IME/runtime composition-to-commit budget source."]],
  ["S-CI-100-IME/compositionToCommit", ["input-latency-budget", "Define IME/runtime composition-to-commit budget source."]],
  ["S-RS-PE/dedupHitRatio", ["realtime-runtime-evidence", "Keep diagnostic until release hard-budget source is approved."]],
  ["S-RS-PE/assemblerLatency", ["realtime-runtime-evidence", "Define runtime assembler latency budget source."]],
  ["S-CS-COLD/firstPaintMs", ["release-grade-evidence-collection", "Collect measured Tauri/webview first-paint timing before setting budget."]],
  ["S-CS-COLD/firstInteractiveMs", ["release-grade-evidence-collection", "Collect measured Tauri/webview first-interactive timing before setting budget."]],
  // 2026-06-24-harden-realtime-interaction-jank-during-tool-call: 3 new capability budgets.
  ["S-RS-SP/main_thread_long_task_count_during_stream", ["realtime-runtime-evidence", "v0.5.13 release run measured 10min long-task count; guard <= 0 / aggressive <= 0 (anchor: docs/perf/v0.5.13-baseline.json)."]],
  ["S-RS-SP/app_server_event_idle_yield_count", ["realtime-runtime-evidence", "v0.5.13 release run measured idle-yield count over 10min turn with input pending; guard >= 5 / aggressive >= 20 (capability streaming-schedule-tier-rollback §1)."]],
  ["S-TAIL-GATE/toolOutputTailGateSaturated", ["realtime-runtime-evidence", "v0.5.13 release run measured gate saturation count over 10min tool-call turn; guard 1-10 / aggressive 10-50 (capability tool-output-tail-gate §1)."]],
  ["S-TAIL-GATE/toolOutputTailGateBufferOverflow", ["realtime-runtime-evidence", "v0.5.13 release run measured 1MB buffer overflow count; guard < 5 / aggressive < 20 (capability tool-output-tail-gate §1)."]],
  ["S-RSC-TIER/realtime_reducer_dispatches_per_1000_delta", ["realtime-runtime-evidence", "v0.5.13 release run measured per-1000-delta reducer dispatch count; guard <= 700 / aggressive <= 500 (capability streaming-schedule-tier-rollback §1, baseline 1000 = v0.5.11 proxy)."]],
  ["S-RSC-TIER/appendAgentMessageDelta_first_token_p95", ["realtime-runtime-evidence", "v0.5.13 release run measured first-token p95; guard <= 25.2 ms / aggressive <= 25.2 ms (退化 < 5% vs 24ms baseline)."]],
]);

const VALID_EVIDENCE_CLASSES = new Set([
  "measured",
  "proxy",
  "synthetic",
  "manual-only",
  "unsupported",
]);

const PROXY_RATIO_WARN_THRESHOLD = 0.5;
const REQUIRED_ACCEPTED_DISPOSITION_FIELDS = [
  "owner",
  "source",
  "reason",
  "releaseDecision",
  "nextAction",
];

function repoPath(path) {
  return resolve(process.cwd(), path);
}

async function readJsonIfExists(path) {
  const absolutePath = repoPath(path);
  if (!existsSync(absolutePath)) {
    return null;
  }
  return JSON.parse(await readFile(absolutePath, "utf-8"));
}

function getArgValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function readOpenSpecActiveNamesFromJson(parsed) {
  const names = Array.isArray(parsed?.changes)
    ? parsed.changes.map((c) => c?.name).filter(Boolean)
    : [];
  return new Set(names);
}

async function readOpenSpecActiveNamesFromDirectory() {
  const changesDir = repoPath("openspec/changes");
  const entries = await readdir(changesDir, { withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => (
        entry.isDirectory()
        && entry.name !== "archive"
        && !entry.name.startsWith(".")
      ))
      .map((entry) => entry.name),
  );
}

async function getOpenSpecActiveNames(activeChangesJsonPath) {
  if (activeChangesJsonPath) {
    const parsed = await readJsonIfExists(activeChangesJsonPath);
    return {
      names: readOpenSpecActiveNamesFromJson(parsed),
      source: activeChangesJsonPath,
    };
  }
  try {
    const output = execFileSync("openspec", ["list", "--json"], {
      cwd: process.cwd(),
      encoding: "utf-8",
    });
    return {
      names: readOpenSpecActiveNamesFromJson(JSON.parse(output)),
      source: "openspec list --json",
    };
  } catch (error) {
    try {
      return {
        names: await readOpenSpecActiveNamesFromDirectory(),
        source: "openspec/changes directory fallback",
      };
    } catch (fallbackError) {
      throw new Error(
        `Failed to read \`openspec list --json\`: ${error.message ?? String(error)}; ` +
          `directory fallback failed: ${fallbackError.message ?? String(fallbackError)}`
      );
    }
  }
}

function recordLabel(record) {
  const scenario = record?.scenario ?? "?";
  const metric = record?.metric ?? "?";
  return `${scenario}/${metric}`;
}

function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasAcceptedDispositionFields(entry, extraFields = []) {
  return [...REQUIRED_ACCEPTED_DISPOSITION_FIELDS, ...extraFields]
    .every((field) => hasNonEmptyString(entry?.[field]));
}

function acceptedBudgetResidualsByRecord(runtimeGates) {
  const entries = Array.isArray(runtimeGates?.archiveReadiness?.acceptedBudgetResiduals)
    ? runtimeGates.archiveReadiness.acceptedBudgetResiduals
    : [];
  return new Map(
    entries
      .filter((entry) => hasNonEmptyString(entry?.record))
      .map((entry) => [entry.record, entry]),
  );
}

function acceptedUnsupportedEvidenceByRecord(runtimeGates) {
  const entries = Array.isArray(runtimeGates?.archiveReadiness?.acceptedUnsupportedEvidence)
    ? runtimeGates.archiveReadiness.acceptedUnsupportedEvidence
    : [];
  return new Map(
    entries
      .filter((entry) => hasNonEmptyString(entry?.record))
      .map((entry) => [entry.record, entry]),
  );
}

function hasAcceptedProxyEvidenceDebt(runtimeGates) {
  return hasAcceptedDispositionFields(
    runtimeGates?.archiveReadiness?.acceptedProxyEvidenceDebt,
    ["status"],
  );
}

function runtimeMetricRecords(runtimeGates) {
  return [
    ...(Array.isArray(runtimeGates?.performanceEvidence)
      ? runtimeGates.performanceEvidence
      : []),
    ...(Array.isArray(runtimeGates?.realtimeTraceBudgets)
      ? runtimeGates.realtimeTraceBudgets
      : []),
  ];
}

function runtimeEvidenceObjects(runtimeGates) {
  const records = [];
  function visit(value, path) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}.${index}`));
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Object.prototype.hasOwnProperty.call(value, "evidenceClass")) {
      records.push({ path, record: value });
    }
    for (const [key, child] of Object.entries(value)) {
      visit(child, path ? `${path}.${key}` : key);
    }
  }
  visit(runtimeGates, "runtimeEvidenceGates");
  return records;
}

function evidenceClassMetricRecords(baseline, runtimeGates) {
  return [
    ...(Array.isArray(baseline?.metrics) ? baseline.metrics : []),
    ...runtimeMetricRecords(runtimeGates),
  ];
}

function evidenceObjectLabel(item) {
  const label = recordLabel(item.record);
  return label === "?/?" ? item.path : `${item.path}:${label}`;
}

function checkEvidenceClassCoverage(baseline, runtimeGates) {
  const failures = [];
  const metrics = [
    ...(Array.isArray(baseline?.metrics) ? baseline.metrics : []),
    ...runtimeMetricRecords(runtimeGates),
  ];
  for (const metric of metrics) {
    const cls = metric?.evidenceClass;
    if (cls === undefined || cls === null || cls === "") {
      failures.push({
        check: "evidence-class-missing",
        record: recordLabel(metric),
        detail: "metric record is missing evidenceClass",
      });
      continue;
    }
    if (!VALID_EVIDENCE_CLASSES.has(cls)) {
      failures.push({
        check: "evidence-class-invalid",
        record: recordLabel(metric),
        detail: `evidenceClass=${cls} is not one of ${[...VALID_EVIDENCE_CLASSES].join(", ")}`,
      });
    }
  }
  return failures;
}

function collectUnitConflict(record, failures) {
  const observedUnit = record?.unit;
  const budget = record?.budget;
  if (!budget) return false;
  const budgetUnit = budget?.unit;
  if (observedUnit && budgetUnit && observedUnit !== budgetUnit) {
    failures.push({
      check: "unit-conflict",
      record: recordLabel(record),
      detail: `observed unit=${observedUnit}, budget unit=${budgetUnit}`,
    });
  }
  return true;
}

function checkUnitConsistency(baseline, runtimeGates) {
  const failures = [];
  const warnings = [];
  const metrics = Array.isArray(baseline?.metrics) ? baseline.metrics : [];
  const acceptedResiduals = acceptedBudgetResidualsByRecord(runtimeGates);
  for (const metric of metrics) {
    const hasBudget = collectUnitConflict(metric, failures);
    if (!hasBudget) {
      const label = recordLabel(metric);
      const residual = BUDGET_RESIDUALS.get(label);
      const acceptedResidual = acceptedResiduals.get(label);
      if (acceptedResidual && hasAcceptedDispositionFields(acceptedResidual)) {
        continue;
      }
      warnings.push({
        check: "budget-missing",
        record: label,
        detail: `metric has observed unit=${metric?.unit ?? "?"} but no budget block`,
        owner: residual?.[0] ?? "unassigned",
        nextAction: residual?.[1] ?? "Assign owner and budget decision before archive.",
      });
    }
  }
  for (const record of runtimeMetricRecords(runtimeGates)) {
    collectUnitConflict(record, failures);
  }
  return { failures, warnings };
}

function checkBudgetResidualTableMetadata() {
  const failures = [];
  for (const [record, residual] of BUDGET_RESIDUALS) {
    const owner = residual?.[0];
    const nextAction = residual?.[1];
    if (!hasNonEmptyString(owner) || !hasNonEmptyString(nextAction)) {
      failures.push({
        check: "budget-residual-metadata-missing",
        record,
        detail: "BUDGET_RESIDUALS entry must include owner and next action",
      });
    }
  }
  return failures;
}

function checkResidualBudgetSync(baseline) {
  const failures = [];
  const metrics = Array.isArray(baseline?.metrics) ? baseline.metrics : [];
  for (const metric of metrics) {
    const label = recordLabel(metric);
    if (metric?.budget && BUDGET_RESIDUALS.has(label)) {
      failures.push({
        check: "budget-residual-sync",
        record: label,
        detail: "metric has a real budget block but remains listed in BUDGET_RESIDUALS",
        owner: metric.budget.owner ?? "unassigned",
        source: metric.budget.source ?? "unknown",
        nextAction: "Remove this record from BUDGET_RESIDUALS after owner-approved budget metadata lands.",
      });
    }
  }
  return failures;
}

function checkAcceptedDispositionMetadata(runtimeGates) {
  const failures = [];
  const budgetResiduals = Array.isArray(runtimeGates?.archiveReadiness?.acceptedBudgetResiduals)
    ? runtimeGates.archiveReadiness.acceptedBudgetResiduals
    : [];
  for (const entry of budgetResiduals) {
    if (!hasNonEmptyString(entry?.record) || !hasAcceptedDispositionFields(entry)) {
      failures.push({
        check: "accepted-budget-residual-metadata-missing",
        record: entry?.record ?? "?",
        detail: "accepted budget residual must include record, owner, source, reason, releaseDecision, and nextAction",
      });
    }
  }

  const proxyDebt = runtimeGates?.archiveReadiness?.acceptedProxyEvidenceDebt;
  if (proxyDebt && !hasAcceptedDispositionFields(proxyDebt, ["status"])) {
    failures.push({
      check: "accepted-proxy-evidence-metadata-missing",
      record: "performance-evidence",
      detail: "accepted proxy evidence debt must include status, owner, source, reason, releaseDecision, and nextAction",
    });
  }

  const unsupportedEvidence = Array.isArray(runtimeGates?.archiveReadiness?.acceptedUnsupportedEvidence)
    ? runtimeGates.archiveReadiness.acceptedUnsupportedEvidence
    : [];
  for (const entry of unsupportedEvidence) {
    if (
      !hasNonEmptyString(entry?.record) ||
      !hasAcceptedDispositionFields(entry, ["platformQualifier"])
    ) {
      failures.push({
        check: "accepted-unsupported-evidence-metadata-missing",
        record: entry?.record ?? "?",
        detail: "accepted unsupported evidence must include record, platformQualifier, owner, source, reason, releaseDecision, and nextAction",
      });
    }
  }

  return failures;
}

function checkHardFailAnnotation(baseline, runtimeGates) {
  const failures = [];
  const metrics = Array.isArray(baseline?.metrics) ? baseline.metrics : [];
  for (const metric of metrics) {
    const budget = metric?.budget;
    if (!budget) continue;
    if (budget.hardFail === undefined || budget.hardFail === null) continue;
    const hasAnnotation =
      budget.rollout !== undefined ||
      metric.rollout !== undefined ||
      metric.status !== undefined;
    if (!hasAnnotation) {
      failures.push({
        check: "hardfail-annotation-missing",
        record: recordLabel(metric),
        detail: `budget.hardFail=${budget.hardFail} has no budget.rollout, top-level rollout, or top-level status`,
      });
    }
  }
  for (const record of runtimeMetricRecords(runtimeGates)) {
    const budget = record?.budget;
    if (!budget) continue;
    if (budget.hardFail === undefined || budget.hardFail === null) continue;
    const hasAnnotation =
      budget.rollout !== undefined ||
      record.rollout !== undefined ||
      record.status !== undefined;
    if (!hasAnnotation) {
      failures.push({
        check: "hardfail-annotation-missing",
        record: recordLabel(record),
        detail: `runtime-evidence gate budget.hardFail=${budget.hardFail} has no budget.rollout, top-level rollout, or top-level status`,
      });
    }
  }
  return failures;
}

function checkArchiveReadinessStaleness(runtimeGates, activeNames) {
  const failures = [];
  const completed = Array.isArray(runtimeGates?.archiveReadiness?.completed)
    ? runtimeGates.archiveReadiness.completed
    : [];
  for (const entry of completed) {
    const name = entry?.name;
    if (!name) continue;
    if (name === SELF_CHANGE_NAME) {
      failures.push({
        check: "archive-readiness-self-reference",
        record: name,
        detail: `${SELF_CHANGE_NAME} is the closure change and must not be in current completed active list`,
      });
      continue;
    }
    if (!activeNames.has(name)) {
      failures.push({
        check: "archive-readiness-stale",
        record: name,
        detail: `${name} is no longer in \`openspec list --json\` active changes; move it to history / previousArchiveContext`,
      });
    }
  }
  return failures;
}

function checkLargeFileOwnership(runtimeGates) {
  const failures = [];
  const candidates = Array.isArray(runtimeGates?.largeFileSummary?.candidates)
    ? runtimeGates.largeFileSummary.candidates
    : [];
  for (const candidate of candidates) {
    const priority = candidate?.priority;
    if (priority !== "P0" && priority !== "P1") continue;
    const path = candidate?.path ?? "?";
    const ownerMissing = !candidate?.owner;
    const followUpMissing = !candidate?.followUp;
    if (ownerMissing || followUpMissing) {
      const missing = [
        ownerMissing ? "owner" : null,
        followUpMissing ? "followUp" : null,
      ]
        .filter(Boolean)
        .join(", ");
      failures.push({
        check: "large-file-owner-followup-missing",
        record: path,
        detail: `${path} priority=${priority} is missing: ${missing}`,
      });
    }
  }
  return failures;
}

function checkReleaseHardBreaches(baseline, runtimeGates) {
  const failures = [];
  const seen = new Set();
  const records = [
    ...(Array.isArray(baseline?.metrics) ? baseline.metrics : []),
    ...runtimeMetricRecords(runtimeGates),
  ];
  for (const record of records) {
    const budget = record?.budget;
    if (!budget || budget.hardFail === undefined || budget.hardFail === null) {
      continue;
    }
    const value = record?.value;
    if (typeof value !== "number" || value <= budget.hardFail) {
      continue;
    }
    const label = recordLabel(record);
    const dedupeKey = `release-hard-budget-breach:${label}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    const releaseInfo = RELEASE_REQUIRED_RECORDS.get(label);
    failures.push({
      check: "release-hard-budget-breach",
      record: label,
      detail: `value=${value} exceeds hardFail=${budget.hardFail} ${record?.unit ?? budget?.unit ?? ""}`.trim(),
      owner: budget.owner ?? releaseInfo?.owner ?? "unassigned",
      source: budget.source ?? "unknown",
      nextAction: releaseInfo?.nextAction ?? "Reduce the metric below hardFail or record an explicit release blocker.",
    });
  }
  return failures;
}

function buildReleaseEvidenceClassification(baseline, runtimeGates) {
  const failures = [];
  const warnings = [];
  const records = [
    ...(Array.isArray(baseline?.metrics) ? baseline.metrics : []),
    ...runtimeMetricRecords(runtimeGates),
  ];
  const byLabel = new Map();
  for (const record of records) {
    const label = recordLabel(record);
    const existing = byLabel.get(label);
    if (!existing || (existing.evidenceClass !== "measured" && record?.evidenceClass === "measured")) {
      byLabel.set(label, record);
    }
  }

  for (const [label, info] of RELEASE_REQUIRED_RECORDS) {
    const record = byLabel.get(label);
    if (!record) {
      failures.push({
        check: "release-evidence-missing",
        record: label,
        detail: "release-required metric is absent from performance evidence",
        owner: info.owner,
        nextAction: info.nextAction,
      });
      continue;
    }
    const evidenceClass = record.evidenceClass;
    if (evidenceClass === "measured") {
      continue;
    }
    const payload = {
      record: label,
      detail: `release-required metric has evidenceClass=${evidenceClass ?? "missing"}`,
      owner: info.owner,
      source: record.source ?? record.budget?.source ?? "unknown",
      nextAction: info.nextAction,
    };
    if (evidenceClass === "unsupported" || evidenceClass === undefined || evidenceClass === null) {
      failures.push({
        check: "release-evidence-unsupported",
        ...payload,
      });
    } else {
      warnings.push({
        check: "release-evidence-proxy",
        ...payload,
      });
    }
  }

  return { failures, warnings };
}

function summarizeUnsupported(runtimeGates) {
  const acceptedUnsupported = acceptedUnsupportedEvidenceByRecord(runtimeGates);
  return runtimeEvidenceObjects(runtimeGates)
    .filter((item) => {
      if (item.record?.evidenceClass !== "unsupported") {
        return false;
      }
      const accepted = acceptedUnsupported.get(recordLabel(item.record));
      return !(accepted && hasAcceptedDispositionFields(accepted, ["platformQualifier"]));
    })
    .map(evidenceObjectLabel);
}

function summarizeAcceptedUnsupported(runtimeGates) {
  const acceptedUnsupported = acceptedUnsupportedEvidenceByRecord(runtimeGates);
  return runtimeEvidenceObjects(runtimeGates)
    .filter((item) => {
      if (item.record?.evidenceClass !== "unsupported") {
        return false;
      }
      const accepted = acceptedUnsupported.get(recordLabel(item.record));
      return accepted && hasAcceptedDispositionFields(accepted, ["platformQualifier"]);
    })
    .map((item) => {
      const accepted = acceptedUnsupported.get(recordLabel(item.record));
      return {
        record: recordLabel(item.record),
        path: item.path,
        owner: accepted.owner,
        platformQualifier: accepted.platformQualifier,
        reason: accepted.reason,
        releaseDecision: accepted.releaseDecision,
        nextAction: accepted.nextAction,
        source: accepted.source,
      };
    });
}

function summarizeProxyRatio(records) {
  const counts = {
    measured: 0,
    proxy: 0,
    synthetic: 0,
    unsupported: 0,
    "manual-only": 0,
  };
  for (const record of records) {
    const evidenceClass = record?.evidenceClass;
    if (Object.prototype.hasOwnProperty.call(counts, evidenceClass)) {
      counts[evidenceClass] += 1;
    }
  }
  const denominator = counts.measured + counts.proxy + counts.synthetic;
  const proxyRatio = denominator > 0
    ? Number((counts.proxy / denominator).toFixed(4))
    : 0;
  return {
    counts,
    proxyRatio,
    denominator,
  };
}

function buildProxyRatioWarnings(summary, runtimeGates, releaseMode) {
  if (summary.proxyRatio <= PROXY_RATIO_WARN_THRESHOLD) {
    return [];
  }
  if (!releaseMode && hasAcceptedProxyEvidenceDebt(runtimeGates)) {
    return [];
  }
  return [{
    code: "proxy-ratio-too-high",
    check: "proxy-ratio-too-high",
    record: "performance-evidence",
    detail:
      `proxyRatio=${summary.proxyRatio} exceeds warn threshold=${PROXY_RATIO_WARN_THRESHOLD}; measured=${summary.counts.measured}, proxy=${summary.counts.proxy}, synthetic=${summary.counts.synthetic}, unsupported=${summary.counts.unsupported}, manualOnly=${summary.counts["manual-only"]}`,
    owner: "runtime-perf-evidence-classification",
    nextAction: "Upgrade proxy metrics to measured evidence before release-grade archive; this is warn-only for v0.5.11.",
  }];
}

function renderTextReport(result) {
  const lines = [];
  lines.push(result.releaseMode ? "perf-archive-readiness (release mode)" : "perf-archive-readiness");
  lines.push("=======================");
  lines.push("");
  lines.push(`Inputs:`);
  lines.push(`  - ${result.inputs.baseline}`);
  lines.push(`  - ${result.inputs.runtimeEvidenceGates}`);
  lines.push(`  - openspec list --json (active changes: ${result.activeChangeCount})`);
  lines.push("");
  lines.push(`Result: ${result.status.toUpperCase()}`);
  lines.push("");

  if (result.hardFailures.length === 0 && result.warnings.length === 0) {
    lines.push("No unaccepted defects detected. Evidence metadata is ready for normal-mode archive.");
  } else {
    if (result.hardFailures.length > 0) {
      lines.push(`Hard failures (${result.hardFailures.length}):`);
      for (const f of result.hardFailures) {
        lines.push(`  - [${f.check}] ${f.record} :: ${f.detail}`);
      }
      lines.push("");
    }
    if (result.warnings.length > 0) {
      lines.push(`Warnings / residual risk (${result.warnings.length}):`);
      for (const w of result.warnings) {
        lines.push(`  - [${w.check}] ${w.record} :: ${w.detail}`);
      }
      lines.push("");
    }
  }

  if (result.unsupportedRecords.length > 0) {
    lines.push(`Unsupported evidence (residual risk, not hard fail): ${result.unsupportedRecords.length}`);
    for (const label of result.unsupportedRecords) {
      lines.push(`  - ${label}`);
    }
    lines.push("");
  }
  if (result.acceptedBudgetResiduals?.length > 0) {
    lines.push(`Accepted budget residuals: ${result.acceptedBudgetResiduals.length}`);
    lines.push("");
  }
  if (result.acceptedProxyEvidenceDebt) {
    lines.push(`Accepted proxy evidence debt: ${result.acceptedProxyEvidenceDebt.status}`);
    lines.push("");
  }
  if (result.acceptedUnsupportedRecords?.length > 0) {
    lines.push(`Accepted unsupported evidence: ${result.acceptedUnsupportedRecords.length}`);
    lines.push("");
  }

  lines.push(`Counts:`);
  lines.push(`  - metrics: ${result.metricCount}`);
  lines.push(`  - budget-missing: ${result.budgetMissingCount}`);
  lines.push(`  - hardFailures: ${result.hardFailures.length}`);
  lines.push(`  - warnings: ${result.warnings.length}`);
  lines.push(`  - unsupported: ${result.unsupportedRecords.length}`);
  lines.push(`  - active changes: ${result.activeChangeCount}`);

  return lines.join("\n");
}

function buildInputGuard(paths) {
  const inputsMissing = [];
  if (!existsSync(repoPath(paths.baseline))) {
    inputsMissing.push(paths.baseline);
  }
  if (!existsSync(repoPath(paths.runtimeEvidenceGates))) {
    inputsMissing.push(paths.runtimeEvidenceGates);
  }
  if (paths.activeChangesJson && !existsSync(repoPath(paths.activeChangesJson))) {
    inputsMissing.push(paths.activeChangesJson);
  }
  if (inputsMissing.length > 0) {
    return `Missing required input file(s): ${inputsMissing.join(", ")}`;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const releaseMode = args.includes("--release");
  const paths = {
    baseline: getArgValue(args, "--baseline") ?? PERF_BASELINE_PATH,
    runtimeEvidenceGates: getArgValue(args, "--runtime-evidence") ?? RUNTIME_EVIDENCE_GATES_PATH,
    activeChangesJson: getArgValue(args, "--active-changes-json"),
  };

  const inputError = buildInputGuard(paths);
  if (inputError) {
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: inputError }, null, 2)}\n`);
    } else {
      process.stderr.write(`perf-archive-readiness error: ${inputError}\n`);
    }
    process.exit(3);
  }

  let baseline;
  let runtimeGates;
  try {
    baseline = await readJsonIfExists(paths.baseline);
    runtimeGates = await readJsonIfExists(paths.runtimeEvidenceGates);
  } catch (error) {
    const message = `Failed to parse input JSON: ${error.message ?? String(error)}`;
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`);
    } else {
      process.stderr.write(`perf-archive-readiness error: ${message}\n`);
    }
    process.exit(3);
  }

  let activeChangeState;
  try {
    activeChangeState = await getOpenSpecActiveNames(paths.activeChangesJson);
  } catch (error) {
    const message = error.message ?? String(error);
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`);
    } else {
      process.stderr.write(`perf-archive-readiness error: ${message}\n`);
    }
    process.exit(3);
  }
  const activeNames = activeChangeState.names;

  const unitCheck = checkUnitConsistency(baseline, runtimeGates);
  const releaseCheck = releaseMode
    ? buildReleaseEvidenceClassification(baseline, runtimeGates)
    : { failures: [], warnings: [] };
  const hardFailures = [
    ...checkEvidenceClassCoverage(baseline, runtimeGates),
    ...unitCheck.failures,
    ...checkBudgetResidualTableMetadata(),
    ...checkResidualBudgetSync(baseline),
    ...checkAcceptedDispositionMetadata(runtimeGates),
    ...checkHardFailAnnotation(baseline, runtimeGates),
    ...checkArchiveReadinessStaleness(runtimeGates, activeNames),
    ...checkLargeFileOwnership(runtimeGates),
    ...(releaseMode ? checkReleaseHardBreaches(baseline, runtimeGates) : []),
    ...releaseCheck.failures,
  ];

  const evidenceClassSummary = summarizeProxyRatio(evidenceClassMetricRecords(baseline, runtimeGates));
  const proxyRatioWarnings = buildProxyRatioWarnings(evidenceClassSummary, runtimeGates, releaseMode);
  const warnings = [
    ...unitCheck.warnings,
    ...releaseCheck.warnings,
    ...proxyRatioWarnings,
  ];
  const unsupportedRecords = summarizeUnsupported(runtimeGates);
  const acceptedBudgetResiduals = Array.from(acceptedBudgetResidualsByRecord(runtimeGates).values());
  const acceptedUnsupportedRecords = summarizeAcceptedUnsupported(runtimeGates);
  const budgetMissingCount = warnings.filter((w) => w.check === "budget-missing").length;

  let status;
  let exitCode;
  if (hardFailures.length > 0) {
    status = "fail";
    exitCode = 1;
  } else if (warnings.length > 0 || unsupportedRecords.length > 0) {
    status = "warn";
    exitCode = 2;
  } else {
    status = "pass";
    exitCode = 0;
  }

  const result = {
    ok: exitCode !== 3,
    status,
    exitCode,
    releaseMode,
    activeChangeCount: activeNames.size,
    metricCount: Array.isArray(baseline?.metrics) ? baseline.metrics.length : 0,
    budgetMissingCount,
    proxyRatio: evidenceClassSummary.proxyRatio,
    evidenceClassCounts: evidenceClassSummary.counts,
    hardFailures,
    warnings,
    unsupportedRecords,
    acceptedBudgetResiduals,
    acceptedProxyEvidenceDebt: runtimeGates?.archiveReadiness?.acceptedProxyEvidenceDebt ?? null,
    acceptedUnsupportedRecords,
    inputs: {
      baseline: paths.baseline,
      runtimeEvidenceGates: paths.runtimeEvidenceGates,
      openSpec: activeChangeState.source,
    },
  };

  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderTextReport(result)}\n`);
  }

  process.exit(exitCode);
}

main();
