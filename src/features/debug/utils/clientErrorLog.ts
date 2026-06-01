import type { DebugEntry } from "../../../types";

const SCHEMA_VERSION = 1;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 1000;
const TEXT_SUMMARY_KEY_PATTERN =
  /(prompt|content|text|output|stdout|stderr|raw|delta|messageBody)/i;
const SECRET_KEY_PATTERN =
  /(token|password|secret|apiKey|api_key|authorization|cookie|credential)/i;

export type ClientErrorLogEntry = {
  schemaVersion: number;
  timestamp: string;
  source: DebugEntry["source"];
  label: string;
  payload?: unknown;
};

export function shouldPersistClientErrorLogEntry(entry: DebugEntry): boolean {
  if (entry.source === "error" || entry.source === "stderr") {
    return true;
  }

  const label = entry.label.toLowerCase();
  if (label === "thread/session:turn-settlement:rejected") {
    return true;
  }

  if (!label.startsWith("thread/session:turn-diagnostic:")) {
    return false;
  }

  if (label.includes("three-evidence-dry-run")) {
    const payload = entry.payload;
    if (!payload || typeof payload !== "object") {
      return false;
    }
    const dryRunDecision = (payload as Record<string, unknown>).dryRunDecision;
    return (
      dryRunDecision === "wouldReject" ||
      dryRunDecision === "wouldDefer" ||
      dryRunDecision === "wouldRequestReconciliation" ||
      dryRunDecision === "wouldCleanupResidue"
    );
  }

  return (
    label.includes("terminal-settlement-rejected") ||
    label.includes("terminal-settlement-busy-residue") ||
    label.includes("codex-no-progress-watchdog-fired") ||
    label.includes("codex-no-progress-watchdog-skipped") ||
    label.includes("codex-no-progress-suspected") ||
    label.includes("three-evidence-reconciliation-query-requested") ||
    label.includes("three-evidence-reconciliation-query-skipped") ||
    label.includes("three-evidence-reconciliation-query-resolved") ||
    label.includes("three-evidence-reconciliation-query-rejected") ||
    label.includes("three-evidence-reconciliation-query-failed") ||
    label.includes("three-evidence-reconciliation-cleanup-applied") ||
    label.includes("three-evidence-reconciliation-cleanup-skipped")
  );
}

export function buildClientErrorLogEntry(entry: DebugEntry): ClientErrorLogEntry {
  const timestamp = Number.isFinite(entry.timestamp)
    ? new Date(entry.timestamp).toISOString()
    : new Date().toISOString();

  return {
    schemaVersion: SCHEMA_VERSION,
    timestamp,
    source: entry.source,
    label: truncateString(entry.label, 240),
    ...(entry.payload !== undefined
      ? { payload: sanitizePayload(entry.payload, 0, null) }
      : {}),
  };
}

function sanitizePayload(
  value: unknown,
  depth: number,
  key: string | null,
): unknown {
  if (key && SECRET_KEY_PATTERN.test(key)) {
    return "[redacted]";
  }

  if (typeof value === "string") {
    if (key && TEXT_SUMMARY_KEY_PATTERN.test(key)) {
      return { redactedText: true, length: value.length };
    }
    return truncateString(value, MAX_STRING_LENGTH);
  }

  if (value == null || typeof value !== "object") {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return { truncated: true, reason: "max-depth" };
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizePayload(item, depth + 1, null));
    if (value.length <= MAX_ARRAY_ITEMS) {
      return items;
    }
    return [
      ...items,
      {
        truncated: true,
        omittedItems: value.length - MAX_ARRAY_ITEMS,
      },
    ];
  }

  const output: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    output[childKey] = sanitizePayload(childValue, depth + 1, childKey);
  }
  return output;
}

function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...(truncated)`;
}
