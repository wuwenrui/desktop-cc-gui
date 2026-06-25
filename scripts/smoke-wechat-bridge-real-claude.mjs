#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import {
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const DEFAULT_DATA_DIR =
  process.platform === "darwin"
    ? join(process.env.HOME ?? ".", "Library", "Application Support", "com.zhukunpenglinyutong.ccgui")
    : join(process.env.HOME ?? ".", ".local", "share", "cc_gui_daemon");
const DEFAULT_DAEMON_ADDR = "127.0.0.1:47331";
const DEFAULT_BRIDGE_ADDR = "127.0.0.1:18013";
const PROBE_USER = "real-smoke-user";
const PROBE_TEXT = "只回复 OK，不要解释。";

function parseArgs(argv) {
  const options = {
    dataDir: process.env.LC_WECHAT_REAL_DATA_DIR || DEFAULT_DATA_DIR,
    workspaceId: process.env.LC_WECHAT_REAL_WORKSPACE_ID || null,
    daemonAddr: process.env.LC_WECHAT_REAL_DAEMON_ADDR || DEFAULT_DAEMON_ADDR,
    bridgeAddr: process.env.LC_WECHAT_REAL_BRIDGE_ADDR || DEFAULT_BRIDGE_ADDR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--data-dir") {
      options.dataDir = argv[++index];
    } else if (arg === "--workspace-id") {
      options.workspaceId = argv[++index];
    } else if (arg === "--daemon-addr") {
      options.daemonAddr = argv[++index];
    } else if (arg === "--bridge-addr") {
      options.bridgeAddr = argv[++index];
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/smoke-wechat-bridge-real-claude.mjs [--workspace-id <id>] [--data-dir <path>]`);
}

function binaryPath(name) {
  const extension = process.platform === "win32" ? ".exe" : "";
  return join(ROOT_DIR, "src-tauri", "target", "debug", `${name}${extension}`);
}

function readWorkspaces(dataDir) {
  const path = join(dataDir, "workspaces.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

function selectWorkspace(workspaces, requestedId) {
  if (requestedId) {
    const requested = workspaces.find((workspace) => workspace.id === requestedId);
    if (!requested) {
      throw new Error(`workspace not found: ${requestedId}`);
    }
    return requested;
  }
  const claudeWorkspace = workspaces.find(
    (workspace) => workspace?.settings?.engineType === "claude",
  );
  if (claudeWorkspace) {
    return claudeWorkspace;
  }
  const [first] = workspaces;
  if (!first) {
    throw new Error("no workspace configured in real app data dir");
  }
  return first;
}

function buildProbeRequest() {
  return {
    model: "claude",
    user: PROBE_USER,
    messages: [{ role: "user", content: PROBE_TEXT }],
  };
}

function normalizeProbeContent(value) {
  return String(value ?? "").replace(/\r/g, "").trimEnd();
}

function assertProbeContent(value) {
  const content = normalizeProbeContent(value);
  if (content !== "OK") {
    throw new Error(`expected exact OK from real Claude probe, got ${JSON.stringify(content)}`);
  }
  return content;
}

function spawnLogged(command, args, options) {
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    env: options.env ?? process.env,
    stdio: ["ignore", options.stdout, options.stderr],
  });
  child.on("error", (error) => {
    console.error(`${command} failed to start: ${error.message}`);
  });
  return child;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function splitHostPort(addr) {
  const index = addr.lastIndexOf(":");
  if (index <= 0) {
    throw new Error(`invalid host:port address: ${addr}`);
  }
  return {
    host: addr.slice(0, index),
    port: Number(addr.slice(index + 1)),
  };
}

function canConnect(addr) {
  const { host, port } = splitHostPort(addr);
  return new Promise((resolveConnect) => {
    const socket = createConnection({ host, port });
    socket.once("connect", () => {
      socket.end();
      resolveConnect(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolveConnect(false);
    });
  });
}

async function waitForTcpPort(addr, options = {}) {
  const attempts = options.attempts ?? 40;
  const intervalMs = options.intervalMs ?? 250;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await canConnect(addr)) {
      return;
    }
    await sleep(intervalMs);
  }
  throw new Error(`daemon did not listen on ${addr}`);
}

async function runCommand(command, args) {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: ROOT_DIR, stdio: "inherit" });
    child.on("error", rejectRun);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

async function ensureDebugBinaries() {
  if (existsSync(binaryPath("cc_gui_daemon")) && existsSync(binaryPath("wx_bridge"))) {
    return;
  }
  await runCommand("cargo", [
    "build",
    "--manifest-path",
    join(ROOT_DIR, "src-tauri", "Cargo.toml"),
    "--bin",
    "cc_gui_daemon",
    "--bin",
    "wx_bridge",
  ]);
}

async function waitForBridgeHealth(bridgeAddr) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://${bridgeAddr}/healthz`);
      if (response.ok && (await response.text()).trim() === "ok") {
        return;
      }
    } catch {
      // Process may still be starting.
    }
    await sleep(250);
  }
  throw new Error("wx_bridge health check did not become ready");
}

async function postProbe(bridgeAddr, messageId) {
  const response = await fetch(`http://${bridgeAddr}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-weclaw-user": PROBE_USER,
      "x-weclaw-msg-id": messageId,
    },
    body: JSON.stringify(buildProbeRequest(messageId)),
  });
  if (!response.ok) {
    throw new Error(`real Claude probe failed with HTTP ${response.status}`);
  }
  const body = await response.json();
  return assertProbeContent(body?.choices?.[0]?.message?.content);
}

function stopProcess(child) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
}

async function runRealClaudeSmoke(options) {
  await ensureDebugBinaries();
  const workspaces = readWorkspaces(options.dataDir);
  const workspace = selectWorkspace(workspaces, options.workspaceId);
  const tempRoot = mkdtempSync(join(tmpdir(), "lc-real-wechat-smoke-"));
  const daemonLog = join(tempRoot, "daemon.log");
  const bridgeLog = join(tempRoot, "bridge.log");
  writeFileSync(daemonLog, "");
  writeFileSync(bridgeLog, "");
  const daemonOut = openSync(daemonLog, "a");
  const bridgeOut = openSync(bridgeLog, "a");
  const token = `real-smoke-${randomUUID()}`;
  const children = [];
  try {
    children.push(
      spawnLogged(
        binaryPath("cc_gui_daemon"),
        ["--listen", options.daemonAddr, "--token", token, "--data-dir", options.dataDir],
        { stdout: daemonOut, stderr: daemonOut },
      ),
    );
    await waitForTcpPort(options.daemonAddr);
    children.push(
      spawnLogged(
        binaryPath("wx_bridge"),
        [
          "--daemon-host",
          options.daemonAddr,
          "--token",
          token,
          "--listen",
          options.bridgeAddr,
          "--default-workspace",
          workspace.id,
          "--data-dir",
          join(tempRoot, "bridge-data"),
        ],
        { stdout: bridgeOut, stderr: bridgeOut },
      ),
    );
    await waitForBridgeHealth(options.bridgeAddr);
    const content = await postProbe(options.bridgeAddr, `real-smoke-${Date.now()}`);
    console.log(`real-claude-workspace: ${workspace.name ?? workspace.id}`);
    console.log(`real-claude-content: ${content}`);
  } finally {
    for (const child of children.reverse()) {
      stopProcess(child);
    }
    await sleep(500);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export const realClaudeSmokeInternals = {
  assertProbeContent,
  buildProbeRequest,
  normalizeProbeContent,
  selectWorkspace,
  waitForTcpPort,
};

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(2);
  }
  runRealClaudeSmoke(options).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
