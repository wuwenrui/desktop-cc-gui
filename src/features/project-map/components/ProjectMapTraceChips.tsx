import { useTranslation } from "react-i18next";
import LinkIcon from "lucide-react/dist/esm/icons/link";

import {
  getProjectMapPathBasename,
  inferProjectMapWorkspaceFilePath,
} from "../utils/evidencePaths";
import { translateProjectMapSourceType } from "../utils/display";
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
  return ["file", "symbol", "spec", "commit", "test", "conversation"].includes(sourceType)
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

export function ProjectMapSourceChip({
  source,
  onOpenTrace,
}: {
  source: ProjectMapSource;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
}) {
  const { t } = useTranslation();
  const traceLabel = getTraceLabel(source);

  return (
    <ProjectMapTraceChip
      label={source.label}
      typeLabel={translateProjectMapSourceType(t, source.type)}
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
  const { t } = useTranslation();

  return (
    <ProjectMapTraceChip
      label={artifact.label}
      typeLabel={translateProjectMapSourceType(t, artifact.type)}
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
  const { t } = useTranslation();

  return (
    <ProjectMapTraceChip
      label={diagram.label}
      typeLabel={t("projectMap.detail.diagramArtifact")}
      traceLabel={diagram.path}
      target={{ path: diagram.path }}
      excerpt={diagram.summary}
      onOpenTrace={onOpenTrace}
    />
  );
}

function ProjectMapTraceChip({
  label,
  typeLabel,
  traceLabel,
  target,
  excerpt,
  onOpenTrace,
}: {
  label: string;
  typeLabel: string;
  traceLabel: string | null;
  target: ProjectMapTraceTarget | null;
  excerpt?: string;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
}) {
  const { t } = useTranslation();
  const body = (
    <>
      <span className="project-map-source-type">{typeLabel}</span>
      <span className="project-map-trace-label">{label}</span>
      {traceLabel ? <span className="project-map-trace-path">{traceLabel}</span> : null}
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
