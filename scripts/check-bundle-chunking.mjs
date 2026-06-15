import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";

const ROOT = process.cwd();
const VITE_CONFIG_PATH = path.join(ROOT, "vite.config.ts");
const ASSETS_DIR = path.join(ROOT, "dist", "assets");
const BUDGET_CONFIG_PATH = path.join(ROOT, "scripts", "bundle-budget.config.json");

function fail(message) {
  console.error(`[bundle-chunking] ${message}`);
  process.exitCode = 1;
}

const source = fs.readFileSync(VITE_CONFIG_PATH, "utf8");
for (const chunkName of [
  "vendor-react",
  "vendor-codemirror",
  "vendor-markdown",
  "vendor-mermaid",
  "vendor-docs",
  "vendor-ui-heavy",
]) {
  if (!source.includes(chunkName)) {
    fail(`vite manualChunks missing ${chunkName}`);
  }
}

if (!source.includes("manualChunks(id)")) {
  fail("vite config must keep manualChunks boundary explicit");
}

if (process.exitCode) {
  process.exit();
}

function escapeRegExp(value) {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function patternToRegExp(pattern) {
  return new RegExp(`^${pattern.split("*").map(escapeRegExp).join(".*")}$`);
}

function formatBytes(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(2)} MiB`;
  }
  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${value} B`;
}

function readBudgetConfig() {
  if (!fs.existsSync(BUDGET_CONFIG_PATH)) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(BUDGET_CONFIG_PATH, "utf8"));
  if (parsed.schemaVersion !== "1.0") {
    fail(`unsupported bundle budget schemaVersion: ${parsed.schemaVersion ?? "missing"}`);
  }
  if (!Array.isArray(parsed.groups)) {
    fail("bundle budget config must define groups array");
  }
  return parsed;
}

function measureAssets() {
  if (!fs.existsSync(ASSETS_DIR)) {
    return null;
  }
  return fs.readdirSync(ASSETS_DIR)
    .filter((fileName) => /\.(?:js|mjs|css)$/.test(fileName))
    .map((fileName) => {
      const absolutePath = path.join(ASSETS_DIR, fileName);
      const content = fs.readFileSync(absolutePath);
      return {
        fileName,
        rawBytes: content.byteLength,
        gzipBytes: zlib.gzipSync(content).byteLength,
      };
    });
}

function matchGroupAssets(assets, group) {
  const matchers = group.patterns.map(patternToRegExp);
  return assets.filter((asset) => matchers.some((matcher) => matcher.test(asset.fileName)));
}

function startupEagernessStatus(group) {
  if (group.startupEagerness !== "lazy-required") {
    return "";
  }
  // Vite output does not currently emit reliable startup import graph metadata for this checker.
  // Keep this explicit so unknown eagerness is not reported as startup-safe.
  return "not-measured";
}

function summarizeBudgetGroup(assets, group) {
  const matchedAssets = matchGroupAssets(assets, group);
  const rawBytes = matchedAssets.reduce((sum, asset) => sum + asset.rawBytes, 0);
  const gzipBytes = matchedAssets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
  const target = group.target == null ? null : Number(group.target);
  const hardFail = group.hardFail == null ? null : Number(group.hardFail);
  const overTarget = target != null && gzipBytes > target;
  const overHardFail = hardFail != null && gzipBytes > hardFail;
  const mode = group.mode ?? "advisory";
  const eagerness = startupEagernessStatus(group);
  const eagerFail = mode === "fail" && eagerness === "measured-eager";
  const sizeFail = mode === "fail" && overHardFail;
  const status = matchedAssets.length === 0
    ? "missing"
    : sizeFail || eagerFail
      ? "fail"
      : overHardFail || overTarget
        ? "advisory"
        : "pass";

  if (status === "fail") {
    fail(`${group.id} exceeded bundle budget: gzip=${gzipBytes}, hardFail=${hardFail ?? "n/a"}, eagerness=${eagerness || "n/a"}`);
  }

  return {
    id: group.id,
    mode,
    status,
    rawBytes,
    gzipBytes,
    target,
    hardFail,
    eagerness,
    files: matchedAssets.map((asset) => asset.fileName),
  };
}

function printBudgetSummary(rows) {
  console.log("[bundle-chunking] budget summary");
  console.log("id\tmode\tstatus\tgzip\ttarget\thardFail\teagerness\tfiles");
  for (const row of rows) {
    const displayedFiles = row.files.length > 8
      ? `${row.files.slice(0, 8).join(",")} (+${row.files.length - 8} more)`
      : row.files.join(",");
    console.log([
      row.id,
      row.mode,
      row.status,
      formatBytes(row.gzipBytes),
      row.target == null ? "" : formatBytes(row.target),
      row.hardFail == null ? "" : formatBytes(row.hardFail),
      row.eagerness,
      displayedFiles,
    ].join("\t"));
  }
}

const budgetConfig = readBudgetConfig();
const measuredAssets = measureAssets();

if (budgetConfig != null && measuredAssets == null) {
  console.warn("[bundle-chunking] budget skipped: dist/assets is missing; run npm run build for size enforcement");
} else if (budgetConfig != null && measuredAssets != null) {
  const rows = budgetConfig.groups.map((group) => summarizeBudgetGroup(measuredAssets, group));
  printBudgetSummary(rows);
}

if (process.exitCode) {
  process.exit();
}

console.log("[bundle-chunking] ok");
