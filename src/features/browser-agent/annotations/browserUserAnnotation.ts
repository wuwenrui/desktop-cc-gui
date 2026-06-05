import type {
  BrowserObservation,
  BrowserObservationDiagnostic,
  BrowserObservationStaleReason,
  BrowserUserAnnotation,
  BrowserUserAnnotationAnchorType,
  BrowserUserAnnotationNearestElement,
  BrowserUserAnnotationRegion,
  BrowserViewportState,
} from "../types";
import { sanitizeBrowserSnapshotText } from "../utils/snapshotSanitizer";

export type BrowserUserAnnotationInput = {
  annotationId: string;
  observation: BrowserObservation;
  createdAt: number;
  anchor: BrowserUserAnnotationAnchorType;
  userNote: string;
  viewport: Pick<
    BrowserViewportState,
    "width" | "height" | "scrollX" | "scrollY" | "devicePixelRatio"
  >;
  region?: BrowserUserAnnotationRegion | null;
  nearbyText?: string | null;
  nearestElement?: BrowserUserAnnotationNearestElement | null;
};

export type BrowserUserAnnotationContext = {
  observation: BrowserObservation;
  activeUrl?: string | null;
  activeTitle?: string | null;
  activeBrowserSessionId?: string | null;
  activeWorkspaceId?: string | null;
  now?: number;
  ttlMs?: number;
};

const DEFAULT_ANNOTATION_TTL_MS = 5 * 60 * 1000;

function mergeStaleReasons(
  left: BrowserObservationStaleReason[],
  right: BrowserObservationStaleReason[],
): BrowserObservationStaleReason[] {
  return Array.from(new Set([...left, ...right]));
}

function sanitizeAnnotationText(value: string | null | undefined) {
  const sanitized = sanitizeBrowserSnapshotText(value);
  return {
    text: sanitized.text.trim() || null,
    privacy: sanitized.privacy,
  };
}

function hrefOriginFor(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function sanitizeNearestElement(
  element: BrowserUserAnnotationNearestElement | null | undefined,
): BrowserUserAnnotationNearestElement | null {
  if (!element) {
    return null;
  }
  return {
    role: sanitizeAnnotationText(element.role).text ?? "unknown",
    label: sanitizeAnnotationText(element.label).text,
    placeholder: sanitizeAnnotationText(element.placeholder).text,
    hrefOrigin: hrefOriginFor(element.hrefOrigin),
    selectorHint: sanitizeAnnotationText(element.selectorHint).text,
    sensitive: element.sensitive,
  };
}

export function reconcileBrowserUserAnnotationStaleReasons(
  annotation: BrowserUserAnnotation,
  context: BrowserUserAnnotationContext,
): BrowserObservationStaleReason[] {
  const reasons: BrowserObservationStaleReason[] = [];
  const now = context.now ?? Date.now();
  const ttlMs = context.ttlMs ?? DEFAULT_ANNOTATION_TTL_MS;
  if (context.observation.observationId !== annotation.observationId) {
    reasons.push("dom_fingerprint_changed");
  }
  if (context.activeBrowserSessionId && context.activeBrowserSessionId !== annotation.browserSessionId) {
    reasons.push("active_tab_changed");
  }
  if (context.activeWorkspaceId && context.activeWorkspaceId !== annotation.workspaceId) {
    reasons.push("workspace_mismatch");
  }
  if (context.activeUrl && context.activeUrl !== annotation.url) {
    reasons.push("url_changed");
  }
  if (
    context.activeTitle !== undefined &&
    context.activeTitle !== null &&
    context.activeTitle !== annotation.title
  ) {
    reasons.push("title_changed");
  }
  if (now - annotation.createdAt > ttlMs) {
    reasons.push("ttl_expired");
  }
  return mergeStaleReasons(
    mergeStaleReasons(annotation.staleReasons, context.observation.staleReasons),
    reasons,
  );
}

export function buildBrowserUserAnnotation(
  input: BrowserUserAnnotationInput,
): BrowserUserAnnotation {
  const sanitizedNote = sanitizeAnnotationText(input.userNote);
  const sanitizedNearbyText = sanitizeAnnotationText(input.nearbyText);
  const nearestElement = sanitizeNearestElement(input.nearestElement);
  const redactedKinds = Array.from(new Set([
    ...sanitizedNote.privacy.redactedKinds,
    ...sanitizedNearbyText.privacy.redactedKinds,
  ]));
  const privacy = {
    redactionApplied: redactedKinds.length > 0,
    redactedKinds,
    omittedKinds: input.observation.privacy.omittedKinds,
  };

  return {
    annotationId: input.annotationId,
    observationId: input.observation.observationId,
    browserSessionId: input.observation.browserSessionId,
    workspaceId: input.observation.workspaceId,
    createdAt: input.createdAt,
    url: input.observation.source.normalizedUrl,
    title: input.observation.source.title,
    anchor: input.anchor,
    userNote: sanitizedNote.text ?? "",
    viewport: input.viewport,
    region: input.region ?? null,
    nearbyText: sanitizedNearbyText.text,
    nearestElement,
    privacy,
    staleReasons: input.observation.staleReasons,
    diagnostics: input.observation.diagnostics,
  };
}

export function formatBrowserUserAnnotationEvidence(
  annotation: BrowserUserAnnotation,
): string {
  const region = annotation.region
    ? `x=${annotation.region.x} y=${annotation.region.y} w=${annotation.region.width} h=${annotation.region.height}`
    : "none";
  const nearestElement = annotation.nearestElement
    ? `${annotation.nearestElement.role} "${annotation.nearestElement.label ?? "unlabeled"}"`
    : "none";
  return [
    "User annotation:",
    `- note: ${annotation.userNote || "none"}`,
    `- anchor: ${annotation.anchor}`,
    `- region: ${region}`,
    `- nearest element: ${nearestElement}`,
    `- nearby text: ${annotation.nearbyText ?? "none"}`,
    `- stale reasons: ${annotation.staleReasons.join(", ") || "none"}`,
  ].join("\n");
}

export function buildAnnotatedVisualEvidenceBlockedDiagnostic(
  annotationId: string,
): BrowserObservationDiagnostic {
  return {
    diagnosticId: `annotation-visual-blocked-${annotationId}`,
    severity: "info",
    userMessage: "Annotated screenshots are not sent by default in Browser Dock Phase 3.",
    aiMessage:
      "Annotated screenshot/image payload is blocked by default; use structured annotation text evidence only.",
  };
}
