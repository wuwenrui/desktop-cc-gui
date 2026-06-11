import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";
import {
  getProjectMapRelationshipRoleColor,
  type ProjectMapRelationshipDashboardData,
} from "../utils/relationshipDashboardModel";
import type {
  ProjectMapRelationshipFileDirectionCount,
  ProjectMapRelationshipTopFileRoleGroup,
} from "../hooks/useProjectMapRelationshipFileProjection";
import type { ProjectMapScannedFile } from "../types";

type ProjectMapRelationshipGraphRailProps = {
  collapsedRelationshipTopModuleGroups: ReadonlySet<string>;
  collapsedRelationshipTopRoleGroups: ReadonlySet<string>;
  expandedRelationshipTopFileGroups: ReadonlySet<string>;
  expandedRelationshipTopModuleGroups: ReadonlySet<string>;
  expandedRelationshipTopRoleGroups: ReadonlySet<string>;
  relationshipDashboardData: ProjectMapRelationshipDashboardData;
  relationshipDashboardDirectionCountByFile: ReadonlyMap<string, ProjectMapRelationshipFileDirectionCount>;
  relationshipDashboardFilteredFiles: ProjectMapScannedFile[];
  relationshipDashboardTopFileGroups: ProjectMapRelationshipTopFileRoleGroup[];
  relationshipDashboardVisibleFileTotal: number;
  selectedRelationshipFile: ProjectMapScannedFile | null;
  setInspectedRelationshipFileId: (value: string | null) => void;
  setSelectedRelationshipFileId: (value: string | null) => void;
  setSelectedRelationshipRelationId: (value: string | null) => void;
  toggleRelationshipTopFileGroup: (groupId: string) => void;
  toggleRelationshipTopModuleGroup: (groupId: string, isExpanded: boolean) => void;
  toggleRelationshipTopRoleGroup: (groupId: string, isExpanded: boolean) => void;
};

const PROJECT_MAP_RELATIONSHIP_GRAPH_GROUP_LIMIT = 6;

export function ProjectMapRelationshipGraphRail({
  collapsedRelationshipTopModuleGroups,
  collapsedRelationshipTopRoleGroups,
  expandedRelationshipTopFileGroups,
  expandedRelationshipTopModuleGroups,
  expandedRelationshipTopRoleGroups,
  relationshipDashboardData,
  relationshipDashboardDirectionCountByFile,
  relationshipDashboardFilteredFiles,
  relationshipDashboardTopFileGroups,
  relationshipDashboardVisibleFileTotal,
  selectedRelationshipFile,
  setInspectedRelationshipFileId,
  setSelectedRelationshipFileId,
  setSelectedRelationshipRelationId,
  toggleRelationshipTopFileGroup,
  toggleRelationshipTopModuleGroup,
  toggleRelationshipTopRoleGroup,
}: ProjectMapRelationshipGraphRailProps) {
  const { t } = useTranslation();

  return (
    <aside className="project-map-relationship-graph-rail">
      <header>
        <strong>{t("projectMap.relationship.graphFiles")}</strong>
        <span>{t("projectMap.relationship.graphTopFiles", {
          top: relationshipDashboardFilteredFiles.length,
          matching: relationshipDashboardVisibleFileTotal,
          scanned: relationshipDashboardData.files.length,
        })}</span>
      </header>
      <div className="project-map-relationship-graph-file-list">
        {relationshipDashboardTopFileGroups.map((roleGroup, roleGroupIndex) => {
          const selectedFileInRole = Boolean(
            selectedRelationshipFile
            && roleGroup.files.some((file) => file.id === selectedRelationshipFile.id),
          );
          const isDefaultRoleExpanded = roleGroupIndex === 0;
          const isRoleExpanded =
            selectedFileInRole
            || expandedRelationshipTopRoleGroups.has(roleGroup.id)
            || (
              isDefaultRoleExpanded
              && !collapsedRelationshipTopRoleGroups.has(roleGroup.id)
            );
          return (
            <section
              key={roleGroup.id}
              className="project-map-relationship-graph-file-group"
            >
              <header>
                <button
                  type="button"
                  className="project-map-relationship-graph-file-group-toggle"
                  aria-expanded={isRoleExpanded}
                  onClick={() => toggleRelationshipTopRoleGroup(roleGroup.id, isRoleExpanded)}
                >
                  <span aria-hidden>{isRoleExpanded ? "▾" : "▸"}</span>
                  <strong>{roleGroup.label}</strong>
                </button>
                <span>{t("projectMap.relationship.graphFileGroupStats", {
                  files: roleGroup.files.length,
                  relations: roleGroup.relationCount,
                })}</span>
              </header>
              {isRoleExpanded ? (
                <div className="project-map-relationship-graph-file-modules">
                  {roleGroup.moduleGroups.map((moduleGroup, moduleGroupIndex) => {
                    const selectedFileInModule = Boolean(
                      selectedRelationshipFile
                      && moduleGroup.files.some((file) => file.id === selectedRelationshipFile.id),
                    );
                    const isDefaultModuleExpanded = roleGroupIndex === 0 && moduleGroupIndex === 0;
                    const isModuleExpanded =
                      selectedFileInModule
                      || expandedRelationshipTopModuleGroups.has(moduleGroup.id)
                      || (
                        isDefaultModuleExpanded
                        && !collapsedRelationshipTopModuleGroups.has(moduleGroup.id)
                      );
                    const isGroupExpanded = expandedRelationshipTopFileGroups.has(moduleGroup.id);
                    const visibleFiles = isGroupExpanded
                      ? moduleGroup.files
                      : moduleGroup.files.slice(0, PROJECT_MAP_RELATIONSHIP_GRAPH_GROUP_LIMIT);
                    return (
                      <section
                        key={moduleGroup.id}
                        className="project-map-relationship-graph-file-module"
                      >
                        <header>
                          <button
                            type="button"
                            className="project-map-relationship-graph-file-module-toggle"
                            aria-expanded={isModuleExpanded}
                            onClick={() => toggleRelationshipTopModuleGroup(moduleGroup.id, isModuleExpanded)}
                          >
                            <span aria-hidden>{isModuleExpanded ? "▾" : "▸"}</span>
                            <strong>{moduleGroup.label}</strong>
                          </button>
                          <span>
                            {isModuleExpanded
                              ? t("projectMap.relationship.graphFileModuleStats", {
                                  rendered: visibleFiles.length,
                                  files: moduleGroup.files.length,
                                })
                              : t("projectMap.relationship.graphFileModuleCollapsedStats", {
                                  files: moduleGroup.files.length,
                                })}
                          </span>
                        </header>
                        {isModuleExpanded ? (
                          <div>
                            {visibleFiles.map((file) => {
                              const directionCount =
                                relationshipDashboardDirectionCountByFile.get(file.id)
                                ?? { incoming: 0, outgoing: 0 };
                              return (
                                <button
                                  key={file.id}
                                  type="button"
                                  className={cn(
                                    selectedRelationshipFile?.id === file.id && "is-active",
                                  )}
                                  onClick={() => {
                                    setSelectedRelationshipFileId(file.id);
                                    setInspectedRelationshipFileId(file.id);
                                    setSelectedRelationshipRelationId(null);
                                  }}
                                >
                                  <span
                                    style={{
                                      "--relationship-node-color": getProjectMapRelationshipRoleColor(file.role),
                                    } as CSSProperties}
                                  />
                                  <strong>{file.basename}</strong>
                                  <em>
                                    {t("projectMap.relationship.graphFileDirectionSummary", {
                                      role: file.role,
                                      incoming: directionCount.incoming,
                                      outgoing: directionCount.outgoing,
                                    })}
                                  </em>
                                </button>
                              );
                            })}
                            {moduleGroup.files.length > PROJECT_MAP_RELATIONSHIP_GRAPH_GROUP_LIMIT ? (
                              <button
                                type="button"
                                className="project-map-relationship-graph-file-more"
                                onClick={() => toggleRelationshipTopFileGroup(moduleGroup.id)}
                              >
                                <strong>
                                  {isGroupExpanded
                                    ? t("projectMap.relationship.graphFileGroupCollapse")
                                    : t("projectMap.relationship.graphFileGroupMore", {
                                        count: moduleGroup.files.length - PROJECT_MAP_RELATIONSHIP_GRAPH_GROUP_LIMIT,
                                      })}
                                </strong>
                                <em>{t("projectMap.relationship.graphFileGroupSearchHint")}</em>
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
