import type {
  BrowserContextAttachment,
  BrowserContextSnapshot,
} from "../types";

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;
const SUMMARY_CHAR_LIMIT = 360;

export type BrowserContextAttachmentOptions = {
  now?: number;
  staleAfterMs?: number;
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildSnapshotSummary(snapshot: BrowserContextSnapshot): string {
  const title = snapshot.source.title?.trim() || snapshot.source.normalizedUrl;
  const text = compactWhitespace(snapshot.page.visibleText);
  if (!text) {
    return title;
  }
  const excerpt = text.length > SUMMARY_CHAR_LIMIT
    ? `${text.slice(0, SUMMARY_CHAR_LIMIT)}...`
    : text;
  return `${title}\n${excerpt}`;
}

export function isBrowserContextAttachmentStale(
  attachment: BrowserContextAttachment,
  now = Date.now(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
): boolean {
  return now - attachment.capturedAt > staleAfterMs;
}

export function buildBrowserContextAttachment(
  snapshot: BrowserContextSnapshot,
  options: BrowserContextAttachmentOptions = {},
): BrowserContextAttachment {
  const now = options.now ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  return {
    kind: "browser_snapshot",
    attachmentId: `browser-attachment-${snapshot.snapshotId}`,
    browserSessionId: snapshot.browserSessionId,
    snapshotId: snapshot.snapshotId,
    workspaceId: snapshot.workspaceId,
    title: snapshot.source.title,
    url: snapshot.source.normalizedUrl,
    capturedAt: snapshot.capturedAt,
    stale: now - snapshot.capturedAt > staleAfterMs,
    summary: buildSnapshotSummary(snapshot),
    privacy: snapshot.privacy,
  };
}

export function formatBrowserContextPrompt(
  attachment: BrowserContextAttachment,
): string {
  const title = attachment.title?.trim() || attachment.url;
  const freshness = attachment.stale ? "stale" : "fresh";
  return [
    "<browser_context>",
    `source: ${title}`,
    `url: ${attachment.url}`,
    `capturedAt: ${new Date(attachment.capturedAt).toISOString()}`,
    `state: ${freshness}`,
    "summary:",
    attachment.summary,
    `privacy.omittedKinds: ${attachment.privacy.omittedKinds.join(", ")}`,
    `privacy.redactedKinds: ${attachment.privacy.redactedKinds.join(", ") || "none"}`,
    "</browser_context>",
  ].join("\n");
}

export function parseBrowserContextPrompt(
  text: string,
): Pick<
  BrowserContextAttachment,
  "title" | "url" | "capturedAt" | "stale" | "summary"
> | null {
  const match = text.match(/<browser_context>\n([\s\S]*?)\n<\/browser_context>/);
  if (!match) {
    return null;
  }
  const block = match[1] ?? "";
  const readLine = (key: string) => {
    const line = block.split("\n").find((entry) => entry.startsWith(`${key}: `));
    return line ? line.slice(key.length + 2).trim() : "";
  };
  const url = readLine("url");
  if (!url) {
    return null;
  }
  const capturedAt = Date.parse(readLine("capturedAt"));
  const summaryMatch = block.match(/summary:\n([\s\S]*?)\nprivacy\.omittedKinds:/);
  return {
    title: readLine("source") || url,
    url,
    capturedAt: Number.isFinite(capturedAt) ? capturedAt : Date.now(),
    stale: readLine("state") === "stale",
    summary: summaryMatch?.[1]?.trim() ?? "",
  };
}

export function stripBrowserContextPrompt(text: string): string {
  return text.replace(/<browser_context>\n[\s\S]*?\n<\/browser_context>\n*/g, "").trim();
}
