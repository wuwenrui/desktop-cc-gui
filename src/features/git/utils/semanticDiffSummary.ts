import { countDiffStats, normalizeGitChangePath } from "./gitChangeModel";

export type SemanticDiffConfidence = "high" | "medium" | "low";

export type SemanticDiffSummaryItem = {
  textKey: string;
  evidenceKey: string;
  confidence: SemanticDiffConfidence;
  source?: "rule" | "command" | "ai";
  evidenceRefs?: SemanticEvidenceRef[];
  values?: Record<string, string | number>;
};

export type SemanticDiffSummary = {
  intent: SemanticDiffSummaryItem[];
  behavior: SemanticDiffSummaryItem[];
  risks: SemanticDiffSummaryItem[];
  validation: SemanticDiffSummaryItem[];
  stats: {
    files: number;
    additions: number;
    deletions: number;
  };
};

export type SemanticDiffEntry = {
  path: string;
  status: string;
  diff: string;
  isImage?: boolean;
};

export type SemanticEvidenceRef = {
  type: "file" | "diffHunk" | "command" | "userMessage" | "ai";
  id: string;
  label?: string;
  path?: string;
  line?: number;
  status?: "running" | "completed" | "failed" | "pending";
  commandText?: string;
};

export type TurnValidationEvidence = {
  eventId: string;
  commandText: string;
  status: "running" | "completed" | "failed" | "pending";
  commandDescription?: string;
};

export type TurnSemanticReviewFact = {
  category: "intent" | "behavior" | "risk" | "validation";
  text: string;
  confidence: SemanticDiffConfidence;
  evidenceRefs: SemanticEvidenceRef[];
};

export type TurnSemanticReview = {
  source: "ai";
  generatedAt: number;
  facts: TurnSemanticReviewFact[];
};

export type SemanticDiffSummaryInput = {
  entries: SemanticDiffEntry[];
  validationEvidence?: TurnValidationEvidence[];
  aiReview?: TurnSemanticReview | null;
};

type EntryClassification = {
  source: SemanticDiffEntry[];
  tests: SemanticDiffEntry[];
  specs: SemanticDiffEntry[];
  config: SemanticDiffEntry[];
  deleted: SemanticDiffEntry[];
};

type AddedLine = {
  text: string;
  lineNumber: number;
};

type ValidationCommandKind = "test" | "lint" | "typecheck" | "spec" | "contract" | "largeFiles";

const CODE_EXTENSIONS = new Set([
  "c",
  "cc",
  "cpp",
  "cs",
  "go",
  "java",
  "js",
  "jsx",
  "kt",
  "mjs",
  "py",
  "rs",
  "swift",
  "ts",
  "tsx",
]);

const CONFIG_FILE_NAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "vite.config.ts",
  "tsconfig.json",
  "eslint.config.js",
  ".eslintrc",
  "tauri.conf.json",
  "Cargo.toml",
  "Cargo.lock",
]);

const HTTP_STATUS_CODE_BY_NAME: Record<string, number> = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

function extensionOf(path: string) {
  const leaf = path.split("/").pop() ?? path;
  const index = leaf.lastIndexOf(".");
  return index >= 0 ? leaf.slice(index + 1).toLowerCase() : "";
}

function leafName(path: string) {
  return path.split("/").pop()?.toLowerCase() ?? path.toLowerCase();
}

function includesSegment(path: string, segment: string) {
  return path.split("/").some((part) => part.toLowerCase() === segment);
}

function isTestPath(path: string) {
  const lower = path.toLowerCase();
  return (
    includesSegment(lower, "__tests__") ||
    includesSegment(lower, "tests") ||
    includesSegment(lower, "test") ||
    lower.includes(".test.") ||
    lower.includes(".spec.")
  );
}

function isSpecPath(path: string) {
  const lower = path.toLowerCase();
  return (
    lower.startsWith("openspec/") ||
    lower.startsWith(".trellis/spec/") ||
    lower.includes("/specs/") ||
    lower.endsWith("/spec.md")
  );
}

function isConfigPath(path: string) {
  const lower = path.toLowerCase();
  return (
    CONFIG_FILE_NAMES.has(leafName(lower)) ||
    lower.startsWith(".github/") ||
    lower.startsWith("scripts/") ||
    lower.includes("/capabilities/") ||
    lower.endsWith(".json") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".toml")
  );
}

function isSourcePath(path: string) {
  return CODE_EXTENSIONS.has(extensionOf(path));
}

function classifyEntries(entries: SemanticDiffEntry[]): EntryClassification {
  const classification: EntryClassification = {
    source: [],
    tests: [],
    specs: [],
    config: [],
    deleted: [],
  };

  for (const entry of entries) {
    const path = normalizeGitChangePath(entry.path);
    if (isSourcePath(path)) {
      classification.source.push(entry);
    }
    if (isTestPath(path)) {
      classification.tests.push(entry);
    }
    if (isSpecPath(path)) {
      classification.specs.push(entry);
    }
    if (isConfigPath(path)) {
      classification.config.push(entry);
    }
    if (entry.status.toUpperCase().startsWith("D")) {
      classification.deleted.push(entry);
    }
  }

  return classification;
}

function pushUnique(
  target: SemanticDiffSummaryItem[],
  item: SemanticDiffSummaryItem,
) {
  if (
    target.some(
      (existing) =>
        existing.textKey === item.textKey &&
        JSON.stringify(existing.values ?? {}) === JSON.stringify(item.values ?? {}),
    )
  ) {
    return;
  }
  target.push(item);
}

function countStats(entries: SemanticDiffEntry[]) {
  let additions = 0;
  let deletions = 0;
  for (const entry of entries) {
    const stats = countDiffStats(entry.diff);
    additions += stats.additions;
    deletions += stats.deletions;
  }
  return {
    files: entries.length,
    additions,
    deletions,
  };
}

function extractAddedLines(diff: string): AddedLine[] {
  const result: AddedLine[] = [];
  let newLine = 0;
  for (const rawLine of diff.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    if (rawLine.startsWith("@@")) {
      const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(rawLine);
      newLine = match ? Number(match[1]) : newLine;
      continue;
    }
    if (rawLine.startsWith("+++")) {
      continue;
    }
    if (rawLine.startsWith("+")) {
      result.push({ text: rawLine.slice(1).trim(), lineNumber: newLine });
      newLine += 1;
      continue;
    }
    if (rawLine.startsWith("-") || rawLine.startsWith("---")) {
      continue;
    }
    if (rawLine.startsWith(" ")) {
      newLine += 1;
    }
  }
  return result.filter((line) => line.text.length > 0);
}

function compactCode(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function simpleClassName(raw: string) {
  const normalized = raw.replace(/\.class\b/g, "").trim();
  return normalized.split(".").pop() ?? normalized;
}

function findNextMethodName(lines: AddedLine[], startIndex: number) {
  const candidates = lines.slice(startIndex + 1, startIndex + 8);
  for (const line of candidates) {
    const match = /\b(?:public|protected|private)\s+(?:static\s+)?[\w<>, ?.[\]]+\s+(\w+)\s*\(/.exec(
      line.text,
    );
    if (match) {
      return match[1];
    }
  }
  return null;
}

function extractHttpStatus(lines: AddedLine[], startIndex: number) {
  const block = lines
    .slice(startIndex, startIndex + 24)
    .map((line) => line.text)
    .join(" ");
  const statusMatch = /HttpStatus\.([A-Z_]+)/.exec(block);
  if (statusMatch) {
    const name = statusMatch[1];
    return {
      statusName: name,
      statusCode: HTTP_STATUS_CODE_BY_NAME[name] ?? null,
    };
  }
  const numericMatch = /\.status\((\d{3})\)/.exec(block);
  if (numericMatch) {
    return {
      statusName: numericMatch[1],
      statusCode: Number(numericMatch[1]),
    };
  }
  return {
    statusName: null,
    statusCode: null,
  };
}

function extractApiResponseErrorCode(lines: AddedLine[], startIndex: number) {
  const block = lines
    .slice(startIndex, startIndex + 24)
    .map((line) => line.text)
    .join(" ");
  const match = /ApiResponse\.(?:<[^>]+>)?error\(\s*(\d{3})/.exec(block);
  return match ? Number(match[1]) : null;
}

function evidencePath(path: string, lineNumber?: number) {
  return lineNumber ? `${path}:${lineNumber}` : path;
}

function fileEvidenceRef(path: string): SemanticEvidenceRef {
  return {
    type: "file",
    id: normalizeGitChangePath(path),
    path: normalizeGitChangePath(path),
  };
}

function hunkEvidenceRef(path: string, lineNumber: number): SemanticEvidenceRef {
  return {
    type: "diffHunk",
    id: `${normalizeGitChangePath(path)}:${lineNumber}`,
    path: normalizeGitChangePath(path),
    line: lineNumber,
  };
}

function commandEvidenceRef(evidence: TurnValidationEvidence): SemanticEvidenceRef {
  return {
    type: "command",
    id: evidence.eventId,
    label: evidence.commandDescription || evidence.commandText,
    status: evidence.status,
    commandText: evidence.commandText,
  };
}

function classifyValidationCommand(commandText: string): ValidationCommandKind | null {
  const normalized = commandText.toLowerCase();
  if (
    /\bopenspec\s+validate\b/.test(normalized) ||
    normalized.includes("doctor:strict")
  ) {
    return "spec";
  }
  if (
    normalized.includes("check:runtime-contracts") ||
    normalized.includes("check:heavy-test-noise")
  ) {
    return "contract";
  }
  if (normalized.includes("check:large-files")) {
    return "largeFiles";
  }
  if (
    /\b(?:vitest|jest|pytest)\b/.test(normalized) ||
    /\bnpm\s+(?:run\s+)?test\b/.test(normalized) ||
    /\bpnpm\s+(?:run\s+)?test\b/.test(normalized) ||
    /\byarn\s+test\b/.test(normalized) ||
    /\bcargo\s+test\b/.test(normalized) ||
    /\bgo\s+test\b/.test(normalized) ||
    /\bmvn\s+test\b/.test(normalized) ||
    /\bgradle\s+test\b/.test(normalized)
  ) {
    return "test";
  }
  if (/\b(?:eslint|npm\s+run\s+lint|pnpm\s+run\s+lint|yarn\s+lint)\b/.test(normalized)) {
    return "lint";
  }
  if (
    /\b(?:tsc|vue-tsc)\b/.test(normalized) ||
    normalized.includes("typecheck") ||
    normalized.includes("type-check")
  ) {
    return "typecheck";
  }
  return null;
}

function validationKindLabel(kind: ValidationCommandKind) {
  switch (kind) {
    case "test":
      return "test";
    case "lint":
      return "lint";
    case "typecheck":
      return "typecheck";
    case "spec":
      return "spec";
    case "contract":
      return "contract";
    case "largeFiles":
      return "large-file";
  }
}

function extractSpringFacts(
  entry: SemanticDiffEntry,
  lines: AddedLine[],
  summary: SemanticDiffSummary,
) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const handlerMatch = /@ExceptionHandler\(\s*([^)]+?)\s*\)/.exec(line.text);
    if (!handlerMatch) {
      continue;
    }
    const exception = simpleClassName(handlerMatch[1]);
    const method = findNextMethodName(lines, index) ?? "handler";
    const httpStatus = extractHttpStatus(lines, index);
    const apiErrorCode = extractApiResponseErrorCode(lines, index);
    const statusLabel = httpStatus.statusCode
      ? `${httpStatus.statusCode} ${httpStatus.statusName ?? ""}`.trim()
      : httpStatus.statusName ?? "unknown";

    pushUnique(summary.intent, {
      textKey: "git.semanticDiff.intent.springExceptionHandler",
      evidenceKey: "git.semanticDiff.evidence.pathLine",
      confidence: "high",
      values: {
        exception,
        method,
        evidence: evidencePath(entry.path, line.lineNumber),
      },
      source: "rule",
      evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
    });
    if (httpStatus.statusName || httpStatus.statusCode) {
      pushUnique(summary.behavior, {
        textKey: "git.semanticDiff.behavior.springExceptionStatus",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "high",
        values: {
          exception,
          method,
          status: statusLabel,
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
    }
    if (apiErrorCode != null) {
      pushUnique(summary.behavior, {
        textKey: "git.semanticDiff.behavior.apiResponseError",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "high",
        values: {
          method,
          code: apiErrorCode,
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
    }
    pushUnique(summary.risks, {
      textKey: "git.semanticDiff.risk.exceptionContract",
      evidenceKey: "git.semanticDiff.evidence.pathLine",
      confidence: "medium",
      values: {
        exception,
        evidence: evidencePath(entry.path, line.lineNumber),
      },
      source: "rule",
      evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
    });
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const mappingMatch = /@(Get|Post|Put|Delete|Patch)Mapping(?:\(([^)]*)\))?/.exec(
      line.text,
    );
    if (!mappingMatch) {
      continue;
    }
    const method = findNextMethodName(lines, index) ?? "handler";
    pushUnique(summary.intent, {
      textKey: "git.semanticDiff.intent.springEndpoint",
      evidenceKey: "git.semanticDiff.evidence.pathLine",
      confidence: "high",
      values: {
        httpMethod: mappingMatch[1].toUpperCase(),
        route: compactCode(mappingMatch[2] ?? ""),
        method,
        evidence: evidencePath(entry.path, line.lineNumber),
      },
      source: "rule",
      evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
    });
  }
}

function extractDeclarationFacts(
  entry: SemanticDiffEntry,
  lines: AddedLine[],
  summary: SemanticDiffSummary,
) {
  for (const line of lines) {
    const javaDeclaration = /\b(public|protected|private)\s+(?:static\s+)?(?:final\s+)?(?:class|interface|enum|record)\s+(\w+)/.exec(
      line.text,
    );
    if (javaDeclaration) {
      pushUnique(summary.intent, {
        textKey: "git.semanticDiff.intent.declaration",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "high",
        values: {
          symbol: javaDeclaration[2],
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
      continue;
    }

    const tsExport = /^\s*export\s+(?:type|interface|class|function|const|enum)\s+(\w+)/.exec(
      line.text,
    );
    if (tsExport) {
      pushUnique(summary.intent, {
        textKey: "git.semanticDiff.intent.export",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "high",
        values: {
          symbol: tsExport[1],
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
    }
  }
}

function extractTypeScriptReactFacts(
  entry: SemanticDiffEntry,
  lines: AddedLine[],
  summary: SemanticDiffSummary,
) {
  const ext = extensionOf(entry.path);
  if (ext !== "ts" && ext !== "tsx" && ext !== "js" && ext !== "jsx") {
    return;
  }
  for (const line of lines) {
    const componentMatch =
      /(?:export\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/.exec(line.text) ||
      /(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/.exec(line.text);
    if (componentMatch && ext.includes("x")) {
      pushUnique(summary.intent, {
        textKey: "git.semanticDiff.intent.reactComponent",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "high",
        values: {
          component: componentMatch[1],
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
    }

    const hookMatch =
      /(?:export\s+)?function\s+(use[A-Z][A-Za-z0-9_]*)\s*\(/.exec(line.text) ||
      /(?:export\s+)?const\s+(use[A-Z][A-Za-z0-9_]*)\s*[:=]/.exec(line.text);
    if (hookMatch) {
      pushUnique(summary.intent, {
        textKey: "git.semanticDiff.intent.reactHook",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "high",
        values: {
          hook: hookMatch[1],
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
    }

    const stateMatch = /const\s+\[\s*([A-Za-z_$][\w$]*)\s*,\s*set[A-Za-z_$][\w$]*\s*\]\s*=\s*useState\b/.exec(
      line.text,
    );
    if (stateMatch) {
      pushUnique(summary.behavior, {
        textKey: "git.semanticDiff.behavior.reactState",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "medium",
        values: {
          state: stateMatch[1],
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
    }

    const handlerMatch = /\b(?:const|function)\s+(handle[A-Z][A-Za-z0-9_]*)\b/.exec(line.text);
    if (handlerMatch) {
      pushUnique(summary.behavior, {
        textKey: "git.semanticDiff.behavior.eventHandler",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "medium",
        values: {
          handler: handlerMatch[1],
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
    }
  }
}

function extractTestFacts(
  entry: SemanticDiffEntry,
  lines: AddedLine[],
  summary: SemanticDiffSummary,
) {
  if (!isTestPath(entry.path)) {
    return;
  }
  for (const line of lines) {
    const testMatch = /\b(?:it|test)\(\s*['"`]([^'"`]+)['"`]/.exec(line.text);
    if (testMatch) {
      pushUnique(summary.validation, {
        textKey: "git.semanticDiff.validation.testCase",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "medium",
        values: {
          name: testMatch[1],
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
    }
    if (/\bexpect\(|\bassert\.|\bassert\(/.test(line.text)) {
      pushUnique(summary.validation, {
        textKey: "git.semanticDiff.validation.assertion",
        evidenceKey: "git.semanticDiff.evidence.pathLine",
        confidence: "medium",
        values: {
          evidence: evidencePath(entry.path, line.lineNumber),
        },
        source: "rule",
        evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
      });
    }
  }
}

function extractConfigFacts(
  entry: SemanticDiffEntry,
  lines: AddedLine[],
  summary: SemanticDiffSummary,
) {
  if (!isConfigPath(entry.path)) {
    return;
  }
  for (const line of lines) {
    const keyMatch = /^\s*["']?([A-Za-z0-9_.:-]+)["']?\s*[:=]/.exec(line.text);
    if (!keyMatch) {
      continue;
    }
    pushUnique(summary.behavior, {
      textKey: "git.semanticDiff.behavior.configKey",
      evidenceKey: "git.semanticDiff.evidence.pathLine",
      confidence: "medium",
      values: {
        key: keyMatch[1],
        evidence: evidencePath(entry.path, line.lineNumber),
      },
      source: "rule",
      evidenceRefs: [hunkEvidenceRef(entry.path, line.lineNumber)],
    });
  }
}

function addConcreteFacts(entries: SemanticDiffEntry[], summary: SemanticDiffSummary) {
  for (const entry of entries) {
    const lines = extractAddedLines(entry.diff);
    if (lines.length === 0) {
      continue;
    }
    if (extensionOf(entry.path) === "java") {
      extractSpringFacts(entry, lines, summary);
    }
    extractDeclarationFacts(entry, lines, summary);
    extractTypeScriptReactFacts(entry, lines, summary);
    extractTestFacts(entry, lines, summary);
    extractConfigFacts(entry, lines, summary);
  }
}

function addValidationCommandEvidence(
  evidence: TurnValidationEvidence[] | undefined,
  summary: SemanticDiffSummary,
) {
  const validationEvidence = evidence?.filter((entry) => classifyValidationCommand(entry.commandText)) ?? [];
  for (const entry of validationEvidence) {
    const kind = classifyValidationCommand(entry.commandText);
    if (!kind) {
      continue;
    }
    const values = {
      kind: validationKindLabel(kind),
      command: entry.commandDescription || entry.commandText,
    };
    if (entry.status === "failed") {
      pushUnique(summary.validation, {
        textKey: "git.semanticDiff.validation.commandFailed",
        evidenceKey: "git.semanticDiff.evidence.command",
        confidence: "high",
        values,
        source: "command",
        evidenceRefs: [commandEvidenceRef(entry)],
      });
      pushUnique(summary.risks, {
        textKey: "git.semanticDiff.risk.validationFailed",
        evidenceKey: "git.semanticDiff.evidence.command",
        confidence: "high",
        values,
        source: "command",
        evidenceRefs: [commandEvidenceRef(entry)],
      });
      continue;
    }
    if (entry.status === "completed") {
      pushUnique(summary.validation, {
        textKey: "git.semanticDiff.validation.commandPassed",
        evidenceKey: "git.semanticDiff.evidence.command",
        confidence: "high",
        values,
        source: "command",
        evidenceRefs: [commandEvidenceRef(entry)],
      });
      continue;
    }
    pushUnique(summary.validation, {
      textKey: "git.semanticDiff.validation.commandObserved",
      evidenceKey: "git.semanticDiff.evidence.command",
      confidence: "medium",
      values,
      source: "command",
      evidenceRefs: [commandEvidenceRef(entry)],
    });
  }
}

function addAiReviewFacts(aiReview: TurnSemanticReview | null | undefined, summary: SemanticDiffSummary) {
  if (!aiReview) {
    return;
  }
  for (const fact of aiReview.facts) {
    if (!fact.evidenceRefs.length) {
      continue;
    }
    const target = summary[fact.category === "risk" ? "risks" : fact.category];
    pushUnique(target, {
      textKey: "git.semanticDiff.ai.fact",
      evidenceKey: "git.semanticDiff.evidence.ai",
      confidence: fact.confidence,
      values: { text: fact.text },
      source: "ai",
      evidenceRefs: fact.evidenceRefs,
    });
  }
}

export function buildSemanticDiffSummary(
  input: SemanticDiffEntry[] | SemanticDiffSummaryInput,
): SemanticDiffSummary {
  const rawEntries = Array.isArray(input) ? input : input.entries;
  const entries = rawEntries
    .map((entry) => ({
      ...entry,
      path: normalizeGitChangePath(entry.path),
      status: entry.status.trim().toUpperCase(),
    }))
    .filter((entry) => entry.path);
  const classification = classifyEntries(entries);
  const stats = countStats(entries);
  const summary: SemanticDiffSummary = {
    intent: [],
    behavior: [],
    risks: [],
    validation: [],
    stats,
  };

  addConcreteFacts(entries, summary);
  addValidationCommandEvidence(Array.isArray(input) ? undefined : input.validationEvidence, summary);
  addAiReviewFacts(Array.isArray(input) ? null : input.aiReview, summary);

  if (classification.deleted.length > 0) {
    pushUnique(summary.behavior, {
      textKey: "git.semanticDiff.behavior.deleted",
      evidenceKey: "git.semanticDiff.evidence.deleted",
      confidence: "high",
      values: { count: classification.deleted.length },
      source: "rule",
      evidenceRefs: classification.deleted.map((entry) => fileEvidenceRef(entry.path)),
    });
  }

  if (classification.config.length > 0) {
    pushUnique(summary.risks, {
      textKey: "git.semanticDiff.risk.config",
      evidenceKey: "git.semanticDiff.evidence.config",
      confidence: "medium",
      values: { count: classification.config.length },
      source: "rule",
      evidenceRefs: classification.config.map((entry) => fileEvidenceRef(entry.path)),
    });
  }
  if (classification.deleted.length > 0) {
    pushUnique(summary.risks, {
      textKey: "git.semanticDiff.risk.deleted",
      evidenceKey: "git.semanticDiff.evidence.deleted",
      confidence: "high",
      values: { count: classification.deleted.length },
      source: "rule",
      evidenceRefs: classification.deleted.map((entry) => fileEvidenceRef(entry.path)),
    });
  }
  if (classification.source.length > 0 && classification.tests.length === 0) {
    pushUnique(summary.risks, {
      textKey: "git.semanticDiff.risk.noTests",
      evidenceKey: "git.semanticDiff.evidence.noTests",
      confidence: "medium",
      source: "rule",
      evidenceRefs: classification.source.map((entry) => fileEvidenceRef(entry.path)),
    });
  }
  if (stats.files >= 8 || stats.additions + stats.deletions >= 500) {
    pushUnique(summary.risks, {
      textKey: "git.semanticDiff.risk.largeChange",
      evidenceKey: "git.semanticDiff.evidence.lineStats",
      confidence: "medium",
      values: {
        files: stats.files,
        additions: stats.additions,
        deletions: stats.deletions,
      },
      source: "rule",
      evidenceRefs: entries.map((entry) => fileEvidenceRef(entry.path)),
    });
  }

  if (classification.tests.length > 0) {
    pushUnique(summary.validation, {
      textKey: "git.semanticDiff.validation.testFiles",
      evidenceKey: "git.semanticDiff.evidence.tests",
      confidence: "medium",
      values: { count: classification.tests.length },
      source: "rule",
      evidenceRefs: classification.tests.map((entry) => fileEvidenceRef(entry.path)),
    });
  }
  if (classification.specs.length > 0) {
    pushUnique(summary.validation, {
      textKey: "git.semanticDiff.validation.specFiles",
      evidenceKey: "git.semanticDiff.evidence.spec",
      confidence: "medium",
      values: { count: classification.specs.length },
      source: "rule",
      evidenceRefs: classification.specs.map((entry) => fileEvidenceRef(entry.path)),
    });
  }
  if (!summary.validation.some((item) => item.source === "command")) {
    pushUnique(summary.validation, {
      textKey: "git.semanticDiff.validation.notConnected",
      evidenceKey: "git.semanticDiff.evidence.validationNotConnected",
      confidence: "high",
      source: "rule",
    });
  }

  if (summary.intent.length === 0) {
    pushUnique(summary.intent, {
      textKey: "git.semanticDiff.intent.noConcreteFacts",
      evidenceKey: "git.semanticDiff.evidence.files",
      confidence: "low",
      values: { count: entries.length },
      source: "rule",
      evidenceRefs: entries.map((entry) => fileEvidenceRef(entry.path)),
    });
  }
  if (summary.behavior.length === 0) {
    pushUnique(summary.behavior, {
      textKey: "git.semanticDiff.behavior.requiresLineReview",
      evidenceKey: "git.semanticDiff.evidence.lineStats",
      confidence: "low",
      values: {
        files: stats.files,
        additions: stats.additions,
        deletions: stats.deletions,
      },
      source: "rule",
      evidenceRefs: entries.map((entry) => fileEvidenceRef(entry.path)),
    });
  }
  if (summary.risks.length === 0) {
    pushUnique(summary.risks, {
      textKey: "git.semanticDiff.risk.reviewEvidence",
      evidenceKey: "git.semanticDiff.evidence.files",
      confidence: "low",
      values: { count: entries.length },
      source: "rule",
      evidenceRefs: entries.map((entry) => fileEvidenceRef(entry.path)),
    });
  }

  return summary;
}
