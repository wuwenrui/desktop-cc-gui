import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { test } from "node:test";

function runScript(args) {
  return new Promise((resolve, reject) => {
    execFile("node", ["scripts/perf-cold-start-baseline.mjs", ...args], { cwd: process.cwd() }, (error, _stdout, stderr) => {
      if (error) {
        // cold-start runner exits 1 on startup-marker read failure; tolerate that.
        if (error.code === 1 && stderr) {
          reject(Object.assign(new Error(stderr), { code: error.code }));
          return;
        }
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test("cold-start baseline upgrades first-paint / first-interactive to measured when marker snapshot is provided", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-cold-start-"));
  const snapshotPath = join(dir, "startup-markers.json");
  const outputPath = join(dir, "cold-start.json");
  await writeFile(snapshotPath, JSON.stringify({
    schemaVersion: "1.0",
    source: "startup-perf-markers",
    markers: [
      { name: "first-paint", atMs: 412.3 },
      { name: "first-interactive", atMs: 687.9 },
    ],
    platform: "test-darwin",
  }), "utf-8");

  await runScript(["--skip-build", "--startup-markers", snapshotPath, "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = new Map(fragment.metrics.map((m) => [m.metric, m]));
  const firstPaint = byMetric.get("firstPaintMs");
  const firstInteractive = byMetric.get("firstInteractiveMs");
  assert.equal(firstPaint?.value, 412.3);
  assert.equal(firstPaint?.unsupportedReason, undefined);
  assert.equal(firstInteractive?.value, 687.9);
  assert.equal(firstInteractive?.unsupportedReason, undefined);
  await rm(dir, { recursive: true, force: true });
});

test("cold-start baseline keeps first-paint / first-interactive unsupported with provided-snapshot reason when no --startup-markers is passed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-cold-start-"));
  const outputPath = join(dir, "cold-start.json");
  await runScript(["--skip-build", "--output", outputPath]);
  const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
  const byMetric = new Map(fragment.metrics.map((m) => [m.metric, m]));
  const firstPaint = byMetric.get("firstPaintMs");
  const firstInteractive = byMetric.get("firstInteractiveMs");
  assert.equal(firstPaint?.value, null);
  assert.match(firstPaint?.unsupportedReason ?? "", /Tauri\/webview startup marker snapshot was not provided/);
  assert.equal(firstInteractive?.value, null);
  assert.match(firstInteractive?.unsupportedReason ?? "", /Tauri\/webview startup marker snapshot was not provided/);
  await rm(dir, { recursive: true, force: true });
});

test("cold-start baseline distinguishes corrupt snapshot from missing snapshot via reason text", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-cold-start-"));
  const snapshotPath = join(dir, "corrupt.json");
  const outputPath = join(dir, "cold-start.json");
  await writeFile(snapshotPath, "{not valid json", "utf-8");

  let exitError = null;
  try {
    await runScript(["--skip-build", "--startup-markers", snapshotPath, "--output", outputPath]);
  } catch (error) {
    exitError = error;
  }
  // The runner currently falls back to unsupported reason on parse failure
  // (perf-cold-start-baseline.mjs readStartupMarkers catches JSON.parse and
  // returns a "Failed to read" reason). Assert the reason text is the
  // corrupt-specific message and is distinct from the "not provided" message.
  if (exitError == null) {
    const fragment = JSON.parse(await readFile(outputPath, "utf-8"));
    const byMetric = new Map(fragment.metrics.map((m) => [m.metric, m]));
    const firstPaint = byMetric.get("firstPaintMs");
    assert.match(firstPaint?.unsupportedReason ?? "", /Failed to read startup marker snapshot/);
    assert.doesNotMatch(firstPaint?.unsupportedReason ?? "", /was not provided/);
  } else {
    // If the runner exits non-zero on parse failure, the message must mention
    // the corrupt path, not the not-provided fallback.
    assert.match(String(exitError.message ?? exitError), /Failed to read startup marker snapshot/);
  }
  await rm(dir, { recursive: true, force: true });
});
