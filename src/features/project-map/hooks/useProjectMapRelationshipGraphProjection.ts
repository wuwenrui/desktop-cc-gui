import { useCallback, useMemo } from "react";
import type { TFunction } from "i18next";

import {
  buildProjectMapRelationshipGraphProjection,
} from "../components/projectMapRelationshipGraphProjection";
import {
  getProjectMapRelationshipConfidenceRank,
  getProjectMapRelationshipTypeRank,
  type ProjectMapRelationshipDashboardData,
} from "../utils/relationshipDashboardModel";
import type {
  ProjectMapFileRelation,
  ProjectMapScannedFile,
} from "../types";

export type ProjectMapRelationshipRelationGroup = {
  id: string;
  title: string;
  relations: ProjectMapFileRelation[];
};

type ProjectMapRelationshipGraphProjectionInput = {
  inspectedRelationshipFile: ProjectMapScannedFile | null;
  relationshipDashboardData: ProjectMapRelationshipDashboardData | null;
  relationshipDashboardDirectionCountByFile: ReadonlyMap<string, { incoming: number; outgoing: number }>;
  relationshipDashboardFilteredFiles: ProjectMapScannedFile[];
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
  relationshipDashboardLayoutPreset: "radial" | "tree" | "force";
  relationshipDashboardRelationCountByFile: ReadonlyMap<string, number>;
  relationshipDashboardTypeFilter: string;
  relationshipGraphExpandedSide: "incoming" | "outgoing" | null;
  selectedRelationshipFile: ProjectMapScannedFile | null;
  selectedRelationshipRelationId: string | null;
  t: TFunction;
};

const PROJECT_MAP_RELATION_FILTER_ALL = "all";
const PROJECT_MAP_RELATIONSHIP_EDGE_LIMIT = 80;

export function useProjectMapRelationshipGraphProjection({
  inspectedRelationshipFile,
  relationshipDashboardData,
  relationshipDashboardDirectionCountByFile,
  relationshipDashboardFilteredFiles,
  relationshipDashboardFileIndex,
  relationshipDashboardLayoutPreset,
  relationshipDashboardRelationCountByFile,
  relationshipDashboardTypeFilter,
  relationshipGraphExpandedSide,
  selectedRelationshipFile,
  selectedRelationshipRelationId,
  t,
}: ProjectMapRelationshipGraphProjectionInput) {
  const resolveRelationshipRelationsForFile = useCallback((
    file: ProjectMapScannedFile | null,
    options?: { ignoreTypeFilter?: boolean },
  ) => {
    if (!relationshipDashboardData || !file) {
      return [];
    }
    const selectedFileId = file.id;
    return relationshipDashboardData.relations
      .filter((relation) => {
        const isSelectedEdge =
          relation.sourceFileId === selectedFileId
          || relation.targetFileId === selectedFileId;
        const typeMatches =
          options?.ignoreTypeFilter
          || relationshipDashboardTypeFilter === PROJECT_MAP_RELATION_FILTER_ALL
          || relation.type === relationshipDashboardTypeFilter;
        return isSelectedEdge && typeMatches;
      })
      .sort((left, right) => {
        const leftFlowRank =
          left.type === "calls" ? 0 : left.sourceFileId === selectedFileId ? 1 : 2;
        const rightFlowRank =
          right.type === "calls" ? 0 : right.sourceFileId === selectedFileId ? 1 : 2;
        return (
          leftFlowRank - rightFlowRank
          || getProjectMapRelationshipTypeRank(left.type) - getProjectMapRelationshipTypeRank(right.type)
          || getProjectMapRelationshipConfidenceRank(left.confidence) - getProjectMapRelationshipConfidenceRank(right.confidence)
          || left.id.localeCompare(right.id)
        );
      })
      .slice(0, PROJECT_MAP_RELATIONSHIP_EDGE_LIMIT);
  }, [relationshipDashboardData, relationshipDashboardTypeFilter]);

  const selectedRelationshipRelations = useMemo(
    () => resolveRelationshipRelationsForFile(selectedRelationshipFile),
    [resolveRelationshipRelationsForFile, selectedRelationshipFile],
  );

  const inspectedRelationshipRelations = useMemo(
    () => resolveRelationshipRelationsForFile(inspectedRelationshipFile),
    [inspectedRelationshipFile, resolveRelationshipRelationsForFile],
  );

  const inspectedRelationshipRelationsNoTypeFilter = useMemo(
    () => resolveRelationshipRelationsForFile(inspectedRelationshipFile, { ignoreTypeFilter: true }),
    [inspectedRelationshipFile, resolveRelationshipRelationsForFile],
  );

  const selectedRelationshipRelationGroups = useMemo<ProjectMapRelationshipRelationGroup[]>(() => {
    if (!inspectedRelationshipFile) {
      return [];
    }
    const groups = [
      {
        id: "calls",
        title: t("projectMap.relationship.chainGroupCalls"),
        relations: [] as ProjectMapFileRelation[],
      },
      {
        id: "outgoing",
        title: t("projectMap.relationship.chainGroupOutgoing"),
        relations: [] as ProjectMapFileRelation[],
      },
      {
        id: "incoming",
        title: t("projectMap.relationship.chainGroupIncoming"),
        relations: [] as ProjectMapFileRelation[],
      },
      {
        id: "other",
        title: t("projectMap.relationship.chainGroupOther"),
        relations: [] as ProjectMapFileRelation[],
      },
    ];
    inspectedRelationshipRelations.forEach((relation) => {
      if (relation.type === "calls") {
        groups[0].relations.push(relation);
        return;
      }
      if (relation.sourceFileId === inspectedRelationshipFile.id) {
        groups[1].relations.push(relation);
        return;
      }
      if (relation.targetFileId === inspectedRelationshipFile.id) {
        groups[2].relations.push(relation);
        return;
      }
      groups[3].relations.push(relation);
    });
    return groups.filter((group) => group.relations.length);
  }, [inspectedRelationshipFile, inspectedRelationshipRelations, t]);

  const relationshipDashboardGraph = useMemo(() => {
    if (!selectedRelationshipFile || !relationshipDashboardData) {
      return null;
    }
    return buildProjectMapRelationshipGraphProjection({
      selectedRelationshipFile,
      selectedRelationshipRelations,
      relationshipDashboardFilteredFiles,
      relationshipDashboardFileIndex,
      relationshipDashboardDirectionCountByFile,
      relationshipDashboardRelationCountByFile,
      relationshipDashboardLayoutPreset,
      relationshipGraphExpandedSide,
      selectedRelationshipRelationId,
    });
  }, [
    relationshipDashboardData,
    relationshipDashboardDirectionCountByFile,
    relationshipDashboardFilteredFiles,
    relationshipDashboardFileIndex,
    relationshipDashboardLayoutPreset,
    relationshipDashboardRelationCountByFile,
    relationshipGraphExpandedSide,
    selectedRelationshipFile,
    selectedRelationshipRelationId,
    selectedRelationshipRelations,
  ]);

  const selectedRelationshipRelation = useMemo(() => {
    if (!inspectedRelationshipRelations.length && !inspectedRelationshipRelationsNoTypeFilter.length) {
      return null;
    }
    if (selectedRelationshipRelationId) {
      const selectedRelation = inspectedRelationshipRelations.find(
        (relation) => relation.id === selectedRelationshipRelationId,
      );
      if (selectedRelation) {
        return selectedRelation;
      }
      const selectedRelationWithoutTypeFilter = inspectedRelationshipRelationsNoTypeFilter.find(
        (relation) => relation.id === selectedRelationshipRelationId,
      );
      if (selectedRelationWithoutTypeFilter) {
        return selectedRelationWithoutTypeFilter;
      }
    }
    return inspectedRelationshipRelations.find((relation) => relation.type === "calls")
      ?? inspectedRelationshipRelations[0]
      ?? inspectedRelationshipRelationsNoTypeFilter.find((relation) => relation.type === "calls")
      ?? inspectedRelationshipRelationsNoTypeFilter[0]
      ?? null;
  }, [inspectedRelationshipRelations, inspectedRelationshipRelationsNoTypeFilter, selectedRelationshipRelationId]);

  return {
    inspectedRelationshipRelations,
    relationshipDashboardGraph,
    selectedRelationshipRelation,
    selectedRelationshipRelationGroups,
    selectedRelationshipRelations,
  };
}
