#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const TAURI_DIR = join(ROOT_DIR, "src-tauri");
const SIDECAR_DIR = join(TAURI_DIR, "binaries");
const WECLAW_SOURCE_DIR = join(ROOT_DIR, "sidecars", "weclaw");

const rustSidecarBinaryNames = ["cc_gui_daemon", "wx_bridge"];
const sidecarBinaryNames = [...rustSidecarBinaryNames, "weclaw"];

function sidecarSourceName(binaryName, targetTriple) {
  return targetTriple.includes("windows") ? `${binaryName}.exe` : binaryName;
}

function sidecarDestinationName(binaryName, targetTriple) {
  const extension = targetTriple.includes("windows") ? ".exe" : "";
  return `${binaryName}-${targetTriple}${extension}`;
}

function fallbackTargetTriple(env = process.env) {
  if (env.TAURI_ENV_TARGET_TRIPLE) {
    return env.TAURI_ENV_TARGET_TRIPLE;
  }
  if (env.TARGET) {
    return env.TARGET;
  }
  if (process.platform === "darwin") {
    return `${process.arch === "arm64" ? "aarch64" : "x86_64"}-apple-darwin`;
  }
  if (process.platform === "win32") {
    return "x86_64-pc-windows-msvc";
  }
  if (process.platform === "linux") {
    return `${process.arch === "arm64" ? "aarch64" : "x86_64"}-unknown-linux-gnu`;
  }
  throw new Error(`Unsupported platform for sidecar preparation: ${process.platform}`);
}

function profileFromEnv(env = process.env) {
  return env.TAURI_ENV_DEBUG === "true" ? "debug" : "release";
}

function targetRoot(env = process.env) {
  return env.CARGO_TARGET_DIR || join(TAURI_DIR, "target");
}

function sourcePath(binaryName, targetTriple, profile, env = process.env) {
  return join(
    targetRoot(env),
    targetTriple,
    profile,
    sidecarSourceName(binaryName, targetTriple),
  );
}

function destinationPath(binaryName, targetTriple, sidecarDir = SIDECAR_DIR) {
  return join(sidecarDir, sidecarDestinationName(binaryName, targetTriple));
}

function cargoArgs(targetTriple, profile) {
  const args = [
    "build",
    "--manifest-path",
    join(TAURI_DIR, "Cargo.toml"),
    "--target",
    targetTriple,
  ];
  if (profile === "release") {
    args.push("--release");
  }
  for (const binaryName of rustSidecarBinaryNames) {
    args.push("--bin", binaryName);
  }
  return args;
}

function ensurePlaceholderSidecars(targetTriple, sidecarDir = SIDECAR_DIR) {
  mkdirSync(sidecarDir, { recursive: true });
  for (const binaryName of sidecarBinaryNames) {
    const placeholder = destinationPath(binaryName, targetTriple, sidecarDir);
    if (existsSync(placeholder)) {
      continue;
    }
    writeFileSync(placeholder, "");
    chmodSync(placeholder, 0o755);
  }
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

function copyBuiltSidecars(targetTriple, profile, env = process.env) {
  mkdirSync(SIDECAR_DIR, { recursive: true });
  for (const binaryName of rustSidecarBinaryNames) {
    const from = sourcePath(binaryName, targetTriple, profile, env);
    const to = destinationPath(binaryName, targetTriple);
    installFileAtomically(from, to);
    console.log(`Prepared sidecar ${to}`);
  }
}

function stagedPath(path) {
  return `${path}.tmp-${process.pid}-${Date.now()}`;
}

function installFileAtomically(from, to) {
  const staged = stagedPath(to);
  try {
    copyFileSync(from, staged);
    chmodSync(staged, 0o755);
    renameSync(staged, to);
  } catch (error) {
    rmSync(staged, { force: true });
    throw error;
  }
}

function goTargetEnv(targetTriple) {
  if (targetTriple === "aarch64-apple-darwin") {
    return { CGO_ENABLED: "0", GOARCH: "arm64", GOOS: "darwin" };
  }
  if (targetTriple === "x86_64-apple-darwin") {
    return { CGO_ENABLED: "0", GOARCH: "amd64", GOOS: "darwin" };
  }
  if (targetTriple === "aarch64-unknown-linux-gnu") {
    return { CGO_ENABLED: "0", GOARCH: "arm64", GOOS: "linux" };
  }
  if (targetTriple === "x86_64-unknown-linux-gnu") {
    return { CGO_ENABLED: "0", GOARCH: "amd64", GOOS: "linux" };
  }
  if (targetTriple === "aarch64-pc-windows-msvc") {
    return { CGO_ENABLED: "0", GOARCH: "arm64", GOOS: "windows" };
  }
  if (targetTriple === "x86_64-pc-windows-msvc") {
    return { CGO_ENABLED: "0", GOARCH: "amd64", GOOS: "windows" };
  }
  throw new Error(`Unsupported WeClaw target triple: ${targetTriple}`);
}

function prepareWeClawSidecar(targetTriple, env = process.env) {
  const outputPath = destinationPath("weclaw", targetTriple);
  const stagedOutputPath = stagedPath(outputPath);
  mkdirSync(SIDECAR_DIR, { recursive: true });
  try {
    run(
      "go",
      ["build", "-C", WECLAW_SOURCE_DIR, "-o", stagedOutputPath, "."],
      { ...env, ...goTargetEnv(targetTriple) },
    );
    chmodSync(stagedOutputPath, 0o755);
    renameSync(stagedOutputPath, outputPath);
  } catch (error) {
    rmSync(stagedOutputPath, { force: true });
    throw error;
  }
  console.log(`Prepared sidecar ${outputPath}`);
}

function prepareUniversalMacSidecars(profile, env = process.env) {
  const targets = ["aarch64-apple-darwin", "x86_64-apple-darwin"];
  for (const targetTriple of targets) {
    ensurePlaceholderSidecars(targetTriple);
    run("cargo", cargoArgs(targetTriple, profile), env);
    prepareWeClawSidecar(targetTriple, env);
  }
  mkdirSync(SIDECAR_DIR, { recursive: true });
  for (const binaryName of rustSidecarBinaryNames) {
    const output = destinationPath(binaryName, "universal-apple-darwin");
    run(
      "lipo",
      [
        "-create",
        sourcePath(binaryName, targets[0], profile, env),
        sourcePath(binaryName, targets[1], profile, env),
        "-output",
        output,
      ],
      env,
    );
    chmodSync(output, 0o755);
    console.log(`Prepared universal sidecar ${output}`);
  }
  const weclawOutput = destinationPath("weclaw", "universal-apple-darwin");
  run(
    "lipo",
    [
      "-create",
      destinationPath("weclaw", targets[0]),
      destinationPath("weclaw", targets[1]),
      "-output",
      weclawOutput,
    ],
    env,
  );
  chmodSync(weclawOutput, 0o755);
  console.log(`Prepared universal sidecar ${weclawOutput}`);
}

function prepareSidecars(env = process.env) {
  const targetTriple = fallbackTargetTriple(env);
  const profile = profileFromEnv(env);
  if (targetTriple === "universal-apple-darwin") {
    prepareUniversalMacSidecars(profile, env);
    return;
  }
  ensurePlaceholderSidecars(targetTriple);
  run("cargo", cargoArgs(targetTriple, profile), env);
  copyBuiltSidecars(targetTriple, profile, env);
  prepareWeClawSidecar(targetTriple, env);
}

export const sidecarInternals = {
  cargoArgs,
  destinationPath,
  fallbackTargetTriple,
  ensurePlaceholderSidecars,
  goTargetEnv,
  installFileAtomically,
  prepareSidecars,
  profileFromEnv,
  rustSidecarBinaryNames,
  sidecarBinaryNames,
  sidecarDestinationName,
  sidecarSourceName,
  sourcePath,
  weclawSourceDir: WECLAW_SOURCE_DIR,
};

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  try {
    prepareSidecars();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
