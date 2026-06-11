import { type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";
import { getProjectMapRelationshipRoleColor } from "../utils/relationshipDashboardModel";
import type { ProjectMapScannedFile } from "../types";

type ProjectMapRelationshipDashboardViewMode = "graph" | "files" | "read" | "api";
type ProjectMapRelationshipLayoutPreset = "radial" | "tree" | "force";

type ProjectMapRelationshipFileTreeGroup = {
  id: string;
  label: string;
  files: ProjectMapScannedFile[];
  relationCount: number;
};

type ProjectMapRelationshipFileDirectionCount = {
  incoming: number;
  outgoing: number;
};

type ProjectMapRelationshipFileWorkspaceProps = {
  expandedRelationshipFileGroups: ReadonlySet<string>;
  relationshipDashboardDirectionCountByFile: ReadonlyMap<string, ProjectMapRelationshipFileDirectionCount>;
  relationshipDashboardExplorerRenderedFileCount: number;
  relationshipDashboardFileTreeGroups: ProjectMapRelationshipFileTreeGroup[];
  relationshipDashboardFilteredFiles: ProjectMapScannedFile[];
  relationshipDashboardLayoutPreset: ProjectMapRelationshipLayoutPreset;
  relationshipDashboardScannedFileCount: number;
  relationshipDashboardVisibleFileTotal: number;
  relationshipFilesZoom: number;
  selectedRelationshipFile: ProjectMapScannedFile | null;
  setInspectedRelationshipFileId: (value: string | null) => void;
  setRelationshipDashboardViewMode: (value: ProjectMapRelationshipDashboardViewMode) => void;
  setSelectedRelationshipFileId: (value: string | null) => void;
  setSelectedRelationshipRelationId: (value: string | null) => void;
  toggleRelationshipFileTreeGroup: (groupId: string) => void;
};

const PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT = 80;

export function ProjectMapRelationshipFileWorkspace({
  expandedRelationshipFileGroups,
  relationshipDashboardDirectionCountByFile,
  relationshipDashboardExplorerRenderedFileCount,
  relationshipDashboardFileTreeGroups,
  relationshipDashboardFilteredFiles,
  relationshipDashboardLayoutPreset,
  relationshipDashboardScannedFileCount,
  relationshipDashboardVisibleFileTotal,
  relationshipFilesZoom,
  selectedRelationshipFile,
  setInspectedRelationshipFileId,
  setRelationshipDashboardViewMode,
  setSelectedRelationshipFileId,
  setSelectedRelationshipRelationId,
  toggleRelationshipFileTreeGroup,
}: ProjectMapRelationshipFileWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <div className="project-map-relationship-file-workspace">
      <header className="project-map-relationship-workspace-header">
        <div>
          <strong>{t("projectMap.relationship.filesWorkspaceTitle")}</strong>
          <span>{t("projectMap.relationship.filesWorkspaceSummary", {
            rendered: relationshipDashboardExplorerRenderedFileCount,
            matching: relationshipDashboardVisibleFileTotal,
            scanned: relationshipDashboardScannedFileCount,
          })}</span>
        </div>
        <button
          type="button"
          className="project-map-toolbar-action"
          onClick={() => setRelationshipDashboardViewMode("graph")}
        >
          {t("projectMap.relationship.openGraph")}
        </button>
      </header>
      <div
        className={cn(
          "project-map-relationship-file-tree",
          `is-layout-${relationshipDashboardLayoutPreset}`,
        )}
        style={{ "--relationship-files-scale": relationshipFilesZoom } as CSSProperties}
      >
        <div className="project-map-relationship-file-tree-zoom">
          {relationshipDashboardFileTreeGroups.length ? (
            relationshipDashboardFileTreeGroups.map((group) => (
              <section key={group.id} className="project-map-relationship-file-tree-group">
                <header>
                  <strong>{group.label}</strong>
                  <span>{t("projectMap.relationship.filesTreeGroupStats", {
                    rendered: expandedRelationshipFileGroups.has(group.id)
                      ? group.files.length
                      : Math.min(group.files.length, PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT),
                    files: group.files.length,
                    relations: group.relationCount,
                  })}</span>
                </header>
                <div className="project-map-relationship-file-tree-list">
                  {(expandedRelationshipFileGroups.has(group.id)
                    ? group.files
                    : group.files.slice(0, PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT)
                  ).map((file) => {
                    const directionCount =
                      relationshipDashboardDirectionCountByFile.get(file.id)
                      ?? { incoming: 0, outgoing: 0 };
                    return (
                      <button
                        key={file.id}
                        type="button"
                        className={cn(
                          "project-map-relationship-file-tree-row",
                          selectedRelationshipFile?.id === file.id && "is-active",
                        )}
                        title={file.path}
                        onClick={() => {
                          setSelectedRelationshipFileId(file.id);
                          setInspectedRelationshipFileId(file.id);
                          setSelectedRelationshipRelationId(null);
                          setRelationshipDashboardViewMode("graph");
                        }}
                      >
                        <span
                          style={{
                            "--relationship-node-color": getProjectMapRelationshipRoleColor(file.role),
                          } as CSSProperties}
                        />
                        <div>
                          <strong>{file.basename}</strong>
                          <em>{file.path}</em>
                        </div>
                        <small>
                          {t("projectMap.relationship.graphFileLanguageDirectionSummary", {
                            role: file.role,
                            language: file.language,
                            incoming: directionCount.incoming,
                            outgoing: directionCount.outgoing,
                          })}
                        </small>
                      </button>
                    );
                  })}
                  {group.files.length > PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT ? (
                    <button
                      type="button"
                      className="project-map-relationship-file-tree-row"
                      onClick={() => toggleRelationshipFileTreeGroup(group.id)}
                    >
                      <strong>
                        {expandedRelationshipFileGroups.has(group.id)
                          ? t("projectMap.relationship.filesTreeGroupCollapse")
                          : t("projectMap.relationship.filesTreeGroupMore", {
                              count: group.files.length - PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT,
                            })}
                      </strong>
                      <em>{t("projectMap.relationship.filesTreeGroupSearchHint")}</em>
                    </button>
                  ) : null}
                </div>
              </section>
            ))
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.noFiles")}
            </p>
          )}
        </div>
      </div>
      {relationshipDashboardVisibleFileTotal > relationshipDashboardFilteredFiles.length ? (
        <p className="project-map-relationship-list-cap">
          {t("projectMap.relationship.listCap", {
            visible: relationshipDashboardFilteredFiles.length,
            total: relationshipDashboardVisibleFileTotal,
          })}
        </p>
      ) : null}
    </div>
  );
}
