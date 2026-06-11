import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import {
  projectMapApiEndpointMatchesQuery,
  projectMapApiGroupMatchesQuery,
  type ProjectMapApiEndpointSection,
  type ProjectMapApiGroupWithCount,
} from "../components/projectMapRelationshipApiModel";
import type {
  ProjectMapApiFilterOptions,
} from "../components/ProjectMapRelationshipApiTypes";
import type {
  ProjectMapApiEndpoint,
} from "../types";
import type { ProjectMapRelationshipDashboardData } from "../utils/relationshipDashboardModel";

type ProjectMapRelationshipDashboardViewMode = "graph" | "files" | "read" | "api";

type ProjectMapRelationshipApiProjectionInput = {
  apiConfidenceFilter: string;
  apiControllerFilter: string;
  apiFrameworkFilter: string;
  apiLanguageFilter: string;
  apiModuleFilter: string;
  apiProtocolFilter: string;
  relationshipDashboardData: ProjectMapRelationshipDashboardData | null;
  relationshipDashboardQuery: string;
  relationshipDashboardViewMode: ProjectMapRelationshipDashboardViewMode;
  selectedApiEndpointId: string | null;
  selectedApiGroupId: string | null;
  setExpandedApiModuleGroupIds: Dispatch<SetStateAction<Set<string>>>;
};

export function useProjectMapRelationshipApiProjection({
  apiConfidenceFilter,
  apiControllerFilter,
  apiFrameworkFilter,
  apiLanguageFilter,
  apiModuleFilter,
  apiProtocolFilter,
  relationshipDashboardData,
  relationshipDashboardQuery,
  relationshipDashboardViewMode,
  selectedApiEndpointId,
  selectedApiGroupId,
  setExpandedApiModuleGroupIds,
}: ProjectMapRelationshipApiProjectionInput) {
  const { t } = useTranslation();
  const apiEndpointById = useMemo(() => {
    const index = new Map<string, ProjectMapApiEndpoint>();
    relationshipDashboardData?.apiContracts?.endpoints.forEach((endpoint) => {
      index.set(endpoint.id, endpoint);
    });
    return index;
  }, [relationshipDashboardData?.apiContracts?.endpoints]);

  const apiSearchQuery = relationshipDashboardViewMode === "api"
    ? relationshipDashboardQuery.trim().toLowerCase()
    : "";

  const apiFilterOptions = useMemo<ProjectMapApiFilterOptions>(() => {
    const apiContracts = relationshipDashboardData?.apiContracts;
    const options = {
      protocols: new Set<string>(),
      languages: new Set<string>(),
      frameworks: new Set<string>(),
      modules: new Set<string>(),
      controllers: new Set<string>(),
      confidences: new Set<string>(),
    };
    if (!apiContracts) {
      return options;
    }
    const groupIndex = new Map(apiContracts.groups.map((group) => [group.id, group]));
    apiContracts.endpoints.forEach((endpoint) => {
      options.protocols.add(endpoint.protocol);
      options.languages.add(endpoint.language);
      if (endpoint.framework) {
        options.frameworks.add(endpoint.framework);
      }
      options.confidences.add(endpoint.confidence);
      endpoint.groupIds.forEach((groupId) => {
        const group = groupIndex.get(groupId);
        if (group?.level === "module") {
          options.modules.add(group.label);
        }
        if (group?.level === "controller") {
          options.controllers.add(group.label);
        }
      });
    });
    return options;
  }, [relationshipDashboardData?.apiContracts]);

  const apiSearchProjection = useMemo(() => {
    const apiContracts = relationshipDashboardData?.apiContracts;
    const visibleEndpointIds = new Set<string>();
    const visibleGroupIds = new Set<string>();
    if (!apiContracts) {
      return { visibleEndpointIds, visibleGroupIds };
    }

    const groupIndex = new Map(apiContracts.groups.map((group) => [group.id, group]));
    const addGroupWithAncestors = (groupId: string) => {
      let currentGroupId: string | undefined = groupId;
      while (currentGroupId) {
        const group = groupIndex.get(currentGroupId);
        if (!group || visibleGroupIds.has(group.id)) {
          break;
        }
        visibleGroupIds.add(group.id);
        currentGroupId = group.parentId;
      }
    };
    const addGroupWithDescendants = (groupId: string) => {
      const group = groupIndex.get(groupId);
      if (!group) {
        return;
      }
      visibleGroupIds.add(group.id);
      group.endpointIds.forEach((endpointId) => visibleEndpointIds.add(endpointId));
      group.childGroupIds.forEach(addGroupWithDescendants);
    };

    const endpointMatchesFilters = (endpoint: ProjectMapApiEndpoint) => {
      const matchesModule = apiModuleFilter === "all"
        || endpoint.groupIds.some((groupId) => {
          const group = groupIndex.get(groupId);
          return group?.level === "module" && group.label === apiModuleFilter;
        });
      const matchesController = apiControllerFilter === "all"
        || endpoint.groupIds.some((groupId) => {
          const group = groupIndex.get(groupId);
          return group?.level === "controller" && group.label === apiControllerFilter;
        });
      return (apiProtocolFilter === "all" || endpoint.protocol === apiProtocolFilter)
        && (apiLanguageFilter === "all" || endpoint.language === apiLanguageFilter)
        && (apiFrameworkFilter === "all" || endpoint.framework === apiFrameworkFilter)
        && (apiConfidenceFilter === "all" || endpoint.confidence === apiConfidenceFilter)
        && matchesModule
        && matchesController
        && (!apiSearchQuery || projectMapApiEndpointMatchesQuery(endpoint, apiSearchQuery));
    };

    const hasStructuredFilter = [
      apiProtocolFilter,
      apiLanguageFilter,
      apiFrameworkFilter,
      apiModuleFilter,
      apiControllerFilter,
      apiConfidenceFilter,
    ].some((value) => value !== "all");

    if (!apiSearchQuery && !hasStructuredFilter) {
      apiContracts.groups.forEach((group) => visibleGroupIds.add(group.id));
      apiContracts.endpoints.forEach((endpoint) => visibleEndpointIds.add(endpoint.id));
      return { visibleEndpointIds, visibleGroupIds };
    }

    if (apiSearchQuery && !hasStructuredFilter) {
      apiContracts.groups.forEach((group) => {
        if (!projectMapApiGroupMatchesQuery(group, apiSearchQuery)) {
          return;
        }
        addGroupWithAncestors(group.id);
        addGroupWithDescendants(group.id);
      });
    }

    apiContracts.endpoints.forEach((endpoint) => {
      if (!endpointMatchesFilters(endpoint)) {
        return;
      }
      visibleEndpointIds.add(endpoint.id);
      endpoint.groupIds.forEach(addGroupWithAncestors);
    });

    return { visibleEndpointIds, visibleGroupIds };
  }, [
    apiConfidenceFilter,
    apiControllerFilter,
    apiFrameworkFilter,
    apiLanguageFilter,
    apiModuleFilter,
    apiProtocolFilter,
    apiSearchQuery,
    relationshipDashboardData?.apiContracts,
  ]);

  const apiGroups = useMemo<ProjectMapApiGroupWithCount[]>(() => {
    const apiContracts = relationshipDashboardData?.apiContracts;
    if (!apiContracts) {
      return [];
    }
    const endpointCounts = new Map<string, number>();
    apiContracts.endpoints.forEach((endpoint) => {
      if (!apiSearchProjection.visibleEndpointIds.has(endpoint.id)) {
        return;
      }
      endpoint.groupIds.forEach((groupId) => {
        endpointCounts.set(groupId, (endpointCounts.get(groupId) ?? 0) + 1);
      });
    });
    return apiContracts.groups
      .filter((group) => apiSearchProjection.visibleGroupIds.has(group.id))
      .map((group) => ({
        ...group,
        endpointCount: endpointCounts.get(group.id)
          ?? group.endpointIds.filter((endpointId) => apiSearchProjection.visibleEndpointIds.has(endpointId)).length,
      }))
      .sort((left, right) => (
        left.level.localeCompare(right.level)
        || right.endpointCount - left.endpointCount
        || left.label.localeCompare(right.label)
      ));
  }, [apiSearchProjection, relationshipDashboardData?.apiContracts]);

  const apiGroupById = useMemo(() => {
    const index = new Map<string, ProjectMapApiGroupWithCount>();
    apiGroups.forEach((group) => {
      index.set(group.id, group);
    });
    return index;
  }, [apiGroups]);

  const apiModuleGroups = useMemo(() => {
    const modules = apiGroups.filter((group) => group.level === "module");
    return modules.length ? modules : apiGroups.filter((group) => group.level !== "endpoint");
  }, [apiGroups]);

  const selectedApiModuleGroup = useMemo(() => {
    if (!apiModuleGroups.length) {
      return null;
    }
    if (selectedApiGroupId) {
      const selected = apiGroupById.get(selectedApiGroupId);
      if (selected?.level === "module") {
        return selected;
      }
      const parent = selected?.parentId ? apiGroupById.get(selected.parentId) : null;
      if (parent?.level === "module") {
        return parent;
      }
    }
    return apiModuleGroups[0] ?? null;
  }, [apiGroupById, apiModuleGroups, selectedApiGroupId]);

  const apiControllerGroups = useMemo(() => {
    if (!selectedApiModuleGroup) {
      return apiGroups.filter((group) => group.level === "controller");
    }
    const childGroups = selectedApiModuleGroup.childGroupIds
      .map((groupId) => apiGroupById.get(groupId))
      .filter((group): group is ProjectMapApiGroupWithCount => Boolean(group))
      .filter((group) => group.level === "controller");
    if (childGroups.length) {
      return childGroups.sort((left, right) => (
        right.endpointCount - left.endpointCount || left.label.localeCompare(right.label)
      ));
    }
    return apiGroups
      .filter((group) => group.parentId === selectedApiModuleGroup.id)
      .sort((left, right) => (
        right.endpointCount - left.endpointCount || left.label.localeCompare(right.label)
      ));
  }, [apiGroupById, apiGroups, selectedApiModuleGroup]);

  const apiControllerGroupsByModuleId = useMemo(() => {
    const index = new Map<string, ProjectMapApiGroupWithCount[]>();
    apiModuleGroups.forEach((moduleGroup) => {
      const controllers = moduleGroup.childGroupIds
        .map((groupId) => apiGroupById.get(groupId))
        .filter((group): group is ProjectMapApiGroupWithCount => Boolean(group))
        .filter((group) => group.level === "controller")
        .sort((left, right) => (
          right.endpointCount - left.endpointCount || left.label.localeCompare(right.label)
        ));
      index.set(moduleGroup.id, controllers);
    });
    return index;
  }, [apiGroupById, apiModuleGroups]);

  useEffect(() => {
    if (!apiModuleGroups.length) {
      setExpandedApiModuleGroupIds((current) => (current.size ? new Set() : current));
      return;
    }
    setExpandedApiModuleGroupIds((current) => {
      const next = new Set<string>();
      current.forEach((groupId) => {
        if (apiGroupById.has(groupId)) {
          next.add(groupId);
        }
      });
      if (!next.size) {
        next.add(apiModuleGroups[0].id);
      }
      if (next.size === current.size && Array.from(next).every((groupId) => current.has(groupId))) {
        return current;
      }
      return next;
    });
  }, [apiGroupById, apiModuleGroups, setExpandedApiModuleGroupIds]);

  const selectedApiGroup = useMemo(() => {
    if (!apiGroups.length) {
      return null;
    }
    if (selectedApiGroupId) {
      const selected = apiGroups.find((group) => group.id === selectedApiGroupId);
      if (selected) {
        return selected;
      }
    }
    return apiControllerGroups[0] ?? selectedApiModuleGroup ?? apiGroups[0] ?? null;
  }, [apiControllerGroups, apiGroups, selectedApiGroupId, selectedApiModuleGroup]);

  const selectedApiGroupEndpoints = useMemo(() => {
    const endpoints = (relationshipDashboardData?.apiContracts?.endpoints ?? [])
      .filter((endpoint) => apiSearchProjection.visibleEndpointIds.has(endpoint.id));
    if (!selectedApiGroup) {
      return endpoints.slice(0, 30);
    }
    const groupEndpointIds = new Set(selectedApiGroup.endpointIds);
    return endpoints.filter((endpoint) => (
      groupEndpointIds.has(endpoint.id) || endpoint.groupIds.includes(selectedApiGroup.id)
    ));
  }, [apiSearchProjection, relationshipDashboardData?.apiContracts?.endpoints, selectedApiGroup]);

  const apiEndpointSections = useMemo<ProjectMapApiEndpointSection[]>(() => {
    const sectionMap = new Map<string, ProjectMapApiEndpoint[]>();
    selectedApiGroupEndpoints.forEach((endpoint) => {
      const sectionKey = (endpoint.method ?? endpoint.protocol ?? "api").toUpperCase();
      const endpoints = sectionMap.get(sectionKey) ?? [];
      endpoints.push(endpoint);
      sectionMap.set(sectionKey, endpoints);
    });
    return Array.from(sectionMap.entries())
      .sort(([left], [right]) => {
        const priority = ["GET", "POST", "PUT", "PATCH", "DELETE"];
        const leftRank = priority.indexOf(left);
        const rightRank = priority.indexOf(right);
        return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank)
          || left.localeCompare(right);
      })
      .map(([title, endpoints]) => ({
        id: title,
        title,
        hint: t("projectMap.relationship.apiEndpointSectionHint", { count: endpoints.length }),
        endpoints: endpoints.sort((left, right) => (
          (left.path ?? left.operationName ?? left.handlerSymbol ?? left.id)
            .localeCompare(right.path ?? right.operationName ?? right.handlerSymbol ?? right.id)
        )),
      }));
  }, [selectedApiGroupEndpoints, t]);

  const selectedApiEndpoint = useMemo(() => {
    if (selectedApiEndpointId) {
      const selected = apiEndpointById.get(selectedApiEndpointId);
      const selectedStillVisible = selectedApiGroupEndpoints.some((endpoint) => endpoint.id === selectedApiEndpointId);
      if (selected && selectedStillVisible) {
        return selected;
      }
    }
    return apiEndpointSections[0]?.endpoints[0] ?? null;
  }, [apiEndpointById, apiEndpointSections, selectedApiEndpointId, selectedApiGroupEndpoints]);

  const selectedApiCallChains = useMemo(() => {
    const callChains = relationshipDashboardData?.apiContracts?.callChains ?? [];
    if (!selectedApiEndpoint) {
      return [];
    }
    const selectedChainIds = new Set(selectedApiEndpoint.callChainIds);
    return callChains.filter((chain) => chain.endpointId === selectedApiEndpoint.id || selectedChainIds.has(chain.id));
  }, [relationshipDashboardData?.apiContracts?.callChains, selectedApiEndpoint]);

  const apiEndpointCount = relationshipDashboardData?.apiContracts?.endpoints.length ?? 0;
  const apiContractScanExists = Boolean(relationshipDashboardData?.apiContracts);
  const apiGraphMode =
    apiEndpointCount > 50 ? "group-only" : apiEndpointCount > 30 ? "selected-group" : "endpoint-direct";

  return {
    apiContractScanExists,
    apiControllerGroupsByModuleId,
    apiEndpointCount,
    apiEndpointSections,
    apiFilterOptions,
    apiGraphMode,
    apiGroups,
    apiModuleGroups,
    apiSearchQuery,
    selectedApiCallChains,
    selectedApiEndpoint,
    selectedApiGroup,
    selectedApiGroupEndpoints,
    selectedApiModuleGroup,
  };
}
