import { useTranslation } from "react-i18next";
import Folder from "lucide-react/dist/esm/icons/folder";
import Search from "lucide-react/dist/esm/icons/search";

import { cn } from "../../../lib/utils";
import type {
  ProjectMapEvidenceFileEntry,
  ProjectMapEvidenceFileIndex,
} from "../utils/evidenceFileIndex";
import { projectMapPathMatches } from "../utils/projectionGuards";
import type { ProjectMapTraceTarget } from "./ProjectMapTraceChips";

const PROJECT_MAP_EVIDENCE_SOURCE_KIND_ALL = "all";

export function ProjectMapEvidenceFilesPanel({
  evidenceFileIndex,
  filteredFiles,
  selectedFile,
  expanded,
  changedFilePaths,
  unmappedFilePaths,
  selectedNodeId,
  searchQuery,
  sourceKindFilter,
  sourceKindOptions,
  showSelectedNodeOnly,
  isHighlightActive,
  onExpandedChange,
  onSearchQueryChange,
  onSourceKindFilterChange,
  onSelectedNodeOnlyChange,
  onSelectFile,
  onFocusNode,
  onSelectRelation,
  onClearHighlight,
  onOpenTrace,
}: {
  evidenceFileIndex: ProjectMapEvidenceFileIndex;
  filteredFiles: ProjectMapEvidenceFileEntry[];
  selectedFile: ProjectMapEvidenceFileEntry | null;
  expanded: boolean;
  changedFilePaths: string[];
  unmappedFilePaths: string[];
  selectedNodeId: string | null;
  searchQuery: string;
  sourceKindFilter: string;
  sourceKindOptions: string[];
  showSelectedNodeOnly: boolean;
  isHighlightActive: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSearchQueryChange: (query: string) => void;
  onSourceKindFilterChange: (sourceKind: string) => void;
  onSelectedNodeOnlyChange: (enabled: boolean) => void;
  onSelectFile: (path: string) => void;
  onFocusNode: (nodeId: string) => void;
  onSelectRelation: (relationId: string) => void;
  onClearHighlight: () => void;
  onOpenTrace?: (target: ProjectMapTraceTarget) => void;
}) {
  const { t } = useTranslation();
  const firstLineRef = selectedFile?.lineRefs[0] ?? null;
  const canOpenSelectedFile = Boolean(selectedFile && onOpenTrace);
  const visibleFiles = filteredFiles.slice(0, 10);
  const cappedFileCount = Math.max(0, filteredFiles.length - visibleFiles.length);
  const selectedFileRelationLinks = selectedFile?.relationLinks.slice(0, 6) ?? [];
  const selectedFileNodeLinks = selectedFile?.nodeLinks.slice(0, 8) ?? [];
  const selectedFileLineRefs = selectedFile?.lineRefs.slice(0, 6) ?? [];
  const selectedFileGovernanceLinks = selectedFile?.governanceLinks.slice(0, 5) ?? [];
  const selectedFileHasLargeContext = Boolean(
    selectedFile &&
      (selectedFile.nodeLinks.length > selectedFileNodeLinks.length ||
        selectedFile.relationLinks.length > selectedFileRelationLinks.length ||
        selectedFile.lineRefs.length > selectedFileLineRefs.length ||
        selectedFile.governanceLinks.length > selectedFileGovernanceLinks.length),
  );

  const getFileMarkers = (fileEntry: ProjectMapEvidenceFileEntry): Array<{
    key: string;
    label: string;
    className?: string;
  }> => {
    const markers = [];
    if (changedFilePaths.some((filePath) => projectMapPathMatches(fileEntry.path, filePath))) {
      markers.push({
        key: "changed",
        label: t("projectMap.evidenceFiles.changed"),
        className: "is-changed",
      });
    }
    if (unmappedFilePaths.some((filePath) => projectMapPathMatches(fileEntry.path, filePath))) {
      markers.push({
        key: "unmapped",
        label: t("projectMap.evidenceFiles.unmapped"),
        className: "is-degraded",
      });
    }
    if (fileEntry.nodeCount > 8 || fileEntry.relationCount > 6 || fileEntry.lineRefs.length > 6) {
      markers.push({
        key: "large",
        label: t("projectMap.evidenceFiles.largeContext"),
        className: "is-warning",
      });
    }
    return markers;
  };

  return (
    <section className={cn("project-map-evidence-files-panel", !expanded && "is-collapsed")}>
      <div className="project-map-evidence-files-header">
        <Folder aria-hidden />
        <div>
          <h4>{t("projectMap.evidenceFiles.title")}</h4>
          <p>
            {t("projectMap.evidenceFiles.summary", {
              files: evidenceFileIndex.files.length,
              evidence: evidenceFileIndex.totalFileEvidenceCount,
              nonFile: evidenceFileIndex.totalNonFileEvidenceCount,
            })}
          </p>
        </div>
        <button type="button" onClick={() => onExpandedChange(!expanded)}>
          {expanded ? t("projectMap.evidenceFiles.collapse") : t("projectMap.evidenceFiles.expand")}
        </button>
      </div>
      {!expanded ? null : (
        <>

      <div className="project-map-evidence-files-controls">
        <label className="project-map-search-input">
          <Search aria-hidden />
          <input
            value={searchQuery}
            placeholder={t("projectMap.evidenceFiles.searchPlaceholder")}
            aria-label={t("projectMap.evidenceFiles.searchLabel")}
            onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          />
        </label>
        <select
          value={sourceKindFilter}
          aria-label={t("projectMap.evidenceFiles.sourceKindFilter")}
          onChange={(event) => onSourceKindFilterChange(event.currentTarget.value)}
        >
          <option value={PROJECT_MAP_EVIDENCE_SOURCE_KIND_ALL}>
            {t("projectMap.evidenceFiles.allSourceKinds")}
          </option>
          {sourceKindOptions.map((sourceKind) => (
            <option key={sourceKind} value={sourceKind}>
              {sourceKind}
            </option>
          ))}
        </select>
        <label className="project-map-evidence-files-toggle">
          <input
            type="checkbox"
            checked={showSelectedNodeOnly}
            disabled={!selectedNodeId}
            onChange={(event) => onSelectedNodeOnlyChange(event.currentTarget.checked)}
          />
          <span>{t("projectMap.evidenceFiles.selectedNodeOnly")}</span>
        </label>
      </div>

      {evidenceFileIndex.files.length === 0 ? (
        <p className="project-map-evidence-files-empty">
          {t("projectMap.evidenceFiles.empty")}
        </p>
      ) : filteredFiles.length === 0 ? (
        <p className="project-map-evidence-files-empty">
          {t("projectMap.evidenceFiles.noFilteredFiles")}
        </p>
      ) : (
        <div className="project-map-evidence-file-list" role="list">
          {visibleFiles.map((fileEntry) => {
            const markers = getFileMarkers(fileEntry);
            return (
              <button
                key={fileEntry.path}
                type="button"
                className={cn(
                  "project-map-evidence-file-row",
                  selectedFile?.path === fileEntry.path && "is-selected",
                )}
                onClick={() => {
                  onSelectFile(fileEntry.path);
                  const fileLineRef = fileEntry.lineRefs[0] ?? null;
                  onOpenTrace?.(
                    fileLineRef
                      ? { path: fileEntry.path, line: fileLineRef.line }
                      : { path: fileEntry.path },
                  );
                }}
              >
                <span className="project-map-evidence-file-path">{fileEntry.displayPath}</span>
                <span className="project-map-evidence-file-meta">
                  {t("projectMap.evidenceFiles.fileMeta", {
                    nodes: fileEntry.nodeCount,
                    evidence: fileEntry.evidenceCount,
                  })}
                </span>
                <span className="project-map-evidence-file-tags">
                  {markers.map((marker) => (
                    <em key={marker.key} className={marker.className}>{marker.label}</em>
                  ))}
                  {fileEntry.sourceKinds.slice(0, 3).map((sourceKind) => (
                    <em key={sourceKind}>{sourceKind}</em>
                  ))}
                  {fileEntry.staleCount > 0 ? (
                    <em className="is-warning">{t("projectMap.evidenceFiles.stale")}</em>
                  ) : null}
                  {fileEntry.lowConfidenceCount > 0 ? (
                    <em className="is-warning">{t("projectMap.evidenceFiles.lowConfidence")}</em>
                  ) : null}
                  {fileEntry.degradedCount > 0 ? (
                    <em className="is-degraded">{t("projectMap.evidenceFiles.degraded")}</em>
                  ) : null}
                </span>
              </button>
            );
          })}
          {cappedFileCount > 0 ? (
            <p className="project-map-evidence-files-empty">
              {t("projectMap.evidenceFiles.cappedFiles", { count: cappedFileCount })}
            </p>
          ) : null}
        </div>
      )}

      {selectedFile ? (
        <div className="project-map-evidence-file-detail">
          <header>
            <div>
              <h5>{selectedFile.displayPath}</h5>
              <p>
                {t("projectMap.evidenceFiles.detailMeta", {
                  nodes: selectedFile.nodeCount,
                  relations: selectedFile.relationCount,
                  governance: selectedFile.governanceLinks.length,
                })}
              </p>
            </div>
            <div className="project-map-evidence-file-actions">
              <button
                type="button"
                disabled={!canOpenSelectedFile}
                onClick={() => {
                  if (!selectedFile || !onOpenTrace) {
                    return;
                  }
                  onOpenTrace(
                    firstLineRef
                      ? { path: selectedFile.path, line: firstLineRef.line }
                      : { path: selectedFile.path },
                  );
                }}
              >
                {t("projectMap.evidenceFiles.openFile")}
              </button>
              {isHighlightActive ? (
                <button type="button" onClick={onClearHighlight}>
                  {t("projectMap.evidenceFiles.clearHighlight")}
                </button>
              ) : (
                <button type="button" onClick={() => onSelectFile(selectedFile.path)}>
                  {t("projectMap.evidenceFiles.highlightNodes")}
                </button>
              )}
            </div>
          </header>
          {selectedFileHasLargeContext ? (
            <p className="project-map-evidence-files-empty">
              {t("projectMap.evidenceFiles.largeContent")}
            </p>
          ) : null}

          {selectedFile.nodeLinks.length > 0 ? (
            <div className="project-map-evidence-related-nodes">
              <strong>{t("projectMap.evidenceFiles.relatedNodes")}</strong>
              {selectedFileNodeLinks.map((nodeLink) => (
                <button
                  key={nodeLink.nodeId}
                  type="button"
                  onClick={() => onFocusNode(nodeLink.nodeId)}
                >
                  <span>{nodeLink.title}</span>
                  <em>
                    {t("projectMap.evidenceFiles.nodeMeta", {
                      evidence: nodeLink.evidenceCount,
                      confidence: nodeLink.confidence,
                    })}
                  </em>
                </button>
              ))}
            </div>
          ) : (
            <p className="project-map-evidence-files-empty">
              {t("projectMap.evidenceFiles.noRelatedNodes")}
            </p>
          )}

          {selectedFileRelationLinks.length > 0 ? (
            <div className="project-map-evidence-related-nodes">
              <strong>{t("projectMap.evidenceFiles.relatedRelations")}</strong>
              {selectedFileRelationLinks.map((relationLink) => (
                <button
                  key={relationLink.relationId}
                  type="button"
                  onClick={() => {
                    onSelectRelation(relationLink.relationId);
                    const focusNodeId = relationLink.sourceNodeId || relationLink.targetNodeId;
                    if (focusNodeId) {
                      onFocusNode(focusNodeId);
                    }
                  }}
                >
                  <span>{relationLink.type}</span>
                  <em>
                    {t("projectMap.evidenceFiles.relationMeta", {
                      evidence: relationLink.evidenceCount,
                      confidence: relationLink.confidence,
                    })}
                  </em>
                </button>
              ))}
            </div>
          ) : null}

          {selectedFileGovernanceLinks.length > 0 ? (
            <div className="project-map-evidence-line-refs">
              <strong>{t("projectMap.evidenceFiles.governanceRefs")}</strong>
              <span>
                {selectedFileGovernanceLinks
                  .map((link) => link.line ? `${link.label}:${link.line}` : link.label)
                  .join(" · ")}
              </span>
            </div>
          ) : null}

          {selectedFile.lineRefs.length > 0 ? (
            <div className="project-map-evidence-line-refs">
              <strong>{t("projectMap.evidenceFiles.lineRefs")}</strong>
              <span>
                {selectedFileLineRefs
                  .map((lineRef) => `${lineRef.label}:${lineRef.line}`)
                  .join(" · ")}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {evidenceFileIndex.nonFileEvidence.length > 0 ? (
        <p className="project-map-evidence-non-file">
          {t("projectMap.evidenceFiles.nonFileEvidence", {
            count: evidenceFileIndex.nonFileEvidence.length,
          })}
        </p>
      ) : null}
        </>
      )}
    </section>
  );
}
