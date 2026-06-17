import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const schemaVersion = "1.0";
const previousBaselinePath = "docs/perf/history/v0.5.6-baseline.json";
const fragmentPaths = [
  "docs/perf/long-list-baseline.json",
  "docs/perf/composer-baseline.json",
  "docs/perf/realtime-extended-baseline.json",
  "docs/perf/realtime-runtime-evidence.json",
  "docs/perf/cold-start-baseline.json",
];

async function readJson(path) {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf-8"));
}

async function readJsonIfExists(path) {
  const absolutePath = resolve(process.cwd(), path);
  if (!existsSync(absolutePath)) {
    return null;
  }
  return JSON.parse(await readFile(absolutePath, "utf-8"));
}

async function writeText(path, value) {
  const absolutePath = resolve(process.cwd(), path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, value, "utf-8");
}

function formatValue(value) {
  return value == null ? "unsupported" : String(value);
}

function escapeMarkdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function classifyMetric(metric) {
  if (
    metric.evidenceClass === "measured"
    || metric.evidenceClass === "proxy"
    || metric.evidenceClass === "manual-only"
    || metric.evidenceClass === "unsupported"
  ) {
    return metric.evidenceClass;
  }
  const note = `${metric.notes ?? ""} ${metric.unsupportedReason ?? ""}`.toLowerCase();
  if (metric.value == null || metric.unsupportedReason) {
    return "unsupported";
  }
  if (
    note.includes("proxy")
    || note.includes("jsdom")
    || note.includes("fixture")
    || metric.scenario?.startsWith("S-LL")
    || metric.scenario?.startsWith("S-CI")
    || metric.scenario?.startsWith("S-RS")
  ) {
    return "proxy";
  }
  return "measured";
}

function budgetForMetric(metric) {
  const id = `${metric.scenario}/${metric.metric}`;
  const budgets = {
    "S-CS-COLD/bundleSizeMain": {
      target: 950_000,
      hardFail: 1_100_000,
      unit: "bytes-gzip",
      rollout: "advisory-until-bundle-optimization",
    },
    "S-CS-COLD/bundleSizeVendor": {
      target: 680_000,
      hardFail: 760_000,
      unit: "bytes-gzip",
      rollout: "advisory",
    },
    "S-RS-FT/firstTokenLatency": {
      target: 2_000,
      hardFail: 5_000,
      unit: "ms",
      rollout: "advisory-until-runtime-trace",
    },
    "S-RS-FT/interTokenJitterP95": {
      target: 500,
      hardFail: 920,
      unit: "ms",
      rollout: "advisory-until-runtime-trace",
    },
    "S-CI-50/keystrokeToCommitP95": {
      target: 16,
      hardFail: 32,
      unit: "ms",
      rollout: "fail-ready",
    },
    "S-CI-50/inputEventLossCount": {
      target: 0,
      hardFail: 0,
      unit: "count",
      rollout: "fail-ready",
    },
    "S-CI-100-IME/keystrokeToCommitP95": {
      target: 16,
      hardFail: 32,
      unit: "ms",
      rollout: "fail-ready",
    },
    "S-CI-100-IME/inputEventLossCount": {
      target: 0,
      hardFail: 0,
      unit: "count",
      rollout: "fail-ready",
    },
    "S-LL-1000/scrollFrameDropPct": {
      target: 1,
      hardFail: 5,
      unit: "%",
      rollout: "proxy-advisory",
    },
    "S-RS-VL/visibleTextLagP95": {
      target: 2_000,
      hardFail: 5_000,
      unit: "ms",
      rollout: "approved-pending-runtime-trace",
      source: "openspec/changes/collect-release-grade-performance-evidence/budget-decision-table.md",
      owner: "realtime-runtime-evidence",
      status: "approved-runtime-measured",
    },
    "S-RS-RA/reducerAmplificationMedian": {
      target: 2,
      hardFail: 4,
      unit: "ratio",
      rollout: "approved-pending-runtime-trace",
      source: "openspec/changes/collect-release-grade-performance-evidence/budget-decision-table.md",
      owner: "realtime-runtime-evidence",
      status: "approved-runtime-measured",
    },
    "S-RS-FD/batchFlushDurationP95": {
      target: 8,
      hardFail: 16,
      unit: "ms",
      rollout: "approved-pending-runtime-trace",
      source: "openspec/changes/collect-release-grade-performance-evidence/budget-decision-table.md",
      owner: "realtime-runtime-evidence",
      status: "approved-runtime-measured",
    },
    "S-RS-TS/terminalSettlementP95": {
      target: 100,
      hardFail: 250,
      unit: "ms",
      rollout: "approved-pending-runtime-trace",
      source: "openspec/changes/collect-release-grade-performance-evidence/budget-decision-table.md",
      owner: "realtime-runtime-evidence",
      status: "approved-runtime-measured",
    },
  };
  return budgets[id] ?? null;
}

function enrichMetric(metric) {
  const evidenceClass = classifyMetric(metric);
  const budget = budgetForMetric(metric);
  return {
    ...metric,
    evidenceClass,
    ...(budget
      ? {
          budget: {
            observed: metric.value,
            target: budget.target,
            hardFail: budget.hardFail,
            unit: budget.unit,
            evidenceClass,
            source: budget.source ?? "docs/perf/baseline.json",
            ...(budget.owner ? { owner: budget.owner } : {}),
            ...(budget.status ? { status: budget.status } : {}),
            rollout: budget.rollout,
          },
        }
      : {}),
  };
}

function metricKey(metric) {
  return `${metric.scenario}\u0000${metric.metric}\u0000${metric.unit}`;
}

function metricEvidenceRank(metric) {
  if (metric.evidenceClass === "measured" && metric.value != null) {
    return 3;
  }
  if (metric.evidenceClass === "proxy" && metric.value != null) {
    return 2;
  }
  if (metric.value != null) {
    return 1;
  }
  return 0;
}

function dedupeMetrics(metrics) {
  const byKey = new Map();
  for (const metric of metrics) {
    const key = metricKey(metric);
    const existing = byKey.get(key);
    if (!existing || metricEvidenceRank(metric) > metricEvidenceRank(existing)) {
      byKey.set(key, metric);
    }
  }
  return Array.from(byKey.values());
}

function buildComparison(previousBaseline, currentReport) {
  if (previousBaseline == null || !Array.isArray(previousBaseline.metrics)) {
    return {
      source: previousBaselinePath,
      status: "missing",
      metrics: [],
    };
  }
  const previousByKey = new Map(previousBaseline.metrics.map((metric) => [metricKey(metric), metric]));
  const metrics = currentReport.metrics.map((current) => {
    const previous = previousByKey.get(metricKey(current));
    const comparable = previous != null
      && previous.value != null
      && current.value != null
      && Number.isFinite(Number(previous.value))
      && Number.isFinite(Number(current.value));
    return {
      scenario: current.scenario,
      metric: current.metric,
      unit: current.unit,
      previousValue: previous?.value ?? null,
      currentValue: current.value,
      delta: comparable ? Number((Number(current.value) - Number(previous.value)).toFixed(2)) : null,
      evidenceClass: current.evidenceClass,
      status: previous == null
        ? "missing"
        : comparable
          ? "comparable"
          : "not comparable",
      reason: previous == null
        ? "Previous baseline metric not found."
        : comparable
          ? ""
          : "Previous or current value is unsupported/non-numeric.",
    };
  });
  return {
    source: previousBaselinePath,
    previousVersion: previousBaseline.version ?? "unknown",
    currentVersion: currentReport.version,
    status: "available",
    missingCount: metrics.filter((entry) => entry.status === "missing").length,
    notComparableCount: metrics.filter((entry) => entry.status === "not comparable").length,
    metrics,
  };
}

function resolveArchivePath(version, extension) {
  const base = `docs/perf/history/v${version}-baseline.${extension}`;
  if (!existsSync(resolve(process.cwd(), base))) {
    return base;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `docs/perf/history/v${version}-baseline-${timestamp}.${extension}`;
}

function getGitValue(args, fallback) {
  try {
    return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf-8" }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function createMarkdown(report) {
  const lines = [
    `# v${report.version} Performance Baseline`,
    "",
    `Generated at: ${report.generatedAt}`,
    `Schema version: ${report.schemaVersion}`,
    `Branch: ${report.git.branch}`,
    `Commit: ${report.git.commit}`,
    "",
    "## Section A — Fixture-Replay Baseline",
    "",
    "| Scenario | Metric | Value | Unit | Evidence | Target | Hard Fail | Notes |",
    "|---|---:|---:|---|---|---:|---:|---|",
  ];
  for (const metric of report.metrics) {
    lines.push(`| ${escapeMarkdownCell(metric.scenario)} | ${escapeMarkdownCell(metric.metric)} | ${escapeMarkdownCell(formatValue(metric.value))} | ${escapeMarkdownCell(metric.unit)} | ${escapeMarkdownCell(metric.evidenceClass)} | ${escapeMarkdownCell(metric.budget?.target ?? "")} | ${escapeMarkdownCell(metric.budget?.hardFail ?? "")} | ${escapeMarkdownCell(metric.notes ?? metric.unsupportedReason ?? "")} |`);
  }
  lines.push("", "## Section B — Cross-Platform Notes", "");
  const skips = report.metrics.filter((metric) => metric.value == null && metric.unsupportedReason);
  if (skips.length === 0) {
    lines.push("- No platform skips recorded.");
  } else {
    for (const metric of skips) {
      lines.push(`- ${process.platform}: ${metric.scenario}/${metric.metric} unsupported - ${metric.unsupportedReason}`);
    }
  }
  lines.push("", "## Section C — Previous Baseline Comparison", "");
  if (report.comparison?.status !== "available") {
    lines.push(`- Previous baseline unavailable: ${report.comparison?.source ?? "unknown"}`);
  } else {
    lines.push(`Previous baseline: v${report.comparison.previousVersion} (${report.comparison.source})`);
    lines.push("");
    lines.push("| Scenario | Metric | Previous | Current | Delta | Unit | Evidence | Status |");
    lines.push("|---|---|---:|---:|---:|---|---|---|");
    for (const entry of report.comparison.metrics) {
      lines.push(`| ${escapeMarkdownCell(entry.scenario)} | ${escapeMarkdownCell(entry.metric)} | ${escapeMarkdownCell(formatValue(entry.previousValue))} | ${escapeMarkdownCell(formatValue(entry.currentValue))} | ${escapeMarkdownCell(entry.delta ?? "")} | ${escapeMarkdownCell(entry.unit)} | ${escapeMarkdownCell(entry.evidenceClass)} | ${escapeMarkdownCell(entry.status)} |`);
    }
  }
  // Append a short summary line so users can see at a glance whether the
  // comparison is fully comparable.
  if (report.comparison?.status === "available") {
    const missing = report.comparison.missingCount ?? 0;
    const notComparable = report.comparison.notComparableCount ?? 0;
    if (missing > 0 || notComparable > 0) {
      lines.push("");
      lines.push(`> Comparison status: ${report.comparison.metrics.length - missing - notComparable}/${report.comparison.metrics.length} metrics comparable; ${missing} missing, ${notComparable} not comparable.`);
    }
  }
  lines.push("", "## Section D — Residual Risks", "");
  if (report.residualRisks.length === 0) {
    lines.push("- Baseline values are fixture-based and should be used for relative comparison, not absolute UX claims.");
  } else {
    for (const risk of report.residualRisks) {
      lines.push(`- ${risk}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const packageJson = await readJson("package.json");
  const fragments = await Promise.all(fragmentPaths.map(readJson));
  const previousBaseline = await readJsonIfExists(previousBaselinePath);
  for (const fragment of fragments) {
    if (fragment.schemaVersion !== schemaVersion) {
      throw new Error(`Unsupported baseline fragment schema: ${fragment.schemaVersion}`);
    }
    if (!Array.isArray(fragment.metrics)) {
      throw new Error(`Baseline fragment is missing metrics array: ${fragment.source ?? "unknown"}`);
    }
  }
  const report = {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    version: packageJson.version,
    git: {
      branch: getGitValue(["rev-parse", "--abbrev-ref", "HEAD"], "unknown"),
      commit: getGitValue(["rev-parse", "HEAD"], "unknown"),
    },
    metrics: dedupeMetrics(fragments.flatMap((fragment) => fragment.metrics).map(enrichMetric)),
    sources: fragments.map((fragment) => ({ source: fragment.source, generatedAt: fragment.generatedAt })),
    residualRisks: fragments.flatMap((fragment) => fragment.residualRisks ?? []),
  };
  report.comparison = buildComparison(previousBaseline, report);
  const latestJson = "docs/perf/baseline.json";
  const latestMarkdown = "docs/perf/baseline.md";
  const archiveJson = resolveArchivePath(packageJson.version, "json");
  const archiveMarkdown = archiveJson.replace(/\.json$/, ".md");
  await writeText(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  await writeText(latestMarkdown, createMarkdown(report));
  await mkdir(dirname(resolve(process.cwd(), archiveJson)), { recursive: true });
  await copyFile(resolve(process.cwd(), latestJson), resolve(process.cwd(), archiveJson));
  await copyFile(resolve(process.cwd(), latestMarkdown), resolve(process.cwd(), archiveMarkdown));
  execFileSync("node", ["scripts/generate-runtime-evidence-report.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
