import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";
import type { EngineType } from "../../../types";

const STORE_KEY = "liveAssistantShadowTranscripts";
const MAX_ENTRY_CHARS = 120_000;
const MAX_TOTAL_CHARS = 400_000;
const MAX_ENTRIES = 48;
const MAX_ACTIVE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SETTLED_AGE_MS = 24 * 60 * 60 * 1000;
const RECOVERY_DISABLED_KEY = "ccgui.recovery.liveAssistantShadowTranscript.disabled";

export type LiveAssistantShadowTranscriptEntry = {
  id: string;
  engine: EngineType;
  workspaceId: string;
  threadId: string;
  sessionId: string;
  turnId: string | null;
  itemId: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  settledAt?: number;
  providerFinalObserved?: boolean;
};

export type LiveAssistantShadowTranscriptInput = {
  engine: EngineType;
  workspaceId: string;
  threadId: string;
  turnId?: string | null;
  itemId: string;
};

export type LiveAssistantShadowTranscriptStore = Record<
  string,
  LiveAssistantShadowTranscriptEntry
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeThreadSessionId(threadId: string) {
  const separatorIndex = threadId.indexOf(":");
  return separatorIndex >= 0 ? threadId.slice(separatorIndex + 1) : threadId;
}

export function buildLiveAssistantShadowTranscriptId(
  input: LiveAssistantShadowTranscriptInput,
) {
  return [
    input.engine,
    input.workspaceId,
    input.threadId,
    input.turnId ?? "",
    input.itemId,
  ].join("\u0000");
}

function normalizeTurnId(value: unknown) {
  return asString(value).trim();
}

function getShadowRecoveryPriority(entry: LiveAssistantShadowTranscriptEntry) {
  if (!entry.providerFinalObserved && !entry.settledAt) {
    return 2;
  }
  if (!entry.providerFinalObserved) {
    return 1;
  }
  return 0;
}

function mergeShadowSnapshotText(existingText: string, snapshotText: string) {
  if (!snapshotText) {
    return existingText;
  }
  if (!existingText) {
    return snapshotText;
  }
  if (snapshotText === existingText) {
    return existingText;
  }
  if (snapshotText.startsWith(existingText)) {
    return snapshotText;
  }
  if (existingText.startsWith(snapshotText)) {
    return existingText;
  }
  const maxOverlap = Math.min(existingText.length, snapshotText.length);
  for (let length = maxOverlap; length > 0; length -= 1) {
    if (existingText.endsWith(snapshotText.slice(0, length))) {
      return `${existingText}${snapshotText.slice(length)}`;
    }
  }
  return `${existingText}${snapshotText}`;
}

function chooseSettledShadowText({
  providerText,
  exactText,
  legacyText,
}: {
  providerText?: string;
  exactText?: string;
  legacyText?: string;
}) {
  if (providerText) {
    return providerText;
  }
  if (exactText) {
    return exactText;
  }
  if (legacyText) {
    return legacyText;
  }
  return providerText ?? exactText ?? legacyText ?? "";
}

function normalizeEntry(value: unknown): LiveAssistantShadowTranscriptEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const engine = asString(value.engine) as EngineType;
  const workspaceId = asString(value.workspaceId);
  const threadId = asString(value.threadId);
  const itemId = asString(value.itemId);
  const text = asString(value.text);
  const createdAt = asNumber(value.createdAt);
  const updatedAt = asNumber(value.updatedAt);
  if (
    !id ||
    engine !== "claude" ||
    !workspaceId ||
    !threadId ||
    !itemId ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return null;
  }
  return {
    id,
    engine,
    workspaceId,
    threadId,
    sessionId: asString(value.sessionId) || normalizeThreadSessionId(threadId),
    turnId: typeof value.turnId === "string" && value.turnId ? value.turnId : null,
    itemId,
    text: text.slice(0, MAX_ENTRY_CHARS),
    createdAt,
    updatedAt,
    ...(typeof asNumber(value.settledAt) === "number"
      ? { settledAt: asNumber(value.settledAt) }
      : {}),
    ...(value.providerFinalObserved === true ? { providerFinalObserved: true } : {}),
  };
}

export function normalizeLiveAssistantShadowTranscriptStore(
  value: unknown,
  now = Date.now(),
): LiveAssistantShadowTranscriptStore {
  if (!isRecord(value)) {
    return {};
  }
  const entries: LiveAssistantShadowTranscriptEntry[] = [];
  for (const candidate of Object.values(value)) {
    const entry = normalizeEntry(candidate);
    if (!entry) {
      continue;
    }
    const maxAge = entry.settledAt ? MAX_SETTLED_AGE_MS : MAX_ACTIVE_AGE_MS;
    if (now - entry.updatedAt > maxAge) {
      continue;
    }
    entries.push(entry);
  }
  return pruneLiveAssistantShadowTranscriptEntries(entries, now);
}

function pruneLiveAssistantShadowTranscriptEntries(
  entries: LiveAssistantShadowTranscriptEntry[],
  now = Date.now(),
): LiveAssistantShadowTranscriptStore {
  const sorted = entries
    .filter((entry) => now - entry.updatedAt <= (entry.settledAt ? MAX_SETTLED_AGE_MS : MAX_ACTIVE_AGE_MS))
    .sort((left, right) => {
      const priorityDiff =
        getShadowRecoveryPriority(right) - getShadowRecoveryPriority(left);
      return priorityDiff || right.updatedAt - left.updatedAt;
    });
  const retained: LiveAssistantShadowTranscriptEntry[] = [];
  let totalChars = 0;
  for (const entry of sorted) {
    if (retained.length >= MAX_ENTRIES) {
      continue;
    }
    const nextTotal = totalChars + entry.text.length;
    if (nextTotal > MAX_TOTAL_CHARS && retained.length > 0) {
      continue;
    }
    retained.push(entry);
    totalChars = nextTotal;
  }
  return Object.fromEntries(retained.map((entry) => [entry.id, entry]));
}

function readStore(now = Date.now()) {
  return normalizeLiveAssistantShadowTranscriptStore(
    getClientStoreSync<unknown>("threads", STORE_KEY),
    now,
  );
}

function writeStore(store: LiveAssistantShadowTranscriptStore) {
  writeClientStoreValue("threads", STORE_KEY, store);
}

export function appendLiveAssistantShadowDelta(
  input: LiveAssistantShadowTranscriptInput & { delta: string; timestamp?: number },
) {
  if (input.engine !== "claude" || !input.delta) {
    return;
  }
  const now = input.timestamp ?? Date.now();
  const store = readStore(now);
  const id = buildLiveAssistantShadowTranscriptId(input);
  const existing = store[id];
  const text = `${existing?.text ?? ""}${input.delta}`.slice(0, MAX_ENTRY_CHARS);
  store[id] = {
    id,
    engine: "claude",
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    sessionId: normalizeThreadSessionId(input.threadId),
    turnId: input.turnId?.trim() || null,
    itemId: input.itemId,
    text,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  writeStore(pruneLiveAssistantShadowTranscriptEntries(Object.values(store), now));
}

export function upsertLiveAssistantShadowSnapshot(
  input: LiveAssistantShadowTranscriptInput & { text: string; timestamp?: number },
) {
  if (input.engine !== "claude" || !input.text) {
    return;
  }
  const now = input.timestamp ?? Date.now();
  const store = readStore(now);
  const id = buildLiveAssistantShadowTranscriptId(input);
  const existing = store[id];
  const text = mergeShadowSnapshotText(existing?.text ?? "", input.text).slice(
    0,
    MAX_ENTRY_CHARS,
  );
  store[id] = {
    id,
    engine: "claude",
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    sessionId: normalizeThreadSessionId(input.threadId),
    turnId: input.turnId?.trim() || existing?.turnId || null,
    itemId: input.itemId,
    text,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  writeStore(pruneLiveAssistantShadowTranscriptEntries(Object.values(store), now));
}

export function settleLiveAssistantShadowTranscript(
  input: LiveAssistantShadowTranscriptInput & {
    text?: string;
    providerFinalObserved?: boolean;
    timestamp?: number;
  },
) {
  if (input.engine !== "claude") {
    return;
  }
  const now = input.timestamp ?? Date.now();
  const store = readStore(now);
  const id = buildLiveAssistantShadowTranscriptId(input);
  const existing = store[id];
  const normalizedTurnId = input.turnId?.trim() || null;
  const legacyId = normalizedTurnId
    ? buildLiveAssistantShadowTranscriptId({ ...input, turnId: null })
    : null;
  const legacy = legacyId && legacyId !== id ? store[legacyId] : undefined;
  if (!existing && !legacy && !input.text) {
    return;
  }
  store[id] = {
    id,
    engine: "claude",
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    sessionId: normalizeThreadSessionId(input.threadId),
    turnId: normalizedTurnId || existing?.turnId || null,
    itemId: input.itemId,
    text: chooseSettledShadowText({
      providerText: input.text,
      exactText: existing?.text,
      legacyText: legacy?.text,
    }).slice(0, MAX_ENTRY_CHARS),
    createdAt: existing?.createdAt ?? legacy?.createdAt ?? now,
    updatedAt: now,
    settledAt: now,
    ...(input.providerFinalObserved ? { providerFinalObserved: true } : {}),
  };
  if (legacyId && legacyId !== id) {
    delete store[legacyId];
  }
  writeStore(pruneLiveAssistantShadowTranscriptEntries(Object.values(store), now));
}

export function isLiveAssistantShadowRecoveryEnabled() {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const value = window.localStorage.getItem(RECOVERY_DISABLED_KEY);
    return value !== "1" && value !== "true" && value !== "on";
  } catch {
    return true;
  }
}

export function findLiveAssistantShadowTranscriptForRestore(input: {
  workspaceId: string;
  threadId: string;
  sessionId?: string | null;
  requireUnsettled?: boolean;
  expectedTurnId?: string | null;
}): LiveAssistantShadowTranscriptEntry | null {
  if (!isLiveAssistantShadowRecoveryEnabled()) {
    return null;
  }
  const sessionId = input.sessionId?.trim() || normalizeThreadSessionId(input.threadId);
  const normalizedExpectedTurnId = normalizeTurnId(input.expectedTurnId);
  let candidates = Object.values(readStore()).filter((entry) => {
    if (entry.engine !== "claude" || entry.workspaceId !== input.workspaceId) {
      return false;
    }
    if (input.requireUnsettled && entry.providerFinalObserved) {
      return false;
    }
    return entry.threadId === input.threadId || entry.sessionId === sessionId;
  });
  if (!candidates.length) {
    return null;
  }
  if (normalizedExpectedTurnId) {
    const exactTurnMatches = candidates.filter(
      (entry) => entry.turnId === normalizedExpectedTurnId,
    );
    if (exactTurnMatches.length > 0) {
      candidates = exactTurnMatches;
    } else {
      candidates = candidates.filter((entry) => !entry.turnId);
    }
  }
  if (!candidates.length) {
    return null;
  }
  candidates.sort((left, right) => {
    const leftScore = (left.threadId === input.threadId ? 2 : 0) + (left.sessionId === sessionId ? 1 : 0);
    const rightScore = (right.threadId === input.threadId ? 2 : 0) + (right.sessionId === sessionId ? 1 : 0);
    return rightScore - leftScore || right.updatedAt - left.updatedAt;
  });
  return candidates.find((entry) => entry.text.trim().length > 0) ?? null;
}
