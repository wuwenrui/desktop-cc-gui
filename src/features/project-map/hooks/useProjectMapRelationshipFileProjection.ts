import { useMemo } from "react";

import {
  getProjectMapRelationshipRoleRank,
  getProjectMapRelationshipTypeRank,
  isProjectMapRelationshipNoiseFile,
  type ProjectMapRelationshipDashboardData,
} from "../utils/relationshipDashboardModel";
import type { ProjectMapScannedFile } from "../types";

export type ProjectMapRelationshipFileDirectionCount = {
  incoming: number;
  outgoing: number;
};

export type ProjectMapRelationshipFileTreeGroup = {
  id: string;
  label: string;
  files: ProjectMapScannedFile[];
  relationCount: number;
};

export type ProjectMapRelationshipTopFileModuleGroup = {
  id: string;
  label: string;
  files: ProjectMapScannedFile[];
  relationCount: number;
};

export type ProjectMapRelationshipTopFileRoleGroup = {
  id: string;
  label: string;
  files: ProjectMapScannedFile[];
  relationCount: number;
  moduleGroups: ProjectMapRelationshipTopFileModuleGroup[];
};

type ProjectMapRelationshipFileProjectionInput = {
  expandedRelationshipFileGroups: ReadonlySet<string>;
  inspectedRelationshipFileId: string | null;
  relationshipDashboardData: ProjectMapRelationshipDashboardData | null;
  relationshipDashboardQuery: string;
  relationshipDashboardRoleFilter: string;
  selectedRelationshipFileId: string | null;
  showRelationshipNoiseFiles: boolean;
};

const PROJECT_MAP_RELATION_FILTER_ALL = "all";
const PROJECT_MAP_RELATIONSHIP_TOP_FILE_LIMIT = 120;
const PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT = 80;

export function useProjectMapRelationshipFileProjection({
  expandedRelationshipFileGroups,
  inspectedRelationshipFileId,
  relationshipDashboardData,
  relationshipDashboardQuery,
  relationshipDashboardRoleFilter,
  selectedRelationshipFileId,
  showRelationshipNoiseFiles,
}: ProjectMapRelationshipFileProjectionInput) {
  const relationshipDashboardFileIndex = useMemo(() => {
    const index = new Map<string, ProjectMapScannedFile>();
    relationshipDashboardData?.files.forEach((file) => {
      index.set(file.id, file);
    });
    return index;
  }, [relationshipDashboardData]);

  const relationshipDashboardModuleByFileId = useMemo(() => {
    const index = new Map<string, string>();
    relationshipDashboardData?.modules.forEach((module) => {
      module.fileIds.forEach((fileId) => {
        index.set(fileId, module.label);
      });
    });
    return index;
  }, [relationshipDashboardData]);

  const relationshipDashboardTypeOptions = useMemo(() => {
    const types = new Set<string>();
    relationshipDashboardData?.relations.forEach((relation) => {
      types.add(relation.type);
    });
    return Array.from(types).sort((left, right) => (
      getProjectMapRelationshipTypeRank(left) - getProjectMapRelationshipTypeRank(right)
      || left.localeCompare(right)
    ));
  }, [relationshipDashboardData]);

  const relationshipDashboardRelationCountByFile = useMemo(() => {
    const counts = new Map<string, number>();
    relationshipDashboardData?.relations.forEach((relation) => {
      counts.set(relation.sourceFileId, (counts.get(relation.sourceFileId) ?? 0) + 1);
      counts.set(relation.targetFileId, (counts.get(relation.targetFileId) ?? 0) + 1);
    });
    return counts;
  }, [relationshipDashboardData]);

  const relationshipDashboardDirectionCountByFile = useMemo(() => {
    const counts = new Map<string, ProjectMapRelationshipFileDirectionCount>();
    relationshipDashboardData?.relations.forEach((relation) => {
      const sourceCount = counts.get(relation.sourceFileId) ?? { incoming: 0, outgoing: 0 };
      sourceCount.outgoing += 1;
      counts.set(relation.sourceFileId, sourceCount);
      const targetCount = counts.get(relation.targetFileId) ?? { incoming: 0, outgoing: 0 };
      targetCount.incoming += 1;
      counts.set(relation.targetFileId, targetCount);
    });
    return counts;
  }, [relationshipDashboardData]);

  const relationshipDashboardRoleOptions = useMemo(() => {
    if (!relationshipDashboardData) {
      return [];
    }
    const roles = new Set<string>();
    relationshipDashboardData.files.forEach((file) => {
      if (showRelationshipNoiseFiles || !isProjectMapRelationshipNoiseFile(file)) {
        roles.add(file.role);
      }
    });
    return Array.from(roles).sort((left, right) => (
      getProjectMapRelationshipRoleRank(left) - getProjectMapRelationshipRoleRank(right)
      || left.localeCompare(right)
    ));
  }, [relationshipDashboardData, showRelationshipNoiseFiles]);

  const relationshipDashboardMatchingFiles = useMemo(() => {
    if (!relationshipDashboardData) {
      return [];
    }
    const query = relationshipDashboardQuery.trim().toLowerCase();
    return relationshipDashboardData.files
      .filter((file) => showRelationshipNoiseFiles || !isProjectMapRelationshipNoiseFile(file))
      .filter((file) => (
        relationshipDashboardRoleFilter === PROJECT_MAP_RELATION_FILTER_ALL
        || file.role === relationshipDashboardRoleFilter
      ))
      .filter((file) => {
        if (!query) {
          return true;
        }
        const moduleLabel = relationshipDashboardModuleByFileId.get(file.id) ?? "";
        return [
          file.path,
          file.basename,
          file.language,
          file.layer,
          file.role,
          moduleLabel,
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftRank = getProjectMapRelationshipRoleRank(left.role);
        const rightRank = getProjectMapRelationshipRoleRank(right.role);
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        const leftCount = relationshipDashboardRelationCountByFile.get(left.id) ?? 0;
        const rightCount = relationshipDashboardRelationCountByFile.get(right.id) ?? 0;
        if (leftCount !== rightCount) {
          return rightCount - leftCount;
        }
        return left.path.localeCompare(right.path);
      });
  }, [
    relationshipDashboardData,
    relationshipDashboardModuleByFileId,
    relationshipDashboardQuery,
    relationshipDashboardRelationCountByFile,
    relationshipDashboardRoleFilter,
    showRelationshipNoiseFiles,
  ]);

  const relationshipDashboardFilteredFiles = useMemo(() => (
    relationshipDashboardMatchingFiles.slice(0, PROJECT_MAP_RELATIONSHIP_TOP_FILE_LIMIT)
  ), [relationshipDashboardMatchingFiles]);

  const relationshipDashboardTopFileGroups = useMemo<ProjectMapRelationshipTopFileRoleGroup[]>(() => {
    const roleGroups = new Map<string, ProjectMapRelationshipTopFileRoleGroup>();
    relationshipDashboardFilteredFiles.forEach((file) => {
      const relationCount = relationshipDashboardRelationCountByFile.get(file.id) ?? 0;
      const roleId = file.role || "unknown";
      const roleGroup = roleGroups.get(roleId) ?? {
        id: roleId,
        label: roleId,
        files: [],
        relationCount: 0,
        moduleGroups: [],
      };
      roleGroup.files.push(file);
      roleGroup.relationCount += relationCount;

      const moduleLabel =
        relationshipDashboardModuleByFileId.get(file.id)
        ?? file.path.split("/").find((part) => part.length > 0)
        ?? file.layer
        ?? "root";
      const moduleId = `${roleId}:${moduleLabel}`;
      let moduleGroup = roleGroup.moduleGroups.find((group) => group.id === moduleId);
      if (!moduleGroup) {
        moduleGroup = {
          id: moduleId,
          label: moduleLabel,
          files: [],
          relationCount: 0,
        };
        roleGroup.moduleGroups.push(moduleGroup);
      }
      moduleGroup.files.push(file);
      moduleGroup.relationCount += relationCount;
      roleGroups.set(roleId, roleGroup);
    });

    return Array.from(roleGroups.values())
      .map((group) => ({
        ...group,
        moduleGroups: group.moduleGroups.sort((left, right) => (
          right.relationCount - left.relationCount
          || right.files.length - left.files.length
          || left.label.localeCompare(right.label)
        )),
      }))
      .sort((left, right) => (
        getProjectMapRelationshipRoleRank(left.id) - getProjectMapRelationshipRoleRank(right.id)
        || right.relationCount - left.relationCount
        || left.label.localeCompare(right.label)
      ));
  }, [
    relationshipDashboardFilteredFiles,
    relationshipDashboardModuleByFileId,
    relationshipDashboardRelationCountByFile,
  ]);

  const relationshipDashboardVisibleFileTotal = relationshipDashboardMatchingFiles.length;

  const selectedRelationshipFile = useMemo(() => {
    if (!relationshipDashboardData?.files.length) {
      return null;
    }
    if (selectedRelationshipFileId) {
      const selectedFile = relationshipDashboardFileIndex.get(selectedRelationshipFileId);
      const selectedFileStillVisible = relationshipDashboardMatchingFiles.some((file) => (
        file.id === selectedRelationshipFileId
      ));
      if (selectedFile && selectedFileStillVisible) {
        return selectedFile;
      }
    }
    return relationshipDashboardFilteredFiles[0] ?? relationshipDashboardMatchingFiles[0] ?? null;
  }, [
    relationshipDashboardData,
    relationshipDashboardFileIndex,
    relationshipDashboardFilteredFiles,
    relationshipDashboardMatchingFiles,
    selectedRelationshipFileId,
  ]);

  const inspectedRelationshipFile = useMemo(() => {
    if (!relationshipDashboardData?.files.length) {
      return null;
    }
    if (inspectedRelationshipFileId) {
      const inspectedFile = relationshipDashboardFileIndex.get(inspectedRelationshipFileId);
      if (inspectedFile) {
        return inspectedFile;
      }
    }
    return selectedRelationshipFile;
  }, [
    inspectedRelationshipFileId,
    relationshipDashboardData,
    relationshipDashboardFileIndex,
    selectedRelationshipFile,
  ]);

  const relationshipDashboardFileTreeGroups = useMemo<ProjectMapRelationshipFileTreeGroup[]>(() => {
    const groups = new Map<string, ProjectMapScannedFile[]>();
    relationshipDashboardMatchingFiles.forEach((file) => {
      const moduleLabel = relationshipDashboardModuleByFileId.get(file.id);
      const pathParts = file.path.split("/").filter((part) => part.length > 0);
      const firstPathSegment = pathParts[0] ?? file.layer ?? file.role ?? "root";
      const groupLabel = moduleLabel ?? firstPathSegment;
      const files = groups.get(groupLabel) ?? [];
      files.push(file);
      groups.set(groupLabel, files);
    });
    return Array.from(groups.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, files]) => ({
        id: label,
        label,
        files,
        relationCount: files.reduce((total, file) => (
          total + (relationshipDashboardRelationCountByFile.get(file.id) ?? 0)
        ), 0),
      }));
  }, [
    relationshipDashboardMatchingFiles,
    relationshipDashboardModuleByFileId,
    relationshipDashboardRelationCountByFile,
  ]);

  const relationshipDashboardExplorerRenderedFileCount = useMemo(() => (
    relationshipDashboardFileTreeGroups.reduce((total, group) => (
      total + (
        expandedRelationshipFileGroups.has(group.id)
          ? group.files.length
          : Math.min(group.files.length, PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT)
      )
    ), 0)
  ), [expandedRelationshipFileGroups, relationshipDashboardFileTreeGroups]);

  return {
    inspectedRelationshipFile,
    relationshipDashboardDirectionCountByFile,
    relationshipDashboardExplorerRenderedFileCount,
    relationshipDashboardFileIndex,
    relationshipDashboardFileTreeGroups,
    relationshipDashboardFilteredFiles,
    relationshipDashboardMatchingFiles,
    relationshipDashboardModuleByFileId,
    relationshipDashboardRelationCountByFile,
    relationshipDashboardRoleOptions,
    relationshipDashboardTopFileGroups,
    relationshipDashboardTypeOptions,
    relationshipDashboardVisibleFileTotal,
    selectedRelationshipFile,
  };
}
