import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { test } from "node:test";

function runScript(args) {
  return new Promise((resolve, reject) => {
    execFile("node", ["scripts/perf-startup-marker-snapshot.mjs", ...args], { cwd: process.cwd() }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test("startup marker snapshot extracts latest diagnostic payload", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ccgui-startup-marker-"));
  const inputPath = join(dir, "diagnostics.json");
  const outputPath = join(dir, "startup.json");
  await writeFile(inputPath, JSON.stringify({
    rendererDiagnostics: [
      {
        label: "perf.startup.markers",
        payload: {
          schemaVersion: "1.0",
          source: "startup-perf-markers",
          platform: "MacIntel",
          markers: [{ name: "first-paint", atMs: 12.345 }],
        },
      },
      {
        label: "perf.startup.markers",
        payload: {
          schemaVersion: "1.0",
          source: "startup-perf-markers",
          platform: "MacIntel",
          markers: [
            { name: "first-paint", atMs: 12.345 },
            { name: "first-interactive", atMs: 45.678 },
          ],
        },
      },
    ],
  }), "utf-8");

  await runScript(["--input", inputPath, "--output", outputPath]);
  const snapshot = JSON.parse(await readFile(outputPath, "utf-8"));
  assert.equal(snapshot.markers.length, 2);
  assert.equal(snapshot.markers[0].atMs, 12.35);
  assert.equal(snapshot.markers[1].name, "first-interactive");
});
