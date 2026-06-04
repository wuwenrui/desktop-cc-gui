import { useTranslation } from "react-i18next";
import LinkIcon from "lucide-react/dist/esm/icons/link";

import {
  getProjectMapPathBasename,
  inferProjectMapWorkspaceFilePath,
} from "../utils/evidencePaths";
import type {
  ProjectMapDiagramArtifact,
  ProjectMapRelatedArtifact,
  ProjectMapSource,
} from "../types";

export type ProjectMapTraceTarget = {
  path: string;
  line?: number;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function inferArtifactTracePath(input: {
  label: string;
  path: string;
  ref: string;
}): string {
  return inferProjectMapWorkspaceFilePath(input);
}

function normalizeTraceSourceType(value: unknown): ProjectMapRelatedArtifact["type"] {
  const sourceType = asTrimmedString(value);
  return ["file", "symbol", "spec", "task", "document", "commit", "test", "conversation"].includes(sourceType)
    ? (sourceType as ProjectMapRelatedArtifact["type"])
    : "file";
}

export function normalizeProjectMapArtifactForDisplay(
  value: unknown,
): ProjectMapRelatedArtifact | null {
  const legacyLabel = asTrimmedString(value);
  if (legacyLabel) {
    const inferredPath = inferArtifactTracePath({
      label: legacyLabel,
      path: "",
      ref: "",
    });
    return {
      type: "symbol",
      label: legacyLabel,
      ...(inferredPath ? { path: inferredPath } : {}),
    };
  }
  if (!isRecord(value)) {
    return null;
  }

  const type = normalizeTraceSourceType(value.type);
  const label = asTrimmedString(value.label);
  const path = asTrimmedString(value.path);
  const ref = asTrimmedString(value.ref);
  const inferredPath = inferArtifactTracePath({ label, path, ref });
  const rawLine = typeof value.line === "number" ? value.line : Number(asTrimmedString(value.line));
  const line = Number.isFinite(rawLine) && rawLine > 0 ? Math.floor(rawLine) : undefined;
  const normalizedLabel =
    label || (inferredPath ? getProjectMapPathBasename(inferredPath) : "") || ref || type;
  if (!normalizedLabel) {
    return null;
  }

  return {
    type,
    label: normalizedLabel,
    ...(inferredPath ? { path: inferredPath } : {}),
    ...(line ? { line } : {}),
    ...(ref ? { ref } : {}),
  };
}

function getTraceLabel(
  item: Pick<ProjectMapRelatedArtifact, "path" | "line" | "ref"> & {
    hash?: string;
  },
): string | null {
  if (item.path) {
    return item.line ? `${item.path}:${item.line}` : item.path;
  }
  return item.ref ?? item.hash ?? null;
}

function getTraceTarget(
  item: Pick<ProjectMapRelatedArtifact, "path" | "line">,
): ProjectMapTraceTarget | null {
  return item.path ? { path: item.path, line: item.line } : null;
}

function normalizeTraceTextForCompare(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\s+/g, " ");
}

function shouldShowTracePath(input: { label: string; traceLabel: string | null }): boolean {
  if (!input.traceLabel) {
    return false;
  }
  return normalizeTraceTextForCompare(input.label) !== normalizeTraceTextForCompare(input.traceLabel);
}

function normalizeTraceTypeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const LEGACY_TRACE_TYPE_LABELS: Record<ProjectMapRelatedArtifact["type"], Set<string>> = {
  file: new Set(["file", "文件", "文件file"]),
  symbol: new Set(["symbol", "符号", "符号symbol"]),
  spec: new Set(["spec", "规范", "规范spec"]),
  task: new Set(["task", "任务", "任务task"]),
  document: new Set(["document", "文档", "文档document"]),
  commit: new Set(["commit", "提交", "提交commit"]),
  test: new Set(["test", "测试", "测试test"]),
  conversation: new Set(["conversation", "对话", "对话conversation"]),
};

function isLegacyTraceTypeLabel(type: ProjectMapRelatedArtifact["type"], label: string): boolean {
  const normalizedLabel = normalizeTraceTypeText(label);
  return normalizedLabel.length > 0 && (LEGACY_TRACE_TYPE_LABELS[type]?.has(normalizedLabel) ?? false);
}

function resolveTraceDisplayLabel(
  item: Pick<ProjectMapRelatedArtifact, "type" | "label" | "path" | "ref">,
): string {
  if (!isLegacyTraceTypeLabel(item.type, item.label)) {
    return item.label;
  }
  if (item.path) {
    return getProjectMapPathBasename(item.path);
  }
  return item.ref ?? item.label;
}

function normalizeTraceDedupText(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").toLowerCase();
}

function getTraceDedupKey(
  item: Pick<ProjectMapRelatedArtifact, "type" | "label" | "path" | "ref"> & {
    hash?: string;
  },
): string {
  if (item.path) {
    return `path:${normalizeTraceDedupText(item.path)}`;
  }
  if (item.ref) {
    return `ref:${normalizeTraceDedupText(item.ref)}`;
  }
  if (item.hash) {
    return `hash:${normalizeTraceDedupText(item.hash)}`;
  }
  return `visible:${normalizeTraceDedupText(resolveTraceDisplayLabel(item))}`;
}

function dedupeProjectMapTraceItemsForDisplay<T extends Parameters<typeof getTraceDedupKey>[0]>(
  items: T[],
): T[] {
  const seenKeys = new Set<string>();
  return items.filter((item) => {
    const key = getTraceDedupKey(item);
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    return true;
  });
}

export function dedupeProjectMapSourcesForDisplay(sources: ProjectMapSource[]): ProjectMapSource[] {
  return dedupeProjectMapTraceItemsForDisplay(sources);
}

export function dedupeProjectMapArtifactsForDisplay(
  artifacts: ProjectMapRelatedArtifact[],
): ProjectMapRelatedArtifact[] {
  return dedupeProjectMapTraceItemsForDisplay(artifacts);
}

export function ProjectMapSourceChip({
  source,
  onOpenTrace,
}: {
  source: ProjectMapSource;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
}) {
  const traceLabel = getTraceLabel(source);

  return (
    <ProjectMapTraceChip
      label={resolveTraceDisplayLabel(source)}
      traceLabel={traceLabel}
      target={getTraceTarget(source)}
      excerpt={source.excerpt}
      onOpenTrace={onOpenTrace}
    />
  );
}

export function ProjectMapArtifactChip({
  artifact,
  onOpenTrace,
}: {
  artifact: ProjectMapRelatedArtifact;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
}) {
  return (
    <ProjectMapTraceChip
      label={resolveTraceDisplayLabel(artifact)}
      traceLabel={getTraceLabel(artifact)}
      target={getTraceTarget(artifact)}
      onOpenTrace={onOpenTrace}
    />
  );
}

export function ProjectMapDiagramChip({
  diagram,
  onOpenTrace,
}: {
  diagram: ProjectMapDiagramArtifact;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
}) {
  return (
    <ProjectMapTraceChip
      label={diagram.label}
      traceLabel={diagram.path}
      target={{ path: diagram.path }}
      excerpt={diagram.summary}
      onOpenTrace={onOpenTrace}
    />
  );
}

function ProjectMapTraceChip({
  label,
  traceLabel,
  target,
  excerpt,
  onOpenTrace,
}: {
  label: string;
  traceLabel: string | null;
  target: ProjectMapTraceTarget | null;
  excerpt?: string;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
}) {
  const { t } = useTranslation();
  const visibleTraceLabel = shouldShowTracePath({ label, traceLabel }) ? traceLabel : null;
  const body = (
    <>
      <span className="project-map-trace-label">{label}</span>
      {visibleTraceLabel ? <span className="project-map-trace-path">{visibleTraceLabel}</span> : null}
      {excerpt ? <span className="project-map-trace-excerpt">{excerpt}</span> : null}
    </>
  );

  if (!traceLabel || !target || !onOpenTrace) {
    return (
      <span className="project-map-trace-chip" title={label}>
        {traceLabel && target ? <LinkIcon aria-hidden /> : null}
        {body}
      </span>
    );
  }

  return (
    <button
      className="project-map-trace-chip is-traceable"
      type="button"
      title={traceLabel}
      aria-label={`${t("projectMap.trace.openTrace", { label, trace: traceLabel })}: ${label} ${traceLabel}`}
      onClick={() => onOpenTrace(target)}
    >
      <LinkIcon aria-hidden />
      {body}
    </button>
  );
}
