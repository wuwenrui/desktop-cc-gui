export type BrowserAgentFeaturePhase =
  | "disabled"
  | "read_only_snapshot"
  | "safe_navigation"
  | "targeted_element_actions"
  | "form_submit"
  | "full_agent";

export type BrowserSessionStatus =
  | "idle"
  | "loading"
  | "ready"
  | "blocked"
  | "failed"
  | "closed"
  | "unsupported";

export type BrowserCapabilityState = "supported" | "degraded" | "unsupported";

export type BrowserPlatformCapability = {
  platform: "macos" | "windows" | "linux" | "unsupported";
  webviewRuntime: "wkwebview" | "webview2" | "webkitgtk" | "unknown";
  browserDock: BrowserCapabilityState;
  snapshotCapture: BrowserCapabilityState;
  screenshotCapture: BrowserCapabilityState;
  navigationActions: BrowserCapabilityState;
  elementActions: BrowserCapabilityState;
  formSubmitActions: BrowserCapabilityState;
  diagnosticsCapture: BrowserCapabilityState;
  unsupportedReasons: string[];
  degradedReasons: string[];
};

export type BrowserAgentSettings = {
  enabled: boolean;
  preferForAiBrowserOperations: boolean;
  allowReadOnlySnapshots: boolean;
  allowNavigationActions: boolean;
  allowElementActions: boolean;
  allowFormSubmitActions: boolean;
  allowExternalProviderFallback: boolean;
  defaultSnapshotBudgetChars: number;
  evidenceRetentionDays: number;
  platformWarningsAcknowledged: Record<string, boolean>;
};

export type BrowserSession = {
  browserSessionId: string;
  workspaceId: string;
  label: string;
  url: string;
  normalizedUrl: string;
  origin: string | null;
  title: string | null;
  faviconRef?: string | null;
  status: BrowserSessionStatus;
  featurePhase: BrowserAgentFeaturePhase;
  platformCapability: BrowserPlatformCapability;
  linkedThreadId?: string | null;
  linkedTaskRunId?: string | null;
  linkedOrchestrationTaskId?: string | null;
  lastSnapshotId?: string | null;
  lastActionId?: string | null;
  errorCode?: string | null;
  diagnosticMessage?: string | null;
  createdAt: number;
  updatedAt: number;
  lastActivatedAt: number;
  closedAt?: number | null;
};

export type BrowserUrlValidationResult = {
  rawUrl: string;
  normalizedUrl: string | null;
  allowed: boolean;
  blockedReason: string | null;
  diagnostic: BrowserDiagnostic | null;
};

export type CreateBrowserSessionRequest = {
  workspaceId: string;
  url: string;
  ownerSurface: string;
};

export type UpdateBrowserSessionRequest = {
  browserSessionId: string;
  status?: BrowserSessionStatus | null;
  title?: string | null;
  url?: string | null;
  lastSnapshotId?: string | null;
  lastActionId?: string | null;
  errorCode?: string | null;
  diagnosticMessage?: string | null;
};

export type BrowserSessionCleanupResult = {
  removedSessionIds: string[];
  retainedSessionCount: number;
};

export type BrowserWebviewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserWebviewMountRequest = {
  browserSessionId: string;
  bounds: BrowserWebviewBounds;
};

export type BrowserWebviewEvent = {
  browserSessionId: string;
  label: string;
  url: string | null;
  title: string | null;
  status: BrowserSessionStatus;
  occurredAt: number;
  errorCode?: string | null;
  diagnosticMessage?: string | null;
};

export type BrowserSnapshotBudget = {
  charLimit: number;
  visibleTextLimit: number;
  elementLimit: number;
  formFieldLimit: number;
  diagnosticLimit: number;
  tokenEstimate?: number | null;
};

export type BrowserTextNode = {
  targetId: string;
  role:
    | "heading"
    | "paragraph"
    | "list_item"
    | "label"
    | "code"
    | "table_cell"
    | "other";
  level?: number | null;
  text: string;
  truncated: boolean;
};

export type BrowserElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserActionTarget = {
  targetId: string;
  kind:
    | "link"
    | "button"
    | "input"
    | "textarea"
    | "select"
    | "checkbox"
    | "radio"
    | "submit"
    | "other";
  label: string;
  accessibleName?: string | null;
  text?: string | null;
  href?: string | null;
  placeholder?: string | null;
  valuePreview?: string | null;
  disabled: boolean;
  visible: boolean;
  sensitive: boolean;
  bounds?: BrowserElementBounds | null;
};

export type BrowserFormSummary = {
  formId: string;
  label: string;
  method?: string | null;
  actionOrigin?: string | null;
  fields: BrowserActionTarget[];
  submitTargets: BrowserActionTarget[];
  sensitive: boolean;
};

export type BrowserLandmark = {
  targetId: string;
  role:
    | "main"
    | "navigation"
    | "search"
    | "form"
    | "banner"
    | "contentinfo"
    | "dialog"
    | "region";
  label: string;
  textPreview?: string | null;
};

export type BrowserDiagnostic = {
  diagnosticId: string;
  kind:
    | "console_error"
    | "console_warning"
    | "network_error"
    | "security_warning"
    | "capture_warning";
  severity: "info" | "warning" | "error";
  message: string;
  source?: string | null;
  redacted: boolean;
};

export type BrowserNetworkSummary = {
  requestCount: number;
  failedRequestCount: number;
  blockedRequestCount: number;
  mainDocumentStatus?: number | null;
  slowRequestCount?: number | null;
  redacted: boolean;
};

export type BrowserPrivacyReport = {
  redactionApplied: boolean;
  redactedKinds: Array<
    | "password"
    | "token"
    | "cookie"
    | "authorization"
    | "hidden_input"
    | "email"
    | "phone"
    | "secret_like"
    | "unknown"
  >;
  omittedKinds: Array<
    "raw_dom" | "cookies" | "headers" | "scripts" | "styles" | "hidden_nodes"
  >;
};

export type BrowserContextSnapshot = {
  snapshotId: string;
  browserSessionId: string;
  workspaceId: string;
  capturedAt: number;
  source: {
    url: string;
    normalizedUrl: string;
    title: string | null;
    origin: string | null;
  };
  page: {
    visibleText: string;
    textTruncated: boolean;
    headings: BrowserTextNode[];
    landmarks: BrowserLandmark[];
    links: BrowserActionTarget[];
    buttons: BrowserActionTarget[];
    forms: BrowserFormSummary[];
    selectedText?: string | null;
  };
  diagnostics: {
    console: BrowserDiagnostic[];
    network: BrowserNetworkSummary | null;
    captureWarnings: BrowserDiagnostic[];
  };
  evidence: {
    screenshotRef?: string | null;
    htmlExcerptRef?: string | null;
  };
  privacy: BrowserPrivacyReport;
  budget: BrowserSnapshotBudget;
  availability: "available" | "partial" | "expired" | "deleted" | "unsupported";
};

export type BrowserContextAttachment = {
  kind: "browser_snapshot";
  attachmentId: string;
  browserSessionId: string;
  snapshotId: string;
  workspaceId: string;
  title: string | null;
  url: string;
  capturedAt: number;
  stale: boolean;
  summary: string;
  privacy: BrowserPrivacyReport;
};

export type BrowserActionRequest = {
  browserSessionId: string;
  action:
    | "navigate"
    | "reload"
    | "scroll"
    | "click"
    | "type"
    | "select"
    | "submit";
  targetId?: string | null;
  value?: string | null;
  reason: string;
  requestedBy: "user" | "ai" | "task_run";
};

export type BrowserActionAuditEntry = {
  actionId: string;
  browserSessionId: string;
  requestedAt: number;
  completedAt?: number | null;
  action: BrowserActionRequest["action"];
  targetDescription?: string | null;
  outcome: "completed" | "blocked" | "failed" | "canceled";
  diagnosticMessage?: string | null;
  beforeSnapshotId?: string | null;
  afterSnapshotId?: string | null;
};

export type BrowserActionPreview = {
  action: BrowserActionRequest["action"];
  targetId?: string | null;
  targetDescription?: string | null;
  valuePreview?: string | null;
  reason: string;
  requiresUserConfirmation: boolean;
  blockedByDefault: boolean;
};

export type BrowserActionResult = {
  outcome: BrowserActionAuditEntry["outcome"];
  auditEntry: BrowserActionAuditEntry;
  preview?: BrowserActionPreview | null;
};

export type BrowserEvidenceRecord = {
  evidenceId: string;
  browserSessionId: string;
  snapshotId: string;
  workspaceId: string;
  url: string;
  title: string | null;
  capturedAt: number;
  expiresAt: number;
  state: "available" | "expired" | "deleted" | "unsupported";
  summary: string;
  privacy: BrowserPrivacyReport;
};

export type BrowserEvidenceCleanupResult = {
  removedEvidenceIds: string[];
  retainedEvidenceCount: number;
};

export type BrowserProviderRouteDecision = {
  requestedCapability:
    | "read_snapshot"
    | "navigate"
    | "reload"
    | "scroll"
    | "click"
    | "type"
    | "submit"
    | "full_agent_task";
  selectedProvider:
    | "built_in_browser_agent"
    | "browser_skill"
    | "computer_use"
    | "external_cdp"
    | "none";
  reason: string;
  userOverride: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string | null;
};

export type BrowserAgentStatus = {
  settings: BrowserAgentSettings;
  featurePhase: BrowserAgentFeaturePhase;
  platformCapability: BrowserPlatformCapability;
  providerPreference: BrowserProviderRouteDecision;
};
