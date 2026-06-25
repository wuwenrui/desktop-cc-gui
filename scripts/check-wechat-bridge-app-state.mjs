#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const DEFAULT_APP_DATA =
  process.platform === "darwin"
    ? join(process.env.HOME ?? ".", "Library", "Application Support", "com.zhukunpenglinyutong.ccgui")
    : join(process.env.HOME ?? ".", ".local", "share", "cc_gui_daemon");
const DEFAULT_BRIDGE_BASE_URL = "http://127.0.0.1:18012";
const DEFAULT_WECLAW_ACCOUNTS_DIR = join(process.env.HOME ?? ".", ".weclaw", "accounts");
const LOG_TAIL_LIMIT = 64 * 1024;

function parseArgs(argv) {
  const options = {
    appDataDir: process.env.LC_WECHAT_APP_DATA_DIR || DEFAULT_APP_DATA,
    bridgeBaseUrl: process.env.LC_WECHAT_BRIDGE_BASE_URL || DEFAULT_BRIDGE_BASE_URL,
    weclawAccountsDir:
      process.env.LC_WECHAT_WECLAW_ACCOUNTS_DIR || DEFAULT_WECLAW_ACCOUNTS_DIR,
    requireRealActivity: false,
    requireRealMedia: false,
    requireRealQuote: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--app-data-dir") {
      options.appDataDir = argv[++index];
    } else if (arg === "--bridge-base-url") {
      options.bridgeBaseUrl = argv[++index];
    } else if (arg === "--weclaw-accounts-dir") {
      options.weclawAccountsDir = argv[++index];
    } else if (arg === "--require-real-activity") {
      options.requireRealActivity = true;
    } else if (arg === "--require-real-media") {
      options.requireRealMedia = true;
      options.requireRealActivity = true;
    } else if (arg === "--require-real-quote") {
      options.requireRealQuote = true;
      options.requireRealActivity = true;
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
  console.log(
    "Usage: node scripts/check-wechat-bridge-app-state.mjs [--app-data-dir <path>] [--weclaw-accounts-dir <path>] [--require-real-activity] [--require-real-media] [--require-real-quote]",
  );
}

function readPid(path) {
  if (!existsSync(path)) {
    return null;
  }
  const value = Number(readFileSync(path, "utf8").trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}

function isPidRunning(pid) {
  if (!pid) {
    return false;
  }
  if (process.platform === "win32") {
    const result = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], {
      encoding: "utf8",
    });
    return result.status === 0 && result.stdout.includes(String(pid));
  }
  const result = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
  if (result.status === 0) {
    return processStatIsRunning(result.stdout);
  }
  const fallback = spawnSync("kill", ["-0", String(pid)], { encoding: "utf8" });
  return fallback.status === 0;
}

function readTail(path) {
  if (!existsSync(path)) {
    return "";
  }
  const content = readFileSync(path);
  return content.subarray(Math.max(0, content.length - LOG_TAIL_LIMIT)).toString("utf8");
}

function readBoundWechatAccount(accountsDir) {
  if (!existsSync(accountsDir)) {
    return false;
  }
  try {
    return readdirSync(accountsDir)
      .filter((name) => name.endsWith(".json") && !name.endsWith(".sync.json"))
      .sort()
      .some((name) => {
        try {
          const content = readFileSync(join(accountsDir, name), "utf8");
          const credentials = JSON.parse(content);
          return typeof credentials?.ilink_user_id === "string" && credentials.ilink_user_id.trim().length > 0;
        } catch {
          return false;
        }
      });
  } catch {
    return false;
  }
}

function auditLogPath(root) {
  return join(root, "data", "audit.log");
}

function hasScanSignal(logText) {
  const scanIndex = lastMatchIndex(logText, /QR URL:|Waiting for scan|Scan this QR code|二维码/g);
  if (scanIndex < 0) {
    return false;
  }
  const expiredIndex = lastMatchIndex(
    logText,
    /QR code expired|login failed: QR code expired|二维码已过期/g,
  );
  return expiredIndex < scanIndex;
}

function lastMatchIndex(text, pattern) {
  let latest = -1;
  for (const match of text.matchAll(pattern)) {
    latest = match.index ?? latest;
  }
  return latest;
}

function processStatIsRunning(statText) {
  const stat = statText.trim();
  return stat.length > 0 && !stat.startsWith("Z");
}

function realWechatReplyState(logText) {
  let sawRealActivity = false;
  for (const line of logText.trim().split(/\r?\n/).reverse()) {
    const fields = parseAuditFields(line);
    const wxid = fields.wxid || "";
    if (!wxid || isSyntheticWechatWxid(wxid)) {
      continue;
    }
    sawRealActivity = true;
    if (fields.decision === "allow") {
      return "replied";
    }
  }
  return sawRealActivity ? "seen-without-reply" : "waiting";
}

function parseAuditFields(line) {
  return Object.fromEntries(
    line
      .split(/\s+/)
      .map((part) => part.split("=", 2))
      .filter(([key, value]) => key && value),
  );
}

function lastAuditFields(auditText) {
  for (const line of auditText.trim().split(/\r?\n/).reverse()) {
    const fields = parseAuditFields(line);
    if (fields.wxid) {
      return fields;
    }
  }
  return null;
}

function isSyntheticWechatWxid(wxid) {
  return (
    wxid === "local-wechat" ||
    wxid === "smoke-user" ||
    wxid === "real-smoke-user" ||
    wxid.startsWith("local-") ||
    wxid.startsWith("wxid_probe") ||
    wxid.startsWith("codex-live-dir-probe") ||
    wxid.includes("_probe") ||
    wxid.includes("-probe")
  );
}

function realWechatMediaState(logText) {
  let latest = "waiting";
  for (const line of currentWeclawRunLog(logText).trim().split(/\r?\n/)) {
    if (line.includes("[handler] saved image to ")) {
      latest = "saved";
    } else if (
      line.includes("[handler] failed to save image from ") ||
      line.includes("[handler] failed to prepare inbound image from ")
    ) {
      latest = "failed";
    } else if (line.includes("[handler] unsupported non-text message from ")) {
      latest = "unsupported";
    } else if (line.includes("[handler] received non-text message from ")) {
      latest = "skipped";
    }
  }
  return latest;
}

function realWechatQuoteState(logText) {
  let latest = "waiting";
  for (const line of currentWeclawRunLog(logText).trim().split(/\r?\n/)) {
    if (line.includes("[handler] received quoted message from ")) {
      latest = "parsed";
    } else if (line.includes("[handler] unparsed quote candidate from ")) {
      latest = "unparsed";
    }
  }
  return latest;
}

function currentWeclawRunLog(logText) {
  const markers = ["Starting message bridge", "Image save directory:"];
  const start = Math.max(...markers.map((marker) => logText.lastIndexOf(marker)));
  return start >= 0 ? logText.slice(start) : logText;
}

function lastWeclawHandlerKind(logText) {
  for (const line of currentWeclawRunLog(logText).trim().split(/\r?\n/).reverse()) {
    if (!line.includes("[handler]")) {
      continue;
    }
    if (line.includes("default agent ready:")) {
      continue;
    }
    if (line.includes("received quoted message from ")) {
      return "quote";
    }
    if (line.includes("unparsed quote candidate from ")) {
      return "quote-unparsed";
    }
    if (line.includes("message shape from ")) {
      return "message-shape";
    }
    if (line.includes("received image from ")) {
      return "image-received";
    }
    if (line.includes("saved image to ")) {
      return "image-saved";
    }
    if (line.includes("failed to save image from ")) {
      return "image-save-failed";
    }
    if (line.includes("failed to prepare inbound image from ")) {
      return "image-prepare-failed";
    }
    if (line.includes("unsupported non-text message from ")) {
      return "unsupported-media";
    }
    if (line.includes("received non-text message from ")) {
      return "skipped-media";
    }
    return "other";
  }
  return "none";
}

function lastWeclawDiagnostic(logText) {
  for (const line of currentWeclawRunLog(logText).trim().split(/\r?\n/).reverse()) {
    const quote = line.split("unparsed quote candidate from ", 2)[1];
    if (quote) {
      return sanitizeWeclawDiagnostic(quote);
    }
    const shape = line.split("message shape from ", 2)[1];
    if (shape) {
      return sanitizeWeclawDiagnostic(shape);
    }
  }
  return "none";
}

function sanitizeWeclawDiagnostic(value) {
  const afterSender = value.split(": ").slice(1).join(": ");
  const diagnostic = afterSender || value;
  return diagnostic
    .replace(/wxid_[A-Za-z0-9_-]+/g, "[wxid]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[id]");
}

function buildDiagnosticHints({ auditText, auditPath, weclawLog, weclawLogPath }) {
  const audit = lastAuditFields(auditText);
  const wxid = audit?.wxid ?? "";
  return {
    lastAuditWxidKind: !wxid ? "none" : isSyntheticWechatWxid(wxid) ? "synthetic" : "real",
    lastAuditDecision: audit?.decision ?? "none",
    lastWeclawHandler: lastWeclawHandlerKind(weclawLog),
    lastWeclawDiagnostic: lastWeclawDiagnostic(weclawLog),
    auditPath,
    weclawLogPath,
  };
}

async function bridgeHealthOk(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/healthz`);
    return response.ok && (await response.text()).trim() === "ok";
  } catch {
    return false;
  }
}

function buildSummary({
  bridgeHealthOk,
  bridgePidRunning,
  weclawPidRunning,
  scanSignal,
  boundWechatAccount = false,
  realWechatReplyState = "waiting",
  realWechatMediaState = "waiting",
  realWechatQuoteState = "waiting",
  requireRealActivity = false,
  requireRealMedia = false,
  requireRealQuote = false,
}) {
  const summary = {
    ok:
      bridgeHealthOk &&
      bridgePidRunning &&
      weclawPidRunning &&
      (!requireRealActivity || realWechatReplyState === "replied") &&
      (!requireRealMedia || realWechatMediaState === "saved") &&
      (!requireRealQuote || realWechatQuoteState === "parsed"),
    bridgeHealth: bridgeHealthOk ? "ok" : "missing",
    bridgeProcess: bridgePidRunning ? "running" : "stopped",
    weclawProcess: weclawPidRunning ? "running" : "stopped",
    scan: scanSignal && weclawPidRunning ? "ready" : boundWechatAccount && weclawPidRunning ? "bound" : "not-ready",
    boundWechat: boundWechatAccount ? "present" : "missing",
    realWechatReply: realWechatReplyState,
    realWechatMedia: realWechatMediaState,
    realWechatQuote: realWechatQuoteState,
  };
  return summary;
}

async function runCheck(options) {
  const root = join(options.appDataDir, "wechat-bridge");
  const bridgePid = readPid(join(root, "wx_bridge.pid"));
  const weclawPid = readPid(join(root, "weclaw.pid"));
  const auditPath = auditLogPath(root);
  const weclawLogPath = join(root, "weclaw.log");
  const auditText = readTail(auditPath);
  const weclawLog = readTail(weclawLogPath);
  const boundWechatAccount = readBoundWechatAccount(options.weclawAccountsDir);
  const summary = buildSummary({
    bridgeHealthOk: await bridgeHealthOk(options.bridgeBaseUrl),
    bridgePidRunning: isPidRunning(bridgePid),
    weclawPidRunning: isPidRunning(weclawPid),
    scanSignal: hasScanSignal(weclawLog),
    boundWechatAccount,
    realWechatReplyState: realWechatReplyState(auditText),
    realWechatMediaState: realWechatMediaState(weclawLog),
    realWechatQuoteState: realWechatQuoteState(weclawLog),
    requireRealActivity: options.requireRealActivity,
    requireRealMedia: options.requireRealMedia,
    requireRealQuote: options.requireRealQuote,
  });
  console.log(`app-bridge-health: ${summary.bridgeHealth}`);
  console.log(`app-wx_bridge-pid: ${summary.bridgeProcess}`);
  console.log(`app-weclaw-pid: ${summary.weclawProcess}`);
  console.log(`app-scan: ${summary.scan}`);
  console.log(`app-bound-wechat: ${summary.boundWechat}`);
  if (options.requireRealActivity || options.requireRealMedia || options.requireRealQuote) {
    console.log(`app-real-wechat-reply: ${summary.realWechatReply}`);
    console.log(`app-real-wechat-media: ${summary.realWechatMedia}`);
    console.log(`app-real-wechat-quote: ${summary.realWechatQuote}`);
    const hints = buildDiagnosticHints({ auditText, auditPath, weclawLog, weclawLogPath });
    console.log(`app-last-audit-wxid-kind: ${hints.lastAuditWxidKind}`);
    console.log(`app-last-audit-decision: ${hints.lastAuditDecision}`);
    console.log(`app-last-weclaw-handler: ${hints.lastWeclawHandler}`);
    console.log(`app-last-weclaw-diagnostic: ${hints.lastWeclawDiagnostic}`);
    console.log(`app-audit-log: ${hints.auditPath}`);
    console.log(`app-weclaw-log: ${hints.weclawLogPath}`);
  }
  if (!summary.ok) {
    process.exitCode = 1;
  }
}

export const appStateCheckInternals = {
  auditLogPath,
  buildDiagnosticHints,
  buildSummary,
  hasScanSignal,
  isPidRunning,
  processStatIsRunning,
  currentWeclawRunLog,
  isSyntheticWechatWxid,
  lastWeclawDiagnostic,
  lastWeclawHandlerKind,
  realWechatMediaState,
  realWechatQuoteState,
  realWechatReplyState,
  readPid,
  readBoundWechatAccount,
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
  runCheck(options).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
