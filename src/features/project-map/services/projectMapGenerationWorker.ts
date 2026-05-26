import {
  archiveThread,
  engineSendMessageSync,
  getWorkspaceFiles,
  readWorkspaceFile,
  sendUserMessage,
  startThread,
} from "../../../services/tauri";
import { subscribeAppServerEvents, type Unsubscribe } from "../../../services/events";
import type { AppServerEvent } from "../../../types";
import type { EngineType } from "../../../types";
import type {
  ProjectMapDataset,
  ProjectMapGenerationScope,
  ProjectMapLens,
  ProjectMapNode,
  ProjectMapProfile,
  ProjectMapRunMetadata,
  ProjectMapSource,
} from "../types";

export type ProjectMapRunUpdate = Partial<
  Pick<ProjectMapRunMetadata, "status" | "phase" | "progress" | "threadId" | "error">
> & {
  log?: string;
};

type ProjectMapGenerationWorkerInput = {
  workspaceId: string;
  dataset: ProjectMapDataset;
  run: ProjectMapRunMetadata;
  onRunUpdate: (update: ProjectMapRunUpdate) => Promise<void>;
};

type WorkspaceEvidenceSnippet = {
  path: string;
  content: string;
  truncated: boolean;
  hash: string;
  originalChars: number;
};

type ProjectMapAiPayload = {
  profile?: ProjectMapProfile;
  lenses?: ProjectMapLens[];
  nodes?: ProjectMapNode[];
};

type CodexTurnWaiter = {
  promise: Promise<string>;
  cancel: () => void;
};

const MAX_CONTEXT_FILES = 24;
const MAX_EVIDENCE_PROMPT_CHARS = 52_000;
const MAX_EVIDENCE_FILE_CHARS = 5_000;
const MIN_EVIDENCE_FILE_CHARS = 900;
const FILE_HEADER_PROMPT_OVERHEAD = 140;
const MAX_SAFE_ID_LENGTH = 64;
const SUPPORTED_ENGINES: EngineType[] = ["codex", "claude", "gemini", "opencode"];

const IMPORTANT_FILE_NAMES = new Set([
  "package.json",
  "pnpm-workspace.yaml",
  "vite.config.ts",
  "tsconfig.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "settings.gradle",
  "CMakeLists.txt",
  "Makefile",
  "README.md",
  "AGENTS.md",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".toml",
  ".yaml",
  ".yml",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cs",
  ".swift",
  ".sql",
]);

const EXCLUDED_PATH_SEGMENTS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  ".next",
  ".nuxt",
  "coverage",
  ".ccgui",
  ".venv",
  "venv",
  "__pycache__",
  ".idea",
]);

const WINDOWS_RESERVED_PATH_SEGMENTS = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEngine(value: string): EngineType {
  return SUPPORTED_ENGINES.includes(value as EngineType) ? (value as EngineType) : "codex";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractThreadIdFromResponse(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const result = isRecord(value.result) ? value.result : null;
  const thread = isRecord(value.thread) ? value.thread : null;
  const resultThread = result && isRecord(result.thread) ? result.thread : null;
  const candidates = [
    value.threadId,
    value.thread_id,
    result?.threadId,
    result?.thread_id,
    thread?.id,
    resultThread?.id,
  ];
  for (const candidate of candidates) {
    const threadId = asTrimmedString(candidate);
    if (threadId) {
      return threadId;
    }
  }
  return null;
}

function extractThreadIdFromAppServerMessage(message: Record<string, unknown>): string {
  const params = isRecord(message.params) ? message.params : {};
  const turn = isRecord(params.turn) ? params.turn : {};
  const candidates = [
    params.threadId,
    params.thread_id,
    turn.threadId,
    turn.thread_id,
    isRecord(params.thread) ? params.thread.id : null,
  ];
  for (const candidate of candidates) {
    const threadId = asTrimmedString(candidate);
    if (threadId) {
      return threadId;
    }
  }
  return "";
}

function extractTextFromCodexContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(extractTextFromCodexContent).join("");
  }
  if (!isRecord(value)) {
    return "";
  }
  return (
    asTrimmedString(value.text) ||
    asTrimmedString(value.output_text) ||
    asTrimmedString(value.outputText) ||
    asTrimmedString(value.summary) ||
    extractTextFromCodexContent(value.content) ||
    extractTextFromCodexContent(value.parts) ||
    extractTextFromCodexContent(value.output)
  );
}

function extractCodexSnapshotText(item: unknown): string {
  if (!isRecord(item)) {
    return "";
  }
  const itemType = asTrimmedString(item.type);
  const role = asTrimmedString(item.role);
  const isAssistantMessage =
    itemType === "agentMessage" ||
    (role === "assistant" && (itemType === "message" || itemType === "assistant_message"));
  return isAssistantMessage ? extractTextFromCodexContent(item) : "";
}

function extractCodexTurnCompletedText(params: Record<string, unknown>): string {
  const directText =
    asTrimmedString(params.text) ||
    asTrimmedString(params.output_text) ||
    asTrimmedString(params.outputText) ||
    asTrimmedString(params.content) ||
    asTrimmedString(params.summary);
  if (directText) {
    return directText;
  }
  return (
    extractTextFromCodexContent(params.result) ||
    extractTextFromCodexContent(params.output) ||
    extractTextFromCodexContent(params.turn)
  ).trim();
}

function createCodexTurnWaiter(input: {
  workspaceId: string;
  threadId: string;
  timeoutMs: number;
}): CodexTurnWaiter {
  let finished = false;
  let unlisten: Unsubscribe = () => {};
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  const promise = new Promise<string>((resolve, reject) => {
    let responseText = "";
    const finish = (handler: () => void) => {
      if (finished) {
        return;
      }
      finished = true;
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
      unlisten();
      handler();
    };

    timeoutId = globalThis.setTimeout(() => {
      finish(() => reject(new Error("Timeout waiting for Codex response")));
    }, input.timeoutMs);

    unlisten = subscribeAppServerEvents((payload: AppServerEvent) => {
      if (payload.workspace_id !== input.workspaceId) {
        return;
      }
      const message = isRecord(payload.message) ? payload.message : {};
      const method = asTrimmedString(message.method);
      const params = isRecord(message.params) ? message.params : {};
      const threadId = extractThreadIdFromAppServerMessage(message);
      if (threadId !== input.threadId) {
        return;
      }

      if (method === "item/agentMessage/delta") {
        responseText += typeof params.delta === "string" ? params.delta : "";
        return;
      }

      if (method === "item/updated" || method === "item/completed") {
        const snapshotText = extractCodexSnapshotText(params.item);
        if (snapshotText.trim()) {
          responseText = snapshotText;
        }
        return;
      }

      if (method === "turn/error" || method === "error") {
        const errorValue = isRecord(params.error)
          ? asTrimmedString(params.error.message)
          : asTrimmedString(params.error);
        finish(() => reject(new Error(errorValue || "Codex turn failed")));
        return;
      }

      if (method === "turn/completed") {
        const finalText = responseText.trim() || extractCodexTurnCompletedText(params);
        finish(() => {
          if (finalText.trim()) {
            resolve(finalText);
            return;
          }
          reject(new Error("Codex returned empty response"));
        });
      }
    });
  });

  return {
    promise,
    cancel: () => {
      if (finished) {
        return;
      }
      finished = true;
      if (timeoutId) {
        globalThis.clearTimeout(timeoutId);
        timeoutId = null;
      }
      unlisten();
    },
  };
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeProjectMapPathSegment(value: unknown, fallback: string): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, MAX_SAFE_ID_LENGTH)
    .replace(/[._-]+$/g, "");
  const candidate = normalized || fallback;
  return WINDOWS_RESERVED_PATH_SEGMENTS.has(candidate) ? `lens-${candidate}` : candidate;
}

function uniqueProjectMapPathSegment(value: unknown, used: Set<string>, fallback: string): string {
  const base = normalizeProjectMapPathSegment(value, fallback);
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    const suffix = `-${index}`;
    candidate = `${base.slice(0, MAX_SAFE_ID_LENGTH - suffix.length)}${suffix}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function getPathExtension(path: string): string {
  const fileName = path.split("/").pop() ?? path;
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeEvidenceLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function trimAtReadableBoundary(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content.trim();
  }
  const window = content.slice(0, maxChars);
  const paragraphBoundary = window.lastIndexOf("\n\n");
  if (paragraphBoundary >= Math.floor(maxChars * 0.55)) {
    return window.slice(0, paragraphBoundary).trim();
  }
  const lineBoundary = window.lastIndexOf("\n");
  if (lineBoundary >= Math.floor(maxChars * 0.7)) {
    return window.slice(0, lineBoundary).trim();
  }
  const sentenceBoundary = Math.max(
    window.lastIndexOf("。"),
    window.lastIndexOf(". "),
    window.lastIndexOf("；"),
    window.lastIndexOf("; "),
  );
  if (sentenceBoundary >= Math.floor(maxChars * 0.75)) {
    return window.slice(0, sentenceBoundary + 1).trim();
  }
  return window.trimEnd();
}

function extractMarkdownHeadingDigest(content: string, maxChars: number): string {
  const headings = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,6}\s+\S/.test(line))
    .slice(0, 80);
  if (headings.length === 0) {
    return "";
  }
  return trimAtReadableBoundary(headings.join("\n"), maxChars);
}

function allocateEvidenceFileBudget(fileCount: number): number {
  if (fileCount <= 0) {
    return MAX_EVIDENCE_FILE_CHARS;
  }
  const promptOverhead = fileCount * FILE_HEADER_PROMPT_OVERHEAD;
  const availableChars = Math.max(MIN_EVIDENCE_FILE_CHARS, MAX_EVIDENCE_PROMPT_CHARS - promptOverhead);
  return clampNumber(
    Math.floor(availableChars / fileCount),
    MIN_EVIDENCE_FILE_CHARS,
    MAX_EVIDENCE_FILE_CHARS,
  );
}

function normalizeEvidenceContent(input: {
  path: string;
  content: string;
  budgetChars: number;
}): { content: string; truncated: boolean; originalChars: number } {
  const normalized = normalizeEvidenceLineEndings(input.content).trim();
  const originalChars = normalized.length;
  if (originalChars <= input.budgetChars) {
    return { content: normalized, truncated: false, originalChars };
  }

  const marker = `[PROJECT_MAP_TRUNCATED path=${input.path} originalChars=${originalChars} keptChars<=${input.budgetChars}]`;
  const headingDigest =
    getPathExtension(input.path) === ".md"
      ? extractMarkdownHeadingDigest(normalized, Math.min(1_400, Math.floor(input.budgetChars * 0.4)))
      : "";
  const markerBudget = marker.length + 2;
  const digestBlock = headingDigest ? `\n\nMarkdown headings digest:\n${headingDigest}` : "";
  const excerptBudget = Math.max(240, input.budgetChars - markerBudget - digestBlock.length);
  const excerpt = trimAtReadableBoundary(normalized, excerptBudget);

  return {
    content: `${excerpt}\n\n${marker}${digestBlock}`.trim(),
    truncated: true,
    originalChars,
  };
}

function isExcludedPath(path: string): boolean {
  return path
    .split("/")
    .some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment));
}

function isReadableProjectFile(path: string): boolean {
  if (isExcludedPath(path)) {
    return false;
  }
  const fileName = path.split("/").pop() ?? path;
  return IMPORTANT_FILE_NAMES.has(fileName) || TEXT_EXTENSIONS.has(getPathExtension(path));
}

function filePriority(path: string): number {
  const fileName = path.split("/").pop() ?? path;
  if (IMPORTANT_FILE_NAMES.has(fileName)) {
    return 0;
  }
  if (path.startsWith("openspec/") || path.startsWith(".trellis/spec/")) {
    return 1;
  }
  if (path.startsWith("src/") || path.includes("/src/")) {
    return 2;
  }
  if (path.includes("test") || path.includes("spec")) {
    return 3;
  }
  return 4;
}

function pickEvidencePaths(files: string[], requestSources: ProjectMapSource[]): string[] {
  const requestedPaths = requestSources
    .map((source) => source.path?.trim())
    .filter((path): path is string => Boolean(path && isReadableProjectFile(path)));
  const discoveredPaths = files
    .filter(isReadableProjectFile)
    .sort((left, right) => filePriority(left) - filePriority(right) || left.localeCompare(right));

  const paths: string[] = [];
  const seen = new Set<string>();
  for (const path of [...requestedPaths, ...discoveredPaths]) {
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    paths.push(path);
    if (paths.length >= MAX_CONTEXT_FILES) {
      break;
    }
  }
  return paths;
}

async function collectWorkspaceEvidence(input: {
  workspaceId: string;
  requestSources: ProjectMapSource[];
  update: (update: ProjectMapRunUpdate) => Promise<void>;
}): Promise<WorkspaceEvidenceSnippet[]> {
  await input.update({
    phase: "preparingSources",
    progress: 15,
    log: "Scanning workspace files for bounded evidence.",
  });
  const snapshot = await getWorkspaceFiles(input.workspaceId);
  const paths = pickEvidencePaths(snapshot.files, input.requestSources);
  const fileBudgetChars = allocateEvidenceFileBudget(paths.length);
  const snippets: WorkspaceEvidenceSnippet[] = [];

  for (const path of paths) {
    try {
      const response = await readWorkspaceFile(input.workspaceId, path);
      const normalized = normalizeEvidenceContent({
        path,
        content: response.content,
        budgetChars: fileBudgetChars,
      });
      snippets.push({
        path,
        content: normalized.content,
        truncated: response.truncated || normalized.truncated,
        hash: hashText(response.content),
        originalChars: normalized.originalChars,
      });
    } catch {
      // A file can disappear between list and read; the worker continues with the remaining evidence.
    }
  }

  const usedChars = snippets.reduce((total, snippet) => total + snippet.content.length, 0);
  await input.update({
    phase: "preparingSources",
    progress: 25,
    log: `Collected ${snippets.length} normalized evidence files (${usedChars}/${MAX_EVIDENCE_PROMPT_CHARS} chars).`,
  });
  return snippets;
}

function buildPrompt(input: {
  dataset: ProjectMapDataset;
  run: ProjectMapRunMetadata;
  evidence: WorkspaceEvidenceSnippet[];
}): string {
  const requestScope = input.run.requestScope ?? ({ kind: input.run.scope } as ProjectMapGenerationScope);
  const evidenceText = input.evidence
    .map(
      (entry) =>
        [
          `--- FILE ${entry.path} hash=${entry.hash}${entry.truncated ? " truncated=true" : ""} originalChars=${entry.originalChars}`,
          entry.content,
        ].join("\n"),
    )
    .join("\n\n");

  return [
    "你是当前项目的 Project Knowledge Map generator。",
    "目标：基于真实 workspace evidence 生成当前项目的只读知识地图，不要编造。",
    "输出必须是纯 JSON，不要 markdown fence，不要解释。",
    "中文场景下内容尽量中英文结合：中文解释 + English technical terms。",
    "节点 summary 必须短，细节放 detail。",
    "每个确定性节点必须至少引用一个 source，source.path 必须来自 evidence file path。",
    "如果证据不足，把 confidence 设为 unknown 或 low，不要写 high。",
    "Evidence 已经过统一归一化：可能包含 PROJECT_MAP_TRUNCATED marker 和 Markdown headings digest；marker 表示输入被按段落边界压缩，不是原文内容。",
    "",
    "JSON schema:",
    "{",
    '  "profile": { "primaryLanguage": "...", "languages": [], "shapes": [], "frameworks": [], "interfaceKinds": [], "buildSystems": [] },',
    '  "lenses": [{ "id": "overview", "title": "...", "shortTitle": "...", "description": "...", "status": "detected|candidate|notApplicable", "confidence": "high|medium|low|unknown", "evidence": [] }],',
    '  "nodes": [{ "id": "project-core", "lensId": "overview", "nodeKind": "concept", "title": "...", "summary": "...", "detail": { "coreDescription": "...", "keyFacts": [], "keyLogic": [], "riskSignals": [], "relatedArtifacts": [] }, "parentId": null, "children": [], "sources": [], "confidence": "high|medium|low|unknown", "stale": false, "candidate": false }]',
    "}",
    "",
    "Required lenses when applicable: overview, business, modules, api, data, runtime, dependencies, quality, risk, evidence.",
    "Root node must use id project-core and lensId overview.",
    `Run kind: ${input.run.kind}`,
    `Scope: ${JSON.stringify(requestScope)}`,
    `Existing profile: ${JSON.stringify(input.dataset.profile)}`,
    `Existing lens ids: ${input.dataset.lenses.map((lens) => lens.id).join(", ") || "(none)"}`,
    `Existing node ids: ${input.dataset.nodes.map((node) => node.id).join(", ") || "(none)"}`,
    "",
    "Evidence:",
    evidenceText || "(no readable evidence)",
  ].join("\n");
}

async function runCodexThreadTurn(input: {
  workspaceId: string;
  prompt: string;
  model: string;
  update: (update: ProjectMapRunUpdate) => Promise<void>;
}): Promise<string> {
  const threadStart = await startThread(input.workspaceId);
  const threadId = extractThreadIdFromResponse(threadStart);
  if (!threadId) {
    throw new Error("Failed to start Codex project-map thread.");
  }
  await input.update({
    threadId,
    log: `Codex project-map thread started: ${threadId}.`,
  });

  const waiter = createCodexTurnWaiter({
    workspaceId: input.workspaceId,
    threadId,
    timeoutMs: 900_000,
  });
  try {
    await sendUserMessage(input.workspaceId, threadId, input.prompt, {
      model: input.model,
      accessMode: "read-only",
    });
    return await waiter.promise;
  } catch (error) {
    waiter.cancel();
    throw error;
  } finally {
    await archiveThread(input.workspaceId, threadId).catch(() => undefined);
  }
}

async function runAiTurn(input: {
  workspaceId: string;
  run: ProjectMapRunMetadata;
  prompt: string;
  update: (update: ProjectMapRunUpdate) => Promise<void>;
}): Promise<string> {
  const engine = normalizeEngine(input.run.engine);
  const dispatchMode = engine === "codex" ? "thread event" : "sync";
  await input.update({
    phase: "askingAi",
    progress: 35,
    log: `Dispatching ${engine} ${dispatchMode} generation.`,
  });
  let elapsedSeconds = 0;
  const timer = globalThis.setInterval(() => {
    elapsedSeconds += 1;
    if (elapsedSeconds === 1 || elapsedSeconds % 10 === 0) {
      void input.update({
        phase: "askingAi",
        progress: Math.min(72, 42 + elapsedSeconds),
        log: `AI generation still running ${elapsedSeconds}s.`,
      });
    }
  }, 1000);
  try {
    if (engine === "codex") {
      return await runCodexThreadTurn({
        workspaceId: input.workspaceId,
        prompt: input.prompt,
        model: input.run.model,
        update: input.update,
      });
    }

    const generated = await engineSendMessageSync(input.workspaceId, {
      text: input.prompt,
      engine,
      model: input.run.model,
      accessMode: "read-only",
      continueSession: false,
    });
    return generated.text;
  } finally {
    globalThis.clearInterval(timer);
  }
}

function parseJsonPayload(text: string): ProjectMapAiPayload {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI output did not contain a JSON object.");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as ProjectMapAiPayload;
}

function isProjectMapSource(value: unknown): value is ProjectMapSource {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as ProjectMapSource).type === "string" &&
      typeof (value as ProjectMapSource).label === "string",
  );
}

function normalizeSources(sources: unknown, fallback: ProjectMapSource[]): ProjectMapSource[] {
  const items = Array.isArray(sources) ? sources.filter(isProjectMapSource) : [];
  return (items.length > 0 ? items : fallback).slice(0, 12);
}

function createSourceFromEvidence(evidence: WorkspaceEvidenceSnippet): ProjectMapSource {
  return {
    type: "file",
    label: evidence.path.split("/").pop() ?? evidence.path,
    path: evidence.path,
    hash: evidence.hash,
    excerpt: evidence.content.slice(0, 320),
  };
}

function normalizeLens(
  value: ProjectMapLens,
  safeId: string,
  fallbackSources: ProjectMapSource[],
): ProjectMapLens {
  return {
    id: safeId,
    title: String(value.title || value.id || "Overview"),
    shortTitle: String(value.shortTitle || value.title || value.id || "Overview"),
    description: String(value.description || ""),
    status:
      value.status === "candidate" || value.status === "notApplicable" ? value.status : "detected",
    confidence:
      value.confidence === "high" ||
      value.confidence === "medium" ||
      value.confidence === "low" ||
      value.confidence === "unknown"
        ? value.confidence
        : "unknown",
    evidence: normalizeSources(value.evidence, fallbackSources),
  };
}

function normalizeNode(input: {
  node: ProjectMapNode;
  lensIds: Set<string>;
  lensIdByRawId: Map<string, string>;
  fallbackSources: ProjectMapSource[];
  run: ProjectMapRunMetadata;
  now: string;
}): ProjectMapNode | null {
  const id = String(input.node.id || "").trim();
  const title = String(input.node.title || "").trim();
  if (!id || !title) {
    return null;
  }
  const sources = normalizeSources(input.node.sources, input.fallbackSources);
  const confidence =
    input.node.confidence === "high" ||
    input.node.confidence === "medium" ||
    input.node.confidence === "low" ||
    input.node.confidence === "unknown"
      ? input.node.confidence
      : sources.length > 0
        ? "medium"
        : "unknown";

  return {
    id,
    lensId: input.lensIds.has(input.lensIdByRawId.get(String(input.node.lensId)) ?? "")
      ? input.lensIdByRawId.get(String(input.node.lensId))!
      : "overview",
    nodeKind: input.node.nodeKind ?? "concept",
    title,
    summary: String(input.node.summary || title).slice(0, 160),
    detail: {
      coreDescription: String(input.node.detail?.coreDescription || input.node.summary || title),
      keyFacts: Array.isArray(input.node.detail?.keyFacts) ? input.node.detail.keyFacts.slice(0, 8) : [],
      keyLogic: Array.isArray(input.node.detail?.keyLogic) ? input.node.detail.keyLogic.slice(0, 8) : [],
      riskSignals: Array.isArray(input.node.detail?.riskSignals)
        ? input.node.detail.riskSignals.slice(0, 6)
        : [],
      relatedArtifacts: Array.isArray(input.node.detail?.relatedArtifacts)
        ? input.node.detail.relatedArtifacts.slice(0, 10)
        : [],
    },
    parentId: typeof input.node.parentId === "string" ? input.node.parentId : undefined,
    children: Array.isArray(input.node.children) ? input.node.children.filter(Boolean).map(String) : [],
    sources,
    confidence,
    stale: Boolean(input.node.stale),
    candidate: Boolean(input.node.candidate),
    lastGeneratedAt: input.now,
    generatedBy: {
      engine: input.run.engine,
      model: input.run.model,
      runId: input.run.id,
    },
  };
}

function normalizeChildren(nodes: ProjectMapNode[]): ProjectMapNode[] {
  const childIdsByParent = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) {
      continue;
    }
    const children = childIdsByParent.get(node.parentId) ?? [];
    children.push(node.id);
    childIdsByParent.set(node.parentId, children);
  }
  const nodeIds = new Set(nodes.map((node) => node.id));
  return nodes.map((node) => ({
    ...node,
    parentId: node.parentId && nodeIds.has(node.parentId) ? node.parentId : undefined,
    children: Array.from(new Set([...(node.children ?? []), ...(childIdsByParent.get(node.id) ?? [])])).filter(
      (childId) => childId !== node.id && nodeIds.has(childId),
    ),
  }));
}

function collectScopedNodeIds(dataset: ProjectMapDataset, scope: ProjectMapGenerationScope): Set<string> {
  if (scope.kind !== "node") {
    return new Set(dataset.nodes.map((node) => node.id));
  }
  const allowed = new Set<string>([scope.nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of dataset.nodes) {
      if (node.parentId && allowed.has(node.parentId) && !allowed.has(node.id)) {
        allowed.add(node.id);
        changed = true;
      }
    }
  }
  return allowed;
}

function applyAiPayload(input: {
  dataset: ProjectMapDataset;
  payload: ProjectMapAiPayload;
  evidence: WorkspaceEvidenceSnippet[];
  run: ProjectMapRunMetadata;
}): ProjectMapDataset {
  const fallbackSources = input.evidence.slice(0, 4).map(createSourceFromEvidence);
  const rawLenses = Array.isArray(input.payload.lenses) ? input.payload.lenses : [];
  const usedLensIds = new Set<string>();
  const lensIdByRawId = new Map<string, string>();
  const lenses = rawLenses.map((lens, index) => {
    const rawId = String(lens.id || "").trim();
    const safeId = uniqueProjectMapPathSegment(rawId, usedLensIds, `lens-${index + 1}`);
    if (!lensIdByRawId.has(rawId)) {
      lensIdByRawId.set(rawId, safeId);
    }
    lensIdByRawId.set(safeId, safeId);
    return normalizeLens(lens, safeId, fallbackSources);
  });
  if (!lenses.some((lens) => lens.id === "overview")) {
    usedLensIds.add("overview");
    lensIdByRawId.set("overview", "overview");
    lenses.unshift({
      id: "overview",
      title: "总览 Overview",
      shortTitle: "Overview",
      description: "项目总览 Project overview",
      status: "detected",
      confidence: fallbackSources.length > 0 ? "medium" : "unknown",
      evidence: fallbackSources,
    });
  }
  const lensIds = new Set(lenses.map((lens) => lens.id));
  const now = nowIso();
  const rawNodes = Array.isArray(input.payload.nodes) ? input.payload.nodes : [];
  const normalizedNodes = normalizeChildren(
    rawNodes
      .map((node) =>
        normalizeNode({ node, lensIds, lensIdByRawId, fallbackSources, run: input.run, now }),
      )
      .filter((node): node is ProjectMapNode => Boolean(node)),
  );
  if (normalizedNodes.length === 0) {
    throw new Error("AI output did not produce any valid project-map nodes.");
  }

  const scope = input.run.requestScope ?? ({ kind: input.run.scope } as ProjectMapGenerationScope);
  const nextNodes =
    scope.kind === "global"
      ? normalizedNodes
      : mergeNodeScopedResults({
          currentNodes: input.dataset.nodes,
          generatedNodes: normalizedNodes,
          allowedIds: collectScopedNodeIds(input.dataset, scope),
          targetNodeId: scope.kind === "node" ? scope.nodeId : null,
        });
  const nextLensStats = lenses.map((lens) => {
    const lensNodes = nextNodes.filter((node) => node.lensId === lens.id);
    return {
      lensId: lens.id,
      nodeCount: lensNodes.length,
      staleCount: lensNodes.filter((node) => node.stale).length,
      candidateCount: lensNodes.filter((node) => node.candidate).length,
    };
  });

  return {
    ...input.dataset,
    profile: input.payload.profile ?? input.dataset.profile,
    lenses,
    nodes: nextNodes,
    manifest: {
      ...input.dataset.manifest,
      updatedAt: now,
      lastRunId: input.run.id,
      sourceRootHash: hashText(input.evidence.map((entry) => `${entry.path}:${entry.hash}`).join("\n")),
      lensStats: nextLensStats,
    },
    evidenceRecords: [
      ...(input.dataset.evidenceRecords ?? []),
      ...fallbackSources.map((source) => ({
        id: `${input.run.id}_${hashText(source.path ?? source.label)}`,
        source,
        priority: "code" as const,
        observedHash: source.hash ?? null,
        observedAt: now,
      })),
    ].slice(-200),
  };
}

function mergeNodeScopedResults(input: {
  currentNodes: ProjectMapNode[];
  generatedNodes: ProjectMapNode[];
  allowedIds: Set<string>;
  targetNodeId: string | null;
}): ProjectMapNode[] {
  const generatedById = new Map(input.generatedNodes.map((node) => [node.id, node]));
  const merged = input.currentNodes.map((node) =>
    input.allowedIds.has(node.id) && generatedById.has(node.id) ? generatedById.get(node.id)! : node,
  );
  const currentIds = new Set(merged.map((node) => node.id));
  const appended = input.generatedNodes.filter((node) => {
    if (currentIds.has(node.id)) {
      return false;
    }
    if (!input.targetNodeId) {
      return false;
    }
    return node.parentId === input.targetNodeId || input.allowedIds.has(node.parentId ?? "");
  });
  return normalizeChildren([...merged, ...appended]);
}

export async function runProjectMapGenerationWorker({
  workspaceId,
  dataset,
  run,
  onRunUpdate,
}: ProjectMapGenerationWorkerInput): Promise<ProjectMapDataset> {
  const update = async (updateValue: ProjectMapRunUpdate) => {
    await onRunUpdate(updateValue);
  };
  const evidence = await collectWorkspaceEvidence({
    workspaceId,
    requestSources: run.readSources ?? [],
    update,
  });
  const prompt = buildPrompt({ dataset, run, evidence });
  const output = await runAiTurn({ workspaceId, run, prompt, update });
  await update({ phase: "validatingOutput", progress: 78, log: "Validating structured JSON output." });
  const payload = parseJsonPayload(output);
  const nextDataset = applyAiPayload({ dataset, payload, evidence, run });
  await update({ phase: "writingMap", progress: 92, log: "Validated map data; writing project-map files." });
  return nextDataset;
}
