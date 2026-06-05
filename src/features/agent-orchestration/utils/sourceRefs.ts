import type {
  OrchestrationProviderCapability,
  OrchestrationProviderId,
  OrchestrationSourceKind,
  OrchestrationSourceRef,
} from "../types";

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "").trim();
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[a-zA-Z]:\//.test(value);
}

export function normalizeOrchestrationWorkspacePath(input: {
  path?: string | null;
  workspacePath?: string | null;
}): string | null {
  const rawPath = input.path?.trim() ?? "";
  if (!rawPath) {
    return null;
  }
  const normalizedPath = normalizePathSeparators(rawPath);
  const normalizedWorkspace = normalizePathSeparators(input.workspacePath?.trim() ?? "").replace(/\/$/, "");
  if (normalizedWorkspace && (
    normalizedPath === normalizedWorkspace ||
    normalizedPath.startsWith(`${normalizedWorkspace}/`)
  )) {
    const relativePath = normalizedPath.slice(normalizedWorkspace.length).replace(/^\//, "");
    return relativePath || null;
  }
  if (isAbsolutePath(normalizedPath)) {
    return null;
  }
  return normalizedPath || null;
}

export function createOrchestrationSourceRef(input: {
  providerId: OrchestrationProviderId;
  kind: OrchestrationSourceKind;
  id: string;
  label: string;
  path?: string | null;
  workspacePath?: string | null;
  confidence?: OrchestrationSourceRef["confidence"];
  stale?: boolean;
  capabilities?: OrchestrationProviderCapability[];
  metadata?: OrchestrationSourceRef["metadata"];
}): OrchestrationSourceRef {
  const workspaceRelativePath = normalizeOrchestrationWorkspacePath({
    path: input.path,
    workspacePath: input.workspacePath,
  });
  return {
    providerId: input.providerId,
    kind: input.kind,
    id: input.id,
    label: input.label,
    ...(workspaceRelativePath ? { path: workspaceRelativePath, workspaceRelativePath } : {}),
    confidence: input.confidence,
    stale: input.stale,
    capabilities: input.capabilities ?? ["open_source"],
    metadata: input.metadata,
  };
}
