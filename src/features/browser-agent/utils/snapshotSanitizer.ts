import type {
  BrowserActionTarget,
  BrowserContextSnapshot,
  BrowserDiagnostic,
  BrowserFormSummary,
  BrowserLandmark,
  BrowserNetworkSummary,
  BrowserPrivacyReport,
  BrowserSession,
  BrowserSnapshotBudget,
  BrowserTextNode,
} from "../types";

const SECRET_PATTERNS = [
  /\b(password|passwd|pwd)\b\s*[:=]\s*[^\s,;]+/gi,
  /\b(token|access_token|refresh_token|api[_-]?key|secret)\b\s*[:=]\s*[^\s,;]+/gi,
  /\b(authorization)\b\s*[:=]\s*bearer\s+[^\s,;]+/gi,
  /\b(cookie)\b\s*[:=]\s*[^\n]+/gi,
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g;

export type BrowserSnapshotSanitizationResult = {
  text: string;
  privacy: BrowserPrivacyReport;
};

export type BrowserSnapshotBuilderInput = {
  session: BrowserSession;
  visibleText: string;
  headings?: BrowserTextNode[];
  landmarks?: BrowserLandmark[];
  links?: BrowserActionTarget[];
  buttons?: BrowserActionTarget[];
  forms?: BrowserFormSummary[];
  selectedText?: string | null;
  consoleDiagnostics?: BrowserDiagnostic[];
  network?: BrowserNetworkSummary | null;
  captureWarnings?: BrowserDiagnostic[];
  budget?: Partial<BrowserSnapshotBudget>;
};

function defaultBudget(): BrowserSnapshotBudget {
  return {
    charLimit: 12_000,
    visibleTextLimit: 8_000,
    elementLimit: 120,
    formFieldLimit: 80,
    diagnosticLimit: 50,
    tokenEstimate: null,
  };
}

function createPrivacyReport(): BrowserPrivacyReport {
  return {
    redactionApplied: false,
    redactedKinds: [],
    omittedKinds: ["raw_dom", "cookies", "headers", "scripts", "styles", "hidden_nodes"],
  };
}

function addRedactionKind(
  privacy: BrowserPrivacyReport,
  kind: BrowserPrivacyReport["redactedKinds"][number],
): void {
  privacy.redactionApplied = true;
  if (!privacy.redactedKinds.includes(kind)) {
    privacy.redactedKinds.push(kind);
  }
}

export function sanitizeBrowserSnapshotText(
  value: string,
): BrowserSnapshotSanitizationResult {
  const privacy = createPrivacyReport();
  let text = value;

  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (match) => {
      const key = match.split(/[:=]/)[0]?.trim().toLowerCase() ?? "secret";
      if (key.includes("cookie")) {
        addRedactionKind(privacy, "cookie");
      } else if (key.includes("authorization")) {
        addRedactionKind(privacy, "authorization");
      } else if (key.includes("password") || key.includes("passwd") || key.includes("pwd")) {
        addRedactionKind(privacy, "password");
      } else {
        addRedactionKind(privacy, "token");
      }
      return `${key}: [redacted]`;
    });
  }

  text = text.replace(EMAIL_PATTERN, () => {
    addRedactionKind(privacy, "email");
    return "[redacted-email]";
  });
  text = text.replace(PHONE_PATTERN, () => {
    addRedactionKind(privacy, "phone");
    return "[redacted-phone]";
  });

  return { text, privacy };
}

function mergePrivacyReports(
  base: BrowserPrivacyReport,
  next: BrowserPrivacyReport,
): BrowserPrivacyReport {
  const redactedKinds = [...base.redactedKinds];
  for (const kind of next.redactedKinds) {
    if (!redactedKinds.includes(kind)) {
      redactedKinds.push(kind);
    }
  }
  return {
    redactionApplied: base.redactionApplied || next.redactionApplied,
    redactedKinds,
    omittedKinds: base.omittedKinds,
  };
}

function sanitizeTextNode(node: BrowserTextNode): {
  node: BrowserTextNode;
  privacy: BrowserPrivacyReport;
} {
  const sanitized = sanitizeBrowserSnapshotText(node.text);
  return {
    node: {
      ...node,
      text: sanitized.text,
      truncated: node.truncated,
    },
    privacy: sanitized.privacy,
  };
}

function sanitizeTarget(target: BrowserActionTarget): {
  target: BrowserActionTarget;
  privacy: BrowserPrivacyReport;
} {
  const privacy = createPrivacyReport();
  const sensitive = target.sensitive || target.kind === "input";
  if (!sensitive) {
    return { target, privacy };
  }
  addRedactionKind(privacy, target.kind === "input" ? "hidden_input" : "secret_like");
  return {
    target: {
      ...target,
      valuePreview: target.valuePreview ? "[redacted]" : target.valuePreview,
    },
    privacy,
  };
}

function limitItems<T>(items: T[] | undefined, limit: number): T[] {
  return (items ?? []).slice(0, Math.max(0, limit));
}

export function buildBrowserContextSnapshot(
  input: BrowserSnapshotBuilderInput,
): BrowserContextSnapshot {
  const budget = { ...defaultBudget(), ...input.budget };
  const visibleText = sanitizeBrowserSnapshotText(input.visibleText);
  let privacy = visibleText.privacy;

  const headings = limitItems(input.headings, budget.elementLimit).map((heading) => {
    const sanitized = sanitizeTextNode(heading);
    privacy = mergePrivacyReports(privacy, sanitized.privacy);
    return sanitized.node;
  });

  const sanitizeTargets = (targets: BrowserActionTarget[] | undefined) =>
    limitItems(targets, budget.elementLimit).map((target) => {
      const sanitized = sanitizeTarget(target);
      privacy = mergePrivacyReports(privacy, sanitized.privacy);
      return sanitized.target;
    });

  const forms = limitItems(input.forms, budget.formFieldLimit).map((form) => ({
    ...form,
    fields: sanitizeTargets(form.fields).slice(0, budget.formFieldLimit),
    submitTargets: sanitizeTargets(form.submitTargets),
  }));

  const truncatedText = visibleText.text.length > budget.visibleTextLimit;
  return {
    snapshotId: `browser-snapshot-${Date.now()}`,
    browserSessionId: input.session.browserSessionId,
    workspaceId: input.session.workspaceId,
    capturedAt: Date.now(),
    source: {
      url: input.session.url,
      normalizedUrl: input.session.normalizedUrl,
      title: input.session.title,
      origin: input.session.origin,
    },
    page: {
      visibleText: visibleText.text.slice(0, budget.visibleTextLimit),
      textTruncated: truncatedText,
      headings,
      landmarks: limitItems(input.landmarks, budget.elementLimit),
      links: sanitizeTargets(input.links),
      buttons: sanitizeTargets(input.buttons),
      forms,
      selectedText: input.selectedText ?? null,
    },
    diagnostics: {
      console: limitItems(input.consoleDiagnostics, budget.diagnosticLimit),
      network: input.network ?? null,
      captureWarnings: limitItems(input.captureWarnings, budget.diagnosticLimit),
    },
    evidence: {
      screenshotRef: null,
      htmlExcerptRef: null,
    },
    privacy,
    budget,
    availability: "available",
  };
}
