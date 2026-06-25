#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
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
const TARGET_TRIPLE =
  process.env.TAURI_ENV_TARGET_TRIPLE ||
  (process.platform === "darwin"
    ? `${process.arch === "arm64" ? "aarch64" : "x86_64"}-apple-darwin`
    : process.platform === "win32"
      ? "x86_64-pc-windows-msvc"
      : `${process.arch === "arm64" ? "aarch64" : "x86_64"}-unknown-linux-gnu`);

function resolveSmokeConfig(env = process.env) {
  const daemonAddr = env.WECHAT_SMOKE_DAEMON_ADDR || "127.0.0.1:47329";
  const weclawApiAddr = env.WECHAT_SMOKE_WECLAW_API_ADDR || "127.0.0.1:18031";
  const bridgeAddr = env.WECHAT_SMOKE_BRIDGE_ADDR || "127.0.0.1:18032";
  const bridgeBaseUrl = `http://${bridgeAddr}`;
  return {
    daemonAddr,
    weclawApiAddr,
    bridgeAddr,
    bridgeBaseUrl,
    bridgeChatEndpoint: `${bridgeBaseUrl}/v1/chat/completions`,
    token: env.WECHAT_SMOKE_TOKEN || "wechat-bridge-smoke-token",
  };
}

const SMOKE_CONFIG = resolveSmokeConfig();

function sidecarPath(name) {
  const extension = TARGET_TRIPLE.includes("windows") ? ".exe" : "";
  return join(ROOT_DIR, "src-tauri", "binaries", `${name}-${TARGET_TRIPLE}${extension}`);
}

function buildWeclawConfig(endpoint) {
  return {
    default_agent: "lawyer-copilot",
    agents: {
      "lawyer-copilot": {
        type: "http",
        endpoint,
        model: "claude",
        max_history: 20,
        aliases: ["lc", "law"],
      },
    },
  };
}

function hasScanPrompt(logText) {
  return /QR URL:|Waiting for scan|Scan this QR code|二维码/.test(logText);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
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

async function waitForBridgeHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${SMOKE_CONFIG.bridgeBaseUrl}/healthz`);
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

async function waitForWeclawScanPrompt(logPath) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const logText = readLog(logPath);
    if (hasScanPrompt(logText)) {
      return;
    }
    await sleep(500);
  }
  throw new Error("WeClaw did not emit a scan prompt");
}

function readLog(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function assertIsolatedFallbackContent(value) {
  const content = typeof value === "string" ? value.replace(/\r/g, "").trim() : "";
  if (!content.includes("电脑端暂时没有响应")) {
    throw new Error("isolated bridge smoke did not return the expected desktop fallback");
  }
  return content;
}

async function postSmokeChat() {
  const response = await fetch(`${SMOKE_CONFIG.bridgeChatEndpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-weclaw-user": "smoke-user",
      "x-weclaw-msg-id": "smoke-msg-1",
    },
    body: JSON.stringify({
      model: "claude",
      user: "smoke-user",
      messages: [{ role: "user", content: "你好" }],
    }),
  });
  if (!response.ok) {
    throw new Error(`smoke chat failed with HTTP ${response.status}`);
  }
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  return assertIsolatedFallbackContent(content);
}

function stopProcess(child) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
}

async function runSmoke() {
  const tempRoot = mkdtempSync(join(tmpdir(), "lc-wechat-smoke-"));
  const homeDir = join(tempRoot, "home");
  const weclawDir = join(homeDir, ".weclaw");
  mkdirSync(weclawDir, { recursive: true });
  writeFileSync(
    join(weclawDir, "config.json"),
    JSON.stringify(buildWeclawConfig(SMOKE_CONFIG.bridgeChatEndpoint), null, 2),
  );

  const daemonLog = join(tempRoot, "daemon.log");
  const bridgeLog = join(tempRoot, "bridge.log");
  const weclawLog = join(tempRoot, "weclaw.log");
  writeFileSync(daemonLog, "");
  writeFileSync(bridgeLog, "");
  writeFileSync(weclawLog, "");

  const daemonOut = openSync(daemonLog, "a");
  const bridgeOut = openSync(bridgeLog, "a");
  const weclawOut = openSync(weclawLog, "a");

  const children = [];
  try {
    children.push(
      spawnLogged(
        sidecarPath("cc_gui_daemon"),
          ["--listen", SMOKE_CONFIG.daemonAddr, "--token", SMOKE_CONFIG.token, "--data-dir", join(tempRoot, "daemon-data")],
        { stdout: daemonOut, stderr: daemonOut },
      ),
    );
    children.push(
      spawnLogged(
        sidecarPath("wx_bridge"),
        [
          "--daemon-host",
          SMOKE_CONFIG.daemonAddr,
          "--token",
          SMOKE_CONFIG.token,
          "--listen",
          SMOKE_CONFIG.bridgeAddr,
          "--default-workspace",
          "default",
          "--data-dir",
          join(tempRoot, "bridge-data"),
        ],
        { stdout: bridgeOut, stderr: bridgeOut },
      ),
    );
    await waitForBridgeHealth();
    const content = await postSmokeChat();

    children.push(
      spawnLogged(
        sidecarPath("weclaw"),
        ["start", "--foreground", "--api-addr", SMOKE_CONFIG.weclawApiAddr],
        { env: { ...process.env, HOME: homeDir }, stdout: weclawOut, stderr: weclawOut },
      ),
    );
    await waitForWeclawScanPrompt(weclawLog);

    console.log("bridge-health: ok");
    console.log(`bridge-fallback: ${content}`);
    console.log("weclaw-scan: ready");
  } finally {
    for (const child of children.reverse()) {
      stopProcess(child);
    }
    await sleep(500);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export const smokeInternals = {
  assertIsolatedFallbackContent,
  buildWeclawConfig,
  hasScanPrompt,
  resolveSmokeConfig,
  sidecarPath,
};

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  runSmoke().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
