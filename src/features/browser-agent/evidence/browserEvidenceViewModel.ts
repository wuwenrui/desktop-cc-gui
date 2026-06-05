import type {
  BrowserContextAttachment,
  BrowserDiagnostic,
  BrowserNoiseDiagnostic,
  BrowserPrivacyReport,
  BrowserSnapshotBudget,
  BrowserObservationState,
} from "../types";
import type { TaskRunBrowserEvidenceRef } from "../../tasks/types";

export type BrowserEvidenceSectionState = BrowserObservationState | "empty";

export type BrowserEvidenceViewModelSection = {
  sectionId: string;
  title: string;
  state: BrowserEvidenceSectionState;
  items: string[];
  truncated: boolean;
  copySafeText: string;
  emptyReason: string | null;
};

export type BrowserEvidenceViewModel = {
  observationState: BrowserObservationState;
  staleReasons: BrowserContextAttachment["observation"]["staleReasons"];
  overview: BrowserEvidenceViewModelSection;
  primaryContent: BrowserEvidenceViewModelSection;
  readableBlocks: BrowserEvidenceViewModelSection;
  interactiveElements: BrowserEvidenceViewModelSection;
  visualEvidence: BrowserEvidenceViewModelSection;
  annotations: BrowserEvidenceViewModelSection;
  codeCandidates: BrowserEvidenceViewModelSection;
  diagnostics: BrowserEvidenceViewModelSection;
  privacyBudget: BrowserEvidenceViewModelSection;
};

type BrowserEvidenceAttachmentLike = Pick<
  BrowserContextAttachment,
  "title" | "url" | "capturedAt" | "stale" | "summary"
> & {
  visibleTextExcerpt?: BrowserContextAttachment["visibleTextExcerpt"];
  elementCounts?: BrowserContextAttachment["elementCounts"];
  observation?: BrowserContextAttachment["observation"];
  pageType?: BrowserContextAttachment["pageType"];
  primaryContent?: BrowserContextAttachment["primaryContent"];
  readableBlocks?: BrowserContextAttachment["readableBlocks"];
  noiseDiagnostics?: BrowserNoiseDiagnostic[];
  visualEvidence?: BrowserContextAttachment["visualEvidence"];
  screenshotRefs?: BrowserContextAttachment["screenshotRefs"];
  ocrTextSupplements?: BrowserContextAttachment["ocrTextSupplements"];
  annotations?: BrowserContextAttachment["annotations"];
  diagnostics?: Array<Pick<BrowserDiagnostic, "severity" | "message">>;
  budget?: Partial<BrowserSnapshotBudget>;
  codeCandidates?: BrowserContextAttachment["codeCandidates"];
  privacy?: {
    redactionApplied?: boolean;
    redactedKinds: string[];
    omittedKinds: string[];
  };
};

const EMPTY_REASON_NONE_CAPTURED = "No browser evidence captured for this section.";

function compactEvidenceText(value: string, limit = 700): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function buildSection(
  sectionId: string,
  title: string,
  state: BrowserObservationState,
  items: string[],
  truncated = false,
  emptyReason = EMPTY_REASON_NONE_CAPTURED,
): BrowserEvidenceViewModelSection {
  const boundedItems = items.map((item) => compactEvidenceText(item));
  return {
    sectionId,
    title,
    state: boundedItems.length > 0 ? state : "empty",
    items: boundedItems,
    truncated,
    copySafeText: boundedItems.join("\n"),
    emptyReason: boundedItems.length > 0 ? null : emptyReason,
  };
}

export function buildBrowserEvidenceViewModel(
  attachment: BrowserEvidenceAttachmentLike,
): BrowserEvidenceViewModel {
  const observationState = attachment.observation?.state ?? (attachment.stale ? "stale" : "available");
  const staleReasons = attachment.observation?.staleReasons ?? [];
  const elementCounts = attachment.elementCounts ?? {
    headings: 0,
    links: 0,
    buttons: 0,
    forms: 0,
    landmarks: 0,
    codeCandidates: attachment.codeCandidates?.length ?? 0,
    readableBlocks: attachment.readableBlocks?.length ?? 0,
    visualEvidence: attachment.visualEvidence?.length ?? 0,
    annotations: attachment.annotations?.length ?? 0,
  };
  const budget = attachment.budget ?? {
    charLimit: 0,
    visibleTextLimit: 0,
    elementLimit: 0,
    formFieldLimit: 0,
    diagnosticLimit: 0,
    tokenEstimate: null,
    truncated: false,
    omittedElementCount: 0,
  };
  const privacy = attachment.privacy ?? {
    redactionApplied: false,
    redactedKinds: [],
    omittedKinds: [],
  };
  const overviewItems = [
    `${attachment.title || attachment.url}`,
    `URL: ${attachment.url}`,
    `Observation: ${observationState}`,
    staleReasons.length > 0
      ? `Stale reasons: ${staleReasons.join(", ")}`
      : "Stale reasons: none",
  ];
  const interactiveItems = [
    `Headings: ${elementCounts.headings}`,
    `Links: ${elementCounts.links}`,
    `Buttons: ${elementCounts.buttons}`,
    `Forms: ${elementCounts.forms}`,
    `Landmarks: ${elementCounts.landmarks}`,
  ];
  const visualItems = (attachment.visualEvidence ?? []).map((item) =>
    [
      `${item.kind}: ${item.label}`,
      item.altText ? `alt=${item.altText}` : "",
      item.srcOrigin ? `origin=${item.srcOrigin}` : "",
      item.nearbyText ? `nearby=${item.nearbyText}` : "",
    ].filter(Boolean).join("; "),
  );
  const screenshotItems = (attachment.screenshotRefs ?? []).map((item) =>
    `screenshotRef: ${item.refId}; storage=${item.storage}; modelPayloadAllowed=${item.modelPayloadAllowed}`,
  );
  const ocrItems = (attachment.ocrTextSupplements ?? []).map((item) =>
    `ocrText: ${item.text}; screenshotRef=${item.screenshotRefId}; truncated=${item.truncated}; modelPayloadAllowed=${item.modelPayloadAllowed}`,
  );
  const annotationItems = (attachment.annotations ?? []).map((annotation) =>
    [
      `${annotation.anchor}: ${annotation.userNote || "none"}`,
      annotation.region
        ? `region=${annotation.region.x},${annotation.region.y},${annotation.region.width},${annotation.region.height}`
        : "",
      annotation.nearbyText ? `nearby=${annotation.nearbyText}` : "",
      annotation.nearestElement
        ? `nearest=${annotation.nearestElement.role}:${annotation.nearestElement.label ?? "unlabeled"}`
        : "",
      annotation.staleReasons.length > 0
        ? `stale=${annotation.staleReasons.join(",")}`
        : "stale=none",
    ].filter(Boolean).join("; "),
  );
  const diagnosticItems = [
    ...(attachment.observation?.diagnostics ?? []).map(
      (diagnostic) => `${diagnostic.severity}: ${diagnostic.userMessage}`,
    ),
    ...(attachment.diagnostics ?? []).map(
      (diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`,
    ),
    ...(attachment.noiseDiagnostics ?? []).map(
      (diagnostic) => `${diagnostic.severity}: ${diagnostic.kind}; ${diagnostic.message}`,
    ),
  ];
  const privacyBudgetItems = [
    `Transport: ${attachment.observation?.transport ?? "unavailable"}`,
    `Renderer binding: ${attachment.observation?.rendererBinding ?? "unavailable"}`,
    `Budget truncated: ${budget.truncated}`,
    `Omitted elements: ${budget.omittedElementCount}`,
    `Redacted kinds: ${privacy.redactedKinds.join(", ") || "none"}`,
    `Omitted kinds: ${privacy.omittedKinds.join(", ") || "none"}`,
    `Omitted capabilities: ${attachment.observation?.omittedCapabilities.join(", ") || "none"}`,
  ];

  return {
    observationState,
    staleReasons,
    overview: buildSection("overview", "Overview", observationState, overviewItems),
    primaryContent: buildSection(
      "primaryContent",
      "Primary content",
      observationState,
      attachment.primaryContent || attachment.visibleTextExcerpt || attachment.summary
        ? [attachment.primaryContent || attachment.visibleTextExcerpt || attachment.summary]
        : [],
      budget.truncated,
    ),
    readableBlocks: buildSection(
      "readableBlocks",
      "Readable blocks",
      observationState,
      (attachment.readableBlocks ?? []).map(
        (block) => `${block.role} score=${block.score}: ${block.text}`,
      ),
      (attachment.readableBlocks ?? []).some((block) => block.truncated),
    ),
    interactiveElements: buildSection(
      "interactiveElements",
      "Interactive elements",
      observationState,
      interactiveItems,
    ),
    visualEvidence: buildSection(
      "visualEvidence",
      "Visual evidence",
      observationState,
      [...visualItems, ...screenshotItems, ...ocrItems],
    ),
    annotations: buildSection(
      "annotations",
      "User annotations",
      observationState,
      annotationItems,
    ),
    codeCandidates: buildSection(
      "codeCandidates",
      "Code candidates",
      observationState,
      (attachment.codeCandidates ?? []).map(
        (candidate) =>
          `${candidate.filePath} (${candidate.reason}, ${candidate.confidence})${candidate.matchedText ? `: ${candidate.matchedText}` : ""}${candidate.explanation ? `; ${candidate.explanation}` : ""}`,
      ),
    ),
    diagnostics: buildSection(
      "diagnostics",
      "Diagnostics",
      observationState,
      diagnosticItems,
    ),
    privacyBudget: buildSection(
      "privacyBudget",
      "Privacy and budget",
      observationState,
      privacyBudgetItems,
      budget.truncated,
    ),
  };
}

export function buildBrowserEvidenceCopyText(
  viewModel: BrowserEvidenceViewModel,
  sectionId?: keyof BrowserEvidenceViewModel,
): string {
  const section = sectionId ? viewModel[sectionId] : null;
  if (section && typeof section === "object" && "copySafeText" in section) {
    return section.copySafeText;
  }
  return [
    viewModel.overview.copySafeText,
    viewModel.primaryContent.copySafeText,
    viewModel.readableBlocks.copySafeText,
    viewModel.interactiveElements.copySafeText,
    viewModel.visualEvidence.copySafeText,
    viewModel.annotations.copySafeText,
    viewModel.codeCandidates.copySafeText,
    viewModel.diagnostics.copySafeText,
    viewModel.privacyBudget.copySafeText,
  ]
    .filter((value) => value.trim().length > 0)
    .join("\n\n");
}

export function buildBrowserEvidenceViewModelFromTaskRunEvidence(
  evidence: TaskRunBrowserEvidenceRef,
): BrowserEvidenceViewModel {
  const redactedKinds = (evidence.redactedKinds ?? []).filter(
    (kind): kind is BrowserPrivacyReport["redactedKinds"][number] =>
      kind === "password" ||
      kind === "token" ||
      kind === "cookie" ||
      kind === "authorization" ||
      kind === "hidden_input" ||
      kind === "email" ||
      kind === "phone" ||
      kind === "secret_like" ||
      kind === "unknown",
  );
  return buildBrowserEvidenceViewModel({
    title: evidence.title ?? evidence.url,
    url: evidence.url,
    capturedAt: evidence.capturedAt,
    stale: evidence.state !== "available",
    summary: evidence.summary ?? evidence.url,
    visibleTextExcerpt: evidence.summary ?? evidence.url,
    observation: {
      schemaVersion: 1,
      observationId: evidence.attachmentId,
      browserSessionId: evidence.browserSessionId,
      workspaceId: "task-run",
      capturedAt: evidence.capturedAt,
      state: evidence.state === "deleted" ? "unsupported" : evidence.state,
      staleReasons: evidence.state === "available" ? [] : ["capture_degraded"],
      transport: "metadata_fallback",
      rendererBinding: "unavailable",
      source: {
        url: evidence.url,
        normalizedUrl: evidence.url,
        origin: null,
        title: evidence.title ?? null,
        tabLabel: evidence.title ?? evidence.url,
        workspaceLocalAllowed: false,
      },
      budget: {
        charLimit: 0,
        visibleTextLimit: 0,
        elementLimit: 0,
        formFieldLimit: 0,
        diagnosticLimit: evidence.diagnostics?.length ?? 0,
        tokenEstimate: null,
        truncated: false,
        omittedElementCount: 0,
      },
      privacy: {
        redactionApplied: redactedKinds.length > 0,
        redactedKinds,
        omittedKinds: [],
      },
      diagnostics: (evidence.diagnostics ?? []).map((message, index) => ({
        diagnosticId: `task-run-browser-evidence-${index + 1}`,
        severity: "warning",
        userMessage: message,
        aiMessage: message,
      })),
      omittedCapabilities: [],
    },
    codeCandidates: evidence.codeCandidates?.map((candidate, index) => ({
      candidateId: `task-run-candidate-${index + 1}`,
      filePath: candidate.filePath,
      symbolName: null,
      reason: candidate.reason,
      confidence: candidate.confidence,
      matchedText: candidate.matchedText ?? null,
      sourceEvidence: candidate.sourceEvidence ?? [],
      explanation: candidate.explanation,
      openAction: candidate.openAction ?? null,
    })),
    privacy: {
      redactionApplied: redactedKinds.length > 0,
      redactedKinds,
      omittedKinds: [],
    },
    diagnostics: (evidence.diagnostics ?? []).map((message, index) => ({
      diagnosticId: `task-run-browser-diagnostic-${index + 1}`,
      severity: "warning",
      message,
    })),
  });
}
