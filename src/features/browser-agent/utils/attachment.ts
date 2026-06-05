import type {
  BrowserCodeCandidate,
  BrowserContextAttachment,
  BrowserContextSnapshot,
  BrowserDiagnostic,
  BrowserNoiseDiagnostic,
  BrowserObservation,
  BrowserObservationDiagnostic,
  BrowserObservationRendererBinding,
  BrowserObservationStaleReason,
  BrowserObservationState,
  BrowserObservationTransport,
  BrowserOcrTextSupplement,
  BrowserReadableBlock,
  BrowserScreenshotReference,
  BrowserSnapshotBudget,
  BrowserSnapshotFreshness,
  BrowserVisualEvidence,
} from "../types";
import { formatBrowserUserAnnotationEvidence } from "../annotations";

const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;
const SUMMARY_CHAR_LIMIT = 360;
const EXCERPT_CHAR_LIMIT = 720;
const PRIMARY_CONTENT_PAYLOAD_LIMIT = 4_000;
const READABLE_BLOCK_PAYLOAD_LIMIT = 1_600;
const VISUAL_NEARBY_PAYLOAD_LIMIT = 520;
const PAYLOAD_CANDIDATE_LIMIT = 8;

type BrowserContextPromptAttachment = Pick<
  BrowserContextAttachment,
  | "attachmentId"
  | "browserSessionId"
  | "snapshotId"
  | "workspaceId"
  | "title"
  | "url"
  | "capturedAt"
  | "stale"
  | "summary"
> & {
  freshness?: BrowserSnapshotFreshness;
  observation?: BrowserContextAttachment["observation"];
  visibleTextExcerpt?: string;
  pageType?: BrowserContextAttachment["pageType"];
  primaryContent?: string;
  readableBlocks?: BrowserReadableBlock[];
  noiseDiagnostics?: BrowserNoiseDiagnostic[];
  visualEvidence?: BrowserVisualEvidence[];
  screenshotRefs?: BrowserScreenshotReference[];
  ocrTextSupplements?: BrowserOcrTextSupplement[];
  annotations?: BrowserContextAttachment["annotations"];
  elementCounts?: BrowserContextAttachment["elementCounts"];
  diagnostics?: Array<Pick<BrowserDiagnostic, "severity" | "message">>;
  budget?: Partial<BrowserSnapshotBudget>;
  codeCandidates?: BrowserCodeCandidate[];
  privacy: {
    redactionApplied: boolean;
    redactedKinds: string[];
    omittedKinds: string[];
  };
};

type ParsedBrowserContextPromptAttachment = Pick<
  BrowserContextAttachment,
  | "title"
  | "url"
  | "capturedAt"
  | "stale"
  | "summary"
> &
  Partial<
    Pick<
      BrowserContextAttachment,
      | "pageType"
      | "freshness"
      | "primaryContent"
      | "visibleTextExcerpt"
      | "observation"
      | "readableBlocks"
      | "visualEvidence"
      | "screenshotRefs"
      | "ocrTextSupplements"
      | "annotations"
      | "noiseDiagnostics"
      | "codeCandidates"
      | "elementCounts"
    >
  >;

export type BrowserContextAttachmentOptions = {
  now?: number;
  staleAfterMs?: number;
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function primaryContentText(snapshot: BrowserContextSnapshot): string {
  const primary = snapshot.page.primaryContent?.text;
  if (primary?.trim()) {
    return primary;
  }
  const readable = snapshot.page.readableBlocks?.find((block) => block.text.trim());
  if (readable) {
    return readable.text;
  }
  return snapshot.page.visibleText;
}

function buildSnapshotSummary(snapshot: BrowserContextSnapshot): string {
  const title = snapshot.source.title?.trim() || snapshot.source.normalizedUrl;
  const text = compactWhitespace(primaryContentText(snapshot));
  if (!text) {
    return title;
  }
  const excerpt = text.length > SUMMARY_CHAR_LIMIT
    ? `${text.slice(0, SUMMARY_CHAR_LIMIT)}...`
    : text;
  return `${title}\n${excerpt}`;
}

function collectDiagnostics(snapshot: BrowserContextSnapshot): BrowserDiagnostic[] {
  return [
    ...snapshot.diagnostics.captureWarnings,
    ...snapshot.diagnostics.console,
  ].slice(0, snapshot.budget.diagnosticLimit);
}

function observationStateForSnapshot(
  snapshot: BrowserContextSnapshot,
  freshness: BrowserSnapshotFreshness,
): BrowserObservationState {
  if (freshness === "expired" || snapshot.availability === "expired") {
    return "expired";
  }
  if (snapshot.availability === "unsupported" || snapshot.availability === "deleted") {
    return "unsupported";
  }
  if (freshness === "stale") {
    return "stale";
  }
  if (freshness === "degraded" || snapshot.availability === "partial") {
    return "degraded";
  }
  return "available";
}

function observationTransportForSnapshot(
  snapshot: BrowserContextSnapshot,
): BrowserObservationTransport {
  if (snapshot.availability === "available") {
    return "webview_dom";
  }
  if (snapshot.availability === "partial") {
    return "metadata_fallback";
  }
  return "unavailable";
}

function observationRendererBindingForSnapshot(
  snapshot: BrowserContextSnapshot,
  state: BrowserObservationState,
): BrowserObservationRendererBinding {
  if (state === "unsupported") {
    return "unavailable";
  }
  return snapshot.freshness === "stale" ? "mismatched" : "matched";
}

export function deriveBrowserObservationStaleReasons(
  snapshot: BrowserContextSnapshot,
  freshness: BrowserSnapshotFreshness,
): BrowserObservationStaleReason[] {
  const reasons = new Set<BrowserObservationStaleReason>();
  if (freshness === "expired" || snapshot.availability === "expired") {
    reasons.add("ttl_expired");
  }
  if (
    freshness === "stale" ||
    freshness === "degraded" ||
    snapshot.availability === "partial"
  ) {
    reasons.add("capture_degraded");
  }
  if (snapshot.availability === "deleted") {
    reasons.add("session_closed");
  }
  if (snapshot.availability === "unsupported") {
    reasons.add("capture_degraded");
  }
  return Array.from(reasons);
}

function buildObservationDiagnostics(
  snapshot: BrowserContextSnapshot,
  state: BrowserObservationState,
  staleReasons: BrowserObservationStaleReason[],
): BrowserObservationDiagnostic[] {
  const diagnostics = collectDiagnostics(snapshot).map((diagnostic) => ({
    diagnosticId: `observation-${diagnostic.diagnosticId}`,
    severity: diagnostic.severity,
    userMessage: diagnostic.message,
    aiMessage: diagnostic.message,
  }));
  if (state !== "available" && diagnostics.length === 0) {
    diagnostics.push({
      diagnosticId: `observation-state-${snapshot.snapshotId}`,
      severity: state === "unsupported" || state === "expired" ? "error" : "warning",
      userMessage: `Browser observation is ${state}.`,
      aiMessage: `Browser observation is ${state}; stale reasons: ${staleReasons.join(", ") || "none"}.`,
    });
  }
  return diagnostics.slice(0, snapshot.budget.diagnosticLimit);
}

export function buildBrowserObservation(
  snapshot: BrowserContextSnapshot,
  freshness: BrowserSnapshotFreshness,
): BrowserObservation {
  const state = observationStateForSnapshot(snapshot, freshness);
  const staleReasons = deriveBrowserObservationStaleReasons(snapshot, freshness);
  return {
    schemaVersion: 1,
    observationId: `browser-observation-${snapshot.snapshotId}`,
    browserSessionId: snapshot.browserSessionId,
    workspaceId: snapshot.workspaceId,
    capturedAt: snapshot.capturedAt,
    state,
    staleReasons,
    transport: observationTransportForSnapshot(snapshot),
    rendererBinding: observationRendererBindingForSnapshot(snapshot, state),
    source: {
      url: snapshot.source.url,
      normalizedUrl: snapshot.source.normalizedUrl,
      origin: snapshot.source.origin,
      title: snapshot.source.title,
      tabLabel: snapshot.source.tabLabel,
      workspaceLocalAllowed: snapshot.source.workspaceLocalAllowed,
    },
    budget: snapshot.budget,
    privacy: snapshot.privacy,
    diagnostics: buildObservationDiagnostics(snapshot, state, staleReasons),
    omittedCapabilities: snapshot.omittedCapabilities ?? [],
  };
}

function limitCodeCandidates(candidates: BrowserCodeCandidate[]): BrowserCodeCandidate[] {
  return candidates.slice(0, PAYLOAD_CANDIDATE_LIMIT);
}

function limitReadableBlocks(blocks: BrowserReadableBlock[] | undefined): BrowserReadableBlock[] {
  return (blocks ?? []).slice(0, 8).map((block) => ({
    ...block,
    text: block.text.slice(0, READABLE_BLOCK_PAYLOAD_LIMIT),
    truncated: block.truncated || block.text.length > READABLE_BLOCK_PAYLOAD_LIMIT,
  }));
}

function limitVisualEvidence(items: BrowserVisualEvidence[] | undefined): BrowserVisualEvidence[] {
  return (items ?? []).slice(0, 12).map((item) => ({
    ...item,
    nearbyText: item.nearbyText?.slice(0, VISUAL_NEARBY_PAYLOAD_LIMIT) ?? item.nearbyText,
  }));
}

function buildScreenshotReferences(
  snapshot: BrowserContextSnapshot,
): BrowserScreenshotReference[] {
  const screenshotRef = snapshot.evidence.screenshotRef?.trim();
  if (!screenshotRef) {
    return [];
  }
  return [
    {
      refId: screenshotRef,
      browserSessionId: snapshot.browserSessionId,
      snapshotId: snapshot.snapshotId,
      capturedAt: snapshot.capturedAt,
      kind: "thumbnail_reference",
      storage: "metadata_only",
      modelPayloadAllowed: false,
      diagnostic: {
        diagnosticId: `visual-ref-${snapshot.snapshotId}`,
        severity: "info",
        userMessage: "Screenshot thumbnail reference is available as metadata only.",
        aiMessage:
          "Screenshot reference exists, but image binary is not included unless the user explicitly confirms visual model input.",
      },
    },
  ];
}

export function isBrowserContextAttachmentStale(
  attachment: BrowserContextAttachment,
  now = Date.now(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
): boolean {
  return attachment.stale || now - attachment.capturedAt > staleAfterMs;
}

export function buildBrowserContextAttachment(
  snapshot: BrowserContextSnapshot,
  options: BrowserContextAttachmentOptions = {},
): BrowserContextAttachment {
  const now = options.now ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const freshness =
    now - snapshot.capturedAt > staleAfterMs ? "expired" : snapshot.freshness;
  const stale = freshness !== "fresh";
  const codeCandidates = limitCodeCandidates(snapshot.codeCandidates ?? []);
  const readableBlocks = limitReadableBlocks(snapshot.page.readableBlocks);
  const visualEvidence = limitVisualEvidence(snapshot.page.visualEvidence);
  const primaryText = compactWhitespace(primaryContentText(snapshot));
  const observation = buildBrowserObservation(snapshot, freshness);
  const screenshotRefs = buildScreenshotReferences(snapshot);
  return {
    kind: "browser_snapshot",
    attachmentId: `browser-attachment-${snapshot.snapshotId}`,
    browserSessionId: snapshot.browserSessionId,
    snapshotId: snapshot.snapshotId,
    workspaceId: snapshot.workspaceId,
    title: snapshot.source.title,
    url: snapshot.source.normalizedUrl,
    capturedAt: snapshot.capturedAt,
    stale,
    freshness,
    observation,
    summary: buildSnapshotSummary(snapshot),
    visibleTextExcerpt: primaryText.slice(0, EXCERPT_CHAR_LIMIT),
    pageType: snapshot.page.pageType ?? "unknown",
    primaryContent: primaryText.slice(0, PRIMARY_CONTENT_PAYLOAD_LIMIT),
    readableBlocks,
    noiseDiagnostics: snapshot.page.noiseDiagnostics ?? [],
    visualEvidence,
    screenshotRefs,
    ocrTextSupplements: [],
    elementCounts: {
      headings: snapshot.page.headings.length,
      links: snapshot.page.links.length,
      buttons: snapshot.page.buttons.length,
      forms: snapshot.page.forms.length,
      landmarks: snapshot.page.elementLandmarks.length + snapshot.page.landmarks.length,
      codeCandidates: codeCandidates.length,
      readableBlocks: readableBlocks.length,
      visualEvidence: visualEvidence.length,
    },
    diagnostics: collectDiagnostics(snapshot),
    budget: snapshot.budget,
    codeCandidates,
    privacy: snapshot.privacy,
  };
}

export function formatBrowserContextPrompt(
  attachment: BrowserContextPromptAttachment,
): string {
  const title = attachment.title?.trim() || attachment.url;
  const freshness = attachment.freshness ?? (attachment.stale ? "stale" : "fresh");
  const observation = attachment.observation ?? {
    state: attachment.stale ? "stale" : "available",
    staleReasons: attachment.stale ? ["capture_degraded" as const] : [],
    transport: "unavailable" as const,
    rendererBinding: "unavailable" as const,
  };
  const diagnostics = (attachment.diagnostics ?? [])
    .map((diagnostic) => `- ${diagnostic.severity}: ${diagnostic.message}`)
    .join("\n") || "none";
  const candidates = (attachment.codeCandidates ?? [])
    .map(
      (candidate) =>
        `- ${candidate.filePath} (${candidate.reason}, ${candidate.confidence})${candidate.matchedText ? `: ${candidate.matchedText}` : ""}`,
    )
    .join("\n") || "none";
  const readableBlocks = (attachment.readableBlocks ?? [])
    .map((block, index) => `- block ${index + 1} (${block.role}, score=${block.score}, truncated=${block.truncated}): ${block.text}`)
    .join("\n") || "none";
  const visualEvidence = (attachment.visualEvidence ?? [])
    .map((item, index) => `- visual ${index + 1} (${item.kind}, sensitive=${item.sensitive}): ${item.label}${item.altText ? `; alt=${item.altText}` : ""}${item.srcOrigin ? `; origin=${item.srcOrigin}` : ""}${item.nearbyText ? `; nearby=${item.nearbyText}` : ""}`)
    .join("\n") || "none";
  const screenshotRefs = (attachment.screenshotRefs ?? [])
    .map((item, index) => `- screenshotRef ${index + 1}: ref=${item.refId}; storage=${item.storage}; modelPayloadAllowed=${item.modelPayloadAllowed}`)
    .join("\n") || "none";
  const ocrTextSupplements = (attachment.ocrTextSupplements ?? [])
    .map((item, index) => `- ocrText ${index + 1}: ref=${item.refId}; screenshotRef=${item.screenshotRefId}; truncated=${item.truncated}; modelPayloadAllowed=${item.modelPayloadAllowed}; text=${item.text}`)
    .join("\n") || "none";
  const annotations = (attachment.annotations ?? [])
    .map((annotation, index) => [
      `- annotation ${index + 1} (${annotation.anchor}, staleReasons=${annotation.staleReasons.join(",") || "none"}): ${annotation.userNote || "none"}`,
      annotation.region
        ? `  region: x=${annotation.region.x} y=${annotation.region.y} w=${annotation.region.width} h=${annotation.region.height}`
        : "  region: none",
      annotation.nearestElement
        ? `  nearestElement: ${annotation.nearestElement.role} "${annotation.nearestElement.label ?? "unlabeled"}"`
        : "  nearestElement: none",
      `  nearbyText: ${annotation.nearbyText ?? "none"}`,
      formatBrowserUserAnnotationEvidence(annotation),
    ].join("\n"))
    .join("\n") || "none";
  const noiseDiagnostics = (attachment.noiseDiagnostics ?? [])
    .map((diagnostic) => `- ${diagnostic.severity}: ${diagnostic.kind} score=${diagnostic.score}; ${diagnostic.message}`)
    .join("\n") || "none";
  return [
    "<browser_context_v2>",
    `snapshotId: ${attachment.snapshotId}`,
    `source: ${title}`,
    `url: ${attachment.url}`,
    `capturedAt: ${new Date(attachment.capturedAt).toISOString()}`,
    `freshness: ${freshness}`,
    `observation.state: ${observation.state}`,
    `observation.staleReasons: ${observation.staleReasons.join(", ") || "none"}`,
    `observation.transport: ${observation.transport}`,
    `observation.rendererBinding: ${observation.rendererBinding}`,
    `pageType: ${attachment.pageType ?? "unknown"}`,
    "sourceKind: browser_visible_page_snapshot",
    "usageHint: answer questions about the current page from this browser context first; do not switch to CLI/API/raw fetch unless the user explicitly asks for raw/API data or this context is degraded/insufficient.",
    "imageHint: visualEvidence describes visible images/figures/attachments from the browser page; use labels, alt text, origin, and nearby text as clues, but do not invent unseen image contents.",
    "visualSourceHint: DOM visual clues, OCR text, and screenshot references are separate evidence sources; screenshot refs are metadata only unless modelPayloadAllowed=true.",
    "annotationHint: annotations are structured text evidence only; no screenshot payload is included.",
    `budget.truncated: ${attachment.budget?.truncated ?? false}`,
    `budget.omittedElementCount: ${attachment.budget?.omittedElementCount ?? 0}`,
    `counts: headings=${attachment.elementCounts?.headings ?? 0}, links=${attachment.elementCounts?.links ?? 0}, buttons=${attachment.elementCounts?.buttons ?? 0}, forms=${attachment.elementCounts?.forms ?? 0}, landmarks=${attachment.elementCounts?.landmarks ?? 0}, readableBlocks=${attachment.elementCounts?.readableBlocks ?? 0}, visualEvidence=${attachment.elementCounts?.visualEvidence ?? 0}, codeCandidates=${attachment.elementCounts?.codeCandidates ?? 0}`,
    "summary:",
    attachment.summary,
    "primaryContent:",
    attachment.primaryContent || attachment.visibleTextExcerpt || attachment.summary || "none",
    "readableBlocks:",
    readableBlocks,
    "visualEvidence:",
    visualEvidence,
    "screenshotRefs:",
    screenshotRefs,
    "ocrTextSupplements:",
    ocrTextSupplements,
    "annotations:",
    annotations,
    "visibleTextExcerpt:",
    attachment.visibleTextExcerpt || attachment.summary || "none",
    "codeCandidates:",
    candidates,
    "diagnostics:",
    diagnostics,
    "noiseDiagnostics:",
    noiseDiagnostics,
    `privacy.omittedKinds: ${attachment.privacy.omittedKinds.join(", ")}`,
    `privacy.redactedKinds: ${attachment.privacy.redactedKinds.join(", ") || "none"}`,
    "</browser_context_v2>",
  ].join("\n");
}

export function parseBrowserContextPrompt(
  text: string,
): ParsedBrowserContextPromptAttachment | null {
  const match =
    text.match(/<browser_context_v2>\n([\s\S]*?)\n<\/browser_context_v2>/) ??
    text.match(/<browser_context>\n([\s\S]*?)\n<\/browser_context>/);
  if (!match) {
    return null;
  }
  const block = match[1] ?? "";
  const readLine = (key: string) => {
    const line = block.split("\n").find((entry) => entry.startsWith(`${key}: `));
    return line ? line.slice(key.length + 2).trim() : "";
  };
  const readSection = (key: string, nextKeys: string[]) => {
    const start = `${key}:\n`;
    const startIndex = block.indexOf(start);
    if (startIndex < 0) {
      return "";
    }
    const contentStart = startIndex + start.length;
    const rest = block.slice(contentStart);
    const endIndex = nextKeys
      .map((nextKey) => rest.indexOf(`\n${nextKey}:`))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0];
    return (endIndex === undefined ? rest : rest.slice(0, endIndex)).trim();
  };
  const url = readLine("url");
  if (!url) {
    return null;
  }
  const capturedAt = Date.parse(readLine("capturedAt"));
  const summaryText = readSection("summary", ["primaryContent", "visibleTextExcerpt", "privacy.omittedKinds"]);
  const primaryContentText = readSection("primaryContent", ["readableBlocks", "visibleTextExcerpt", "privacy.omittedKinds"]);
  const visibleText = readSection("visibleTextExcerpt", ["codeCandidates", "privacy.omittedKinds"]);
  const readableBlocksText = readSection("readableBlocks", ["visualEvidence", "visibleTextExcerpt"]);
  const visualEvidenceText = readSection("visualEvidence", ["screenshotRefs", "annotations", "visibleTextExcerpt", "codeCandidates"]);
  const screenshotRefsText = readSection("screenshotRefs", ["ocrTextSupplements", "annotations", "visibleTextExcerpt", "codeCandidates"]);
  const ocrTextSupplementsText = readSection("ocrTextSupplements", ["annotations", "visibleTextExcerpt", "codeCandidates"]);
  const annotationsText = readSection("annotations", ["visibleTextExcerpt", "codeCandidates"]);
  const candidatesText = readSection("codeCandidates", ["diagnostics", "privacy.omittedKinds"]);
  const noiseDiagnosticsText = readSection("noiseDiagnostics", ["privacy.omittedKinds", "privacy.redactedKinds"]);
  const readableBlocks = readableBlocksText === "none"
    ? []
    : readableBlocksText
      .split("\n")
      .map((line, index) => {
        const matchLine = line.match(/^- block \d+ \(([^,]+), score=(-?\d+), truncated=(true|false)\): ([\s\S]*)$/);
        if (!matchLine) {
          return null;
        }
        return {
          blockId: `parsed-readable-${index + 1}`,
          role: matchLine[1] as BrowserReadableBlock["role"],
          text: matchLine[4] ?? "",
          score: Number.parseInt(matchLine[2] ?? "0", 10),
          truncated: matchLine[3] === "true",
        };
      })
      .filter((entry): entry is BrowserReadableBlock => Boolean(entry));
  const visualEvidence = visualEvidenceText === "none"
    ? []
    : visualEvidenceText
      .split("\n")
      .flatMap((line, index): BrowserVisualEvidence[] => {
        const matchLine = line.match(/^- visual \d+ \(([^,]+), sensitive=(true|false)\): ([\s\S]*)$/);
        if (!matchLine) {
          return [];
        }
        const payload = matchLine[3] ?? "";
        const markers = ["; alt=", "; origin=", "; nearby="] as const;
        const markerPositions = markers
          .map((marker) => ({ marker, index: payload.indexOf(marker) }))
          .filter((entry) => entry.index >= 0)
          .sort((left, right) => left.index - right.index);
        const labelEnd = markerPositions[0]?.index ?? payload.length;
        const readMarkerValue = (marker: typeof markers[number]) => {
          const current = markerPositions.find((entry) => entry.marker === marker);
          if (!current) {
            return "";
          }
          const next = markerPositions.find((entry) => entry.index > current.index);
          const valueStart = current.index + marker.length;
          const valueEnd = next?.index ?? payload.length;
          return payload.slice(valueStart, valueEnd).trim();
        };
        return [{
          evidenceId: `parsed-visual-${index + 1}`,
          kind: matchLine[1] as BrowserVisualEvidence["kind"],
          label: payload.slice(0, labelEnd).trim(),
          altText: readMarkerValue("; alt=") || null,
          srcOrigin: readMarkerValue("; origin=") || null,
          nearbyText: readMarkerValue("; nearby=") || null,
          visible: true,
          sensitive: matchLine[2] === "true",
        }];
      });
  const screenshotRefs = screenshotRefsText === "none"
    ? []
    : screenshotRefsText
      .split("\n")
      .flatMap((line, index): BrowserScreenshotReference[] => {
        const matchLine = line.match(/^- screenshotRef \d+: ref=([^;]+); storage=([^;]+); modelPayloadAllowed=(true|false)$/);
        if (!matchLine) {
          return [];
        }
        return [{
          refId: matchLine[1] ?? `parsed-screenshot-ref-${index + 1}`,
          browserSessionId: "parsed-browser-session",
          snapshotId: "parsed-browser-snapshot",
          capturedAt: Number.isFinite(capturedAt) ? capturedAt : Date.now(),
          kind: "thumbnail_reference",
          storage: matchLine[2] === "ephemeral_ref" ? "ephemeral_ref" : "metadata_only",
          modelPayloadAllowed: matchLine[3] === "true",
          diagnostic: null,
        }];
      });
  const ocrTextSupplements = ocrTextSupplementsText === "none"
    ? []
    : ocrTextSupplementsText
      .split("\n")
      .flatMap((line, index): BrowserOcrTextSupplement[] => {
        const matchLine = line.match(/^- ocrText \d+: ref=([^;]+); screenshotRef=([^;]+); truncated=(true|false); modelPayloadAllowed=(true|false); text=([\s\S]*)$/);
        if (!matchLine) {
          return [];
        }
        const text = matchLine[5] ?? "";
        return [{
          refId: matchLine[1] ?? `parsed-ocr-${index + 1}`,
          screenshotRefId: matchLine[2] ?? "",
          text,
          capturedAt: Number.isFinite(capturedAt) ? capturedAt : Date.now(),
          charBudget: text.length,
          truncated: matchLine[3] === "true",
          redactedKinds: [],
          modelPayloadAllowed: matchLine[4] === "true",
        }];
      });
  const codeCandidates = candidatesText === "none"
    ? []
    : candidatesText
      .split("\n")
      .flatMap((line, index): BrowserCodeCandidate[] => {
        const matchLine = line.match(/^- (.+?) \(([^,]+), ([^)]+)\)(?:: ([\s\S]*))?$/);
        if (!matchLine) {
          return [];
        }
        return [{
          candidateId: `parsed-candidate-${index + 1}`,
          filePath: matchLine[1] ?? "",
          reason: matchLine[2] as BrowserCodeCandidate["reason"],
          confidence: matchLine[3] as BrowserCodeCandidate["confidence"],
          matchedText: matchLine[4] ?? null,
          sourceEvidence: matchLine[4] ? [matchLine[4]] : [],
          explanation: "Parsed from browser context prompt code candidate evidence.",
          openAction: matchLine[1] && !matchLine[1].includes("*")
            ? {
                kind: "open_file",
                filePath: matchLine[1],
              }
            : null,
        }];
      });
  const annotations = annotationsText === "none"
    ? []
    : annotationsText
      .split("\n")
      .flatMap((line, index): NonNullable<BrowserContextAttachment["annotations"]> => {
        const matchLine = line.match(/^- annotation \d+ \(([^,]+), staleReasons=([^)]+)\): ([\s\S]*)$/);
        if (!matchLine) {
          return [];
        }
        const anchor = matchLine[1] as NonNullable<BrowserContextAttachment["annotations"]>[number]["anchor"];
        const staleReasons = (matchLine[2] ?? "")
          .split(",")
          .map((reason) => reason.trim())
          .filter((reason) => reason && reason !== "none") as BrowserObservationStaleReason[];
        return [{
          annotationId: `parsed-annotation-${index + 1}`,
          observationId: "parsed-browser-observation",
          browserSessionId: "parsed-browser-session",
          workspaceId: "parsed-workspace",
          createdAt: Number.isFinite(capturedAt) ? capturedAt : Date.now(),
          url,
          title: readLine("source") || url,
          anchor,
          userNote: matchLine[3] ?? "",
          viewport: {
            width: null,
            height: null,
            scrollX: null,
            scrollY: null,
            devicePixelRatio: null,
          },
          region: null,
          nearbyText: null,
          nearestElement: null,
          privacy: {
            redactionApplied: false,
            redactedKinds: [],
            omittedKinds: [],
          },
          staleReasons,
          diagnostics: [],
        }];
      });
  const noiseDiagnostics = noiseDiagnosticsText === "none"
    ? []
    : noiseDiagnosticsText
      .split("\n")
      .map((line, index) => {
        const matchLine = line.match(/^- (info|warning): ([^\s]+) score=(-?\d+); ([\s\S]*)$/);
        if (!matchLine) {
          return null;
        }
        return {
          diagnosticId: `parsed-noise-${index + 1}`,
          severity: matchLine[1] as BrowserNoiseDiagnostic["severity"],
          kind: matchLine[2] as BrowserNoiseDiagnostic["kind"],
          score: Number.parseInt(matchLine[3] ?? "0", 10),
          message: matchLine[4] ?? "",
        };
      })
      .filter((entry): entry is BrowserNoiseDiagnostic => Boolean(entry));
  const countsText = readLine("counts");
  const countFor = (key: string) => {
    const matchCount = countsText.match(new RegExp(`${key}=(-?\\d+)`));
    return Number.parseInt(matchCount?.[1] ?? "0", 10);
  };
  const state = readLine("freshness") || readLine("state");
  const observationState = readLine("observation.state") as BrowserObservationState;
  const observationStaleReasons = readLine("observation.staleReasons")
    .split(",")
    .map((reason) => reason.trim())
    .filter((reason) => reason && reason !== "none") as BrowserObservationStaleReason[];
  const observationTransport = readLine("observation.transport") as BrowserObservationTransport;
  const observationRendererBinding = readLine("observation.rendererBinding") as BrowserObservationRendererBinding;
  return {
    title: readLine("source") || url,
    url,
    capturedAt: Number.isFinite(capturedAt) ? capturedAt : Date.now(),
    stale: state === "stale" || state === "expired" || state === "degraded",
    freshness: (state as BrowserSnapshotFreshness) || undefined,
    observation: observationState
      ? {
          schemaVersion: 1,
          observationId: "parsed-browser-observation",
          browserSessionId: "parsed-browser-session",
          workspaceId: "parsed-workspace",
          capturedAt: Number.isFinite(capturedAt) ? capturedAt : Date.now(),
          state: observationState,
          staleReasons: observationStaleReasons,
          transport: observationTransport || "unavailable",
          rendererBinding: observationRendererBinding || "unavailable",
          source: {
            url,
            normalizedUrl: url,
            origin: null,
            title: readLine("source") || url,
            tabLabel: readLine("source") || url,
            workspaceLocalAllowed: false,
          },
          budget: {
            charLimit: 0,
            visibleTextLimit: 0,
            elementLimit: 0,
            formFieldLimit: 0,
            diagnosticLimit: 0,
            tokenEstimate: null,
            truncated: readLine("budget.truncated") === "true",
            omittedElementCount: countFor("omittedElementCount"),
          },
          privacy: {
            redactionApplied: false,
            redactedKinds: [],
            omittedKinds: [],
          },
          diagnostics: [],
          omittedCapabilities: [],
        }
      : undefined,
    summary: summaryText,
    pageType: (readLine("pageType") as BrowserContextAttachment["pageType"]) || "unknown",
    primaryContent: primaryContentText || undefined,
    visibleTextExcerpt: visibleText || undefined,
    readableBlocks,
    visualEvidence,
    screenshotRefs,
    ocrTextSupplements,
    annotations,
    noiseDiagnostics,
    codeCandidates,
    elementCounts: {
      headings: countFor("headings"),
      links: countFor("links"),
      buttons: countFor("buttons"),
      forms: countFor("forms"),
      landmarks: countFor("landmarks"),
      codeCandidates: countFor("codeCandidates") || codeCandidates.length,
      readableBlocks: countFor("readableBlocks") || readableBlocks.length,
      visualEvidence: countFor("visualEvidence") || visualEvidence.length,
      annotations: annotations.length,
    },
  };
}

export function stripBrowserContextPrompt(text: string): string {
  return text
    .replace(/<browser_context_v2>\n[\s\S]*?\n<\/browser_context_v2>\n*/g, "")
    .replace(/<browser_context>\n[\s\S]*?\n<\/browser_context>\n*/g, "")
    .trim();
}

export function formatBrowserContextPromptOnce(
  text: string,
  attachment: BrowserContextPromptAttachment,
): string {
  const strippedText = stripBrowserContextPrompt(text);
  return `${formatBrowserContextPrompt(attachment)}\n\n${strippedText}`.trim();
}
