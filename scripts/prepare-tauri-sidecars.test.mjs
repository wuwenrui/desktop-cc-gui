import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("tauri config bundles all managed helpers as external sidecars", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));

  assert.deepEqual(config.bundle.externalBin, [
    "binaries/cc_gui_daemon",
    "binaries/wx_bridge",
    "binaries/weclaw",
  ]);
  assert.match(config.build.beforeDevCommand, /prepare-tauri-sidecars\.mjs/);
  assert.match(config.build.beforeBuildCommand, /prepare-tauri-sidecars\.mjs/);
});

test("sidecar preparation names binaries with the active target triple", async () => {
  const { sidecarInternals } = await import("./prepare-tauri-sidecars.mjs");

  assert.deepEqual(sidecarInternals.sidecarBinaryNames, [
    "cc_gui_daemon",
    "wx_bridge",
    "weclaw",
  ]);
  assert.equal(
    sidecarInternals.sidecarSourceName("wx_bridge", "aarch64-apple-darwin"),
    "wx_bridge",
  );
  assert.equal(
    sidecarInternals.sidecarDestinationName("wx_bridge", "aarch64-apple-darwin"),
    "wx_bridge-aarch64-apple-darwin",
  );
  assert.equal(
    sidecarInternals.sidecarDestinationName("wx_bridge", "x86_64-pc-windows-msvc"),
    "wx_bridge-x86_64-pc-windows-msvc.exe",
  );
});

test("sidecar preparation builds WeClaw from the vendored source for each target", async () => {
	const { sidecarInternals } = await import("./prepare-tauri-sidecars.mjs");

	assert.match(sidecarInternals.weclawSourceDir, /sidecars\/weclaw$/);
	assert.deepEqual(sidecarInternals.goTargetEnv("aarch64-apple-darwin"), {
		CGO_ENABLED: "0",
		GOARCH: "arm64",
		GOOS: "darwin",
	});
	assert.deepEqual(sidecarInternals.goTargetEnv("x86_64-unknown-linux-gnu"), {
		CGO_ENABLED: "0",
		GOARCH: "amd64",
		GOOS: "linux",
	});
	assert.deepEqual(sidecarInternals.goTargetEnv("x86_64-pc-windows-msvc"), {
		CGO_ENABLED: "0",
		GOARCH: "amd64",
		GOOS: "windows",
	});
});

test("sidecar preparation does not truncate an existing sidecar placeholder", async () => {
  const { sidecarInternals } = await import("./prepare-tauri-sidecars.mjs");
  const tempDir = mkdtempSync(join(tmpdir(), "lc-sidecar-test-"));
  const existing = join(tempDir, "wx_bridge-aarch64-apple-darwin");
  writeFileSync(existing, "existing-binary");

  sidecarInternals.ensurePlaceholderSidecars("aarch64-apple-darwin", tempDir);

  assert.equal(readFileSync(existing, "utf8"), "existing-binary");
  assert.equal(readFileSync(join(tempDir, "weclaw-aarch64-apple-darwin"), "utf8"), "");
});

test("sidecar preparation installs rebuilt binaries by replacing the destination", async () => {
  const { sidecarInternals } = await import("./prepare-tauri-sidecars.mjs");
  const tempDir = mkdtempSync(join(tmpdir(), "lc-sidecar-test-"));
  const source = join(tempDir, "source");
  const destination = join(tempDir, "destination");
  writeFileSync(source, "new-binary");
  writeFileSync(destination, "old-binary");

  sidecarInternals.installFileAtomically(source, destination);

  assert.equal(readFileSync(destination, "utf8"), "new-binary");
});

test("sidecar preparation creates and cleans temporary frontend dist placeholders", async () => {
  const { sidecarInternals } = await import("./prepare-tauri-sidecars.mjs");
  const tempDir = mkdtempSync(join(tmpdir(), "lc-sidecar-dist-test-"));
  const distDir = join(tempDir, "dist");

  const cleanup = sidecarInternals.ensureFrontendDistPlaceholder(distDir);

  assert.equal(
    readFileSync(join(distDir, "index.html"), "utf8"),
    "<!doctype html><html><body></body></html>\n",
  );
  assert.equal(
    readFileSync(join(distDir, "assets", "sidecar-placeholder.txt"), "utf8"),
    "sidecar placeholder\n",
  );

  cleanup();

  assert.equal(existsSync(distDir), false);
});

test("sidecar preparation keeps existing frontend dist files intact", async () => {
  const { sidecarInternals } = await import("./prepare-tauri-sidecars.mjs");
  const tempDir = mkdtempSync(join(tmpdir(), "lc-sidecar-dist-test-"));
  const distDir = join(tempDir, "dist");
  const assetsDir = join(distDir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(join(distDir, "index.html"), "real-index");
  writeFileSync(join(assetsDir, "app.js"), "real-asset");

  const cleanup = sidecarInternals.ensureFrontendDistPlaceholder(distDir);
  cleanup();

  assert.equal(readFileSync(join(distDir, "index.html"), "utf8"), "real-index");
  assert.equal(readFileSync(join(assetsDir, "app.js"), "utf8"), "real-asset");
  assert.equal(existsSync(join(assetsDir, "sidecar-placeholder.txt")), false);
});
