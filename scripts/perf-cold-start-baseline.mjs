import { execFile } from "node:child_process";
import { createGzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

const verbose = process.argv.includes("--verbose");
const skipBuild = process.argv.includes("--skip-build");
const outputPath = getArgValue("--output") ?? "docs/perf/cold-start-baseline.json";
const startupMarkersPath = getArgValue("--startup-markers");

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index !== -1) {
    return process.argv[index + 1] ?? null;
  }
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    execFile(command, args, { cwd: process.cwd(), env: { ...process.env, VITE_ENABLE_PERF_BASELINE: "1" } }, (error) => {
      if (error) {
        rejectRun(error);
        return;
      }
      resolveRun();
    });
  });
}

async function gzipSize(path) {
  let total = 0;
  await pipeline(
    createReadStream(path),
    createGzip(),
    new Writable({
      write(chunk, _encoding, callback) {
        total += chunk.length;
        callback();
      },
    }),
  );
  return total;
}

async function collectJavaScriptAssets() {
  const assetsDir = resolve(process.cwd(), "dist/assets");
  let files;
  try {
    files = await readdir(assetsDir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const jsFiles = files.filter((file) => extname(file) === ".js");
  const sized = await Promise.all(
    jsFiles.map(async (file) => {
      const absolutePath = resolve(assetsDir, file);
      const fileStat = await stat(absolutePath);
      return {
        file,
        bytes: fileStat.size,
        gzipBytes: await gzipSize(absolutePath),
      };
    }),
  );
  return sized.sort((left, right) => right.gzipBytes - left.gzipBytes);
}

async function writeJson(path, value) {
  const absolutePath = resolve(process.cwd(), path);
  await mkdir(resolve(absolutePath, ".."), { recursive: true });
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8"),
  );
}

async function readStartupMarkers(path) {
  if (!path) {
    return {
      snapshot: null,
      reason: "Tauri/webview startup marker snapshot was not provided; bundle baseline is recorded.",
    };
  }
  try {
    return {
      snapshot: JSON.parse(await readFile(resolve(process.cwd(), path), "utf-8")),
      reason: null,
    };
  } catch (error) {
    return {
      snapshot: null,
      reason: `Failed to read startup marker snapshot: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function findStartupMarker(snapshot, name) {
  const marker = Array.isArray(snapshot?.markers)
    ? snapshot.markers.find((entry) => entry?.name === name)
    : null;
  const value = marker?.atMs;
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

async function main() {
  if (!skipBuild) {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    await run(npmCommand, ["exec", "vite", "--", "build", "--mode", "baseline"]);
  }
  const assets = await collectJavaScriptAssets();
  const [mainAsset, vendorAsset] = assets;
  const startupMarkers = await readStartupMarkers(startupMarkersPath);
  const firstPaintMs = findStartupMarker(startupMarkers.snapshot, "first-paint");
  const firstInteractiveMs = findStartupMarker(startupMarkers.snapshot, "first-interactive");
  const missingFirstPaintReason = startupMarkers.reason ?? "Startup marker snapshot did not include first-paint.";
  const missingFirstInteractiveReason = startupMarkers.reason ?? "Startup marker snapshot did not include first-interactive.";
  const missingBundleReason = "No Vite JavaScript assets were found under dist/assets.";
  const fragment = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    source: "cold-start",
    metrics: [
      {
        scenario: "S-CS-COLD",
        metric: "bundleSizeMain",
        value: mainAsset?.gzipBytes ?? null,
        unit: "bytes-gzip",
        notes: mainAsset ? basename(mainAsset.file) : "no JS asset found",
        unsupportedReason: mainAsset ? undefined : missingBundleReason,
      },
      {
        scenario: "S-CS-COLD",
        metric: "bundleSizeVendor",
        value: vendorAsset?.gzipBytes ?? null,
        unit: "bytes-gzip",
        notes: vendorAsset ? basename(vendorAsset.file) : "no secondary JS asset found",
        unsupportedReason: vendorAsset ? undefined : missingBundleReason,
      },
      {
        scenario: "S-CS-COLD",
        metric: "firstPaintMs",
        value: firstPaintMs,
        unit: "ms",
        notes: firstPaintMs == null ? undefined : "startup marker first-paint",
        unsupportedReason: firstPaintMs == null ? missingFirstPaintReason : undefined,
      },
      {
        scenario: "S-CS-COLD",
        metric: "firstInteractiveMs",
        value: firstInteractiveMs,
        unit: "ms",
        notes: firstInteractiveMs == null ? undefined : "startup marker first-interactive",
        unsupportedReason: firstInteractiveMs == null ? missingFirstInteractiveReason : undefined,
      },
    ],
    notes: [
      `platform=${process.platform}`,
      startupMarkersPath ? "startupMarkers=provided" : "startupMarkers=missing",
    ],
  };
  await writeJson(outputPath, fragment);
  if (verbose) {
    console.info(`cold-start baseline assets: ${assets.length}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
