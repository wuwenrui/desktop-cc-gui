import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT_PATH = resolve("scripts/perf-archive-readiness.mjs");

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

async function createFixture({ mainBundleValue = 1121481, coldStartEvidence = "unsupported" } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "perf-readiness-"));
  const baselinePath = join(dir, "baseline.json");
  const runtimePath = join(dir, "runtime-evidence.json");
  const activePath = join(dir, "openspec-active.json");

  const baseline = {
    metrics: [
      {
        scenario: "S-CS-COLD",
        metric: "bundleSizeMain",
        value: mainBundleValue,
        unit: "bytes-gzip",
        evidenceClass: "measured",
        budget: {
          observed: mainBundleValue,
          target: 950000,
          hardFail: 1100000,
          unit: "bytes-gzip",
          evidenceClass: "measured",
          source: "fixture",
          rollout: "advisory-until-bundle-optimization",
        },
      },
      {
        scenario: "S-CS-COLD",
        metric: "firstPaintMs",
        value: coldStartEvidence === "measured" ? 480 : null,
        unit: "ms",
        evidenceClass: coldStartEvidence,
      },
      {
        scenario: "S-CS-COLD",
        metric: "firstInteractiveMs",
        value: coldStartEvidence === "measured" ? 760 : null,
        unit: "ms",
        evidenceClass: coldStartEvidence,
      },
      {
        scenario: "S-RS-VL",
        metric: "visibleTextLagP95",
        value: 42,
        unit: "ms",
        evidenceClass: "proxy",
      },
    ],
  };
  const runtimeEvidence = {
    archiveReadiness: { completed: [] },
    largeFileSummary: { candidates: [] },
    performanceEvidence: baseline.metrics,
    realtimeTraceBudgets: [],
  };
  const activeChanges = { changes: [{ name: "collect-release-grade-performance-evidence" }] };

  await writeJson(baselinePath, baseline);
  await writeJson(runtimePath, runtimeEvidence);
  await writeJson(activePath, activeChanges);

  return { baselinePath, runtimePath, activePath };
}

function runReadiness(fixture, args = []) {
  const result = spawnSync(
    process.execPath,
    [
      SCRIPT_PATH,
      "--json",
      "--baseline",
      fixture.baselinePath,
      "--runtime-evidence",
      fixture.runtimePath,
      "--active-changes-json",
      fixture.activePath,
      ...args,
    ],
    { cwd: process.cwd(), encoding: "utf-8" },
  );
  assert.equal(result.stderr, "");
  return {
    status: result.status,
    json: JSON.parse(result.stdout),
  };
}

test("default archive-readiness keeps hard budget breach advisory", async () => {
  const fixture = await createFixture();
  const result = runReadiness(fixture);

  assert.equal(result.status, 2);
  assert.equal(result.json.releaseMode, false);
  assert.deepEqual(result.json.hardFailures, []);
  assert.ok(result.json.warnings.some((warning) => warning.check === "budget-missing"));
});

test("release readiness fails on hard breach and unsupported cold-start evidence", async () => {
  const fixture = await createFixture();
  const result = runReadiness(fixture, ["--release"]);

  assert.equal(result.status, 1);
  assert.equal(result.json.releaseMode, true);
  assert.ok(result.json.hardFailures.some((failure) => (
    failure.check === "release-hard-budget-breach"
    && failure.record === "S-CS-COLD/bundleSizeMain"
    && failure.owner === "bundle-size-optimization"
  )));
  assert.ok(result.json.hardFailures.some((failure) => (
    failure.check === "release-evidence-unsupported"
    && failure.record === "S-CS-COLD/firstPaintMs"
  )));
  assert.ok(result.json.warnings.some((warning) => (
    warning.check === "release-evidence-proxy"
    && warning.record === "S-RS-VL/visibleTextLagP95"
  )));
});

test("release readiness deduplicates repeated hard breach records", async () => {
  const fixture = await createFixture();
  const result = runReadiness(fixture, ["--release"]);
  const bundleBreaches = result.json.hardFailures.filter((failure) => (
    failure.check === "release-hard-budget-breach"
    && failure.record === "S-CS-COLD/bundleSizeMain"
  ));

  assert.equal(bundleBreaches.length, 1);
});
