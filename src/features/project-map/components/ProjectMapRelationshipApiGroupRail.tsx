import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";
import type { ProjectMapApiGroupRailProps } from "./ProjectMapRelationshipApiTypes";

export function ProjectMapRelationshipApiGroupRail({
  apiControllerGroupsByModuleId,
  apiModuleGroups,
  expandedApiModuleGroupIds,
  selectedApiGroup,
  selectedApiModuleGroup,
  setExpandedApiModuleGroupIds,
  setSelectedApiEndpointId,
  setSelectedApiGroupId,
}: ProjectMapApiGroupRailProps) {
  const { t } = useTranslation();

  return (
    <section className="project-map-api-contract-group-rail">
      <header>
        <strong>{t("projectMap.relationship.apiModulesTitle")}</strong>
        <span>{t("projectMap.relationship.apiModulesHint")}</span>
      </header>
      <div className="project-map-api-contract-module-tree">
        {apiModuleGroups.slice(0, 42).map((moduleGroup) => (
          <section
            key={moduleGroup.id}
            className={cn(
              "project-map-api-contract-module-branch",
              selectedApiModuleGroup?.id === moduleGroup.id && "is-active",
            )}
          >
            <button
              type="button"
              className="project-map-api-contract-module-button"
              aria-expanded={expandedApiModuleGroupIds.has(moduleGroup.id)}
              onClick={() => {
                setSelectedApiGroupId(moduleGroup.id);
                setSelectedApiEndpointId(null);
                setExpandedApiModuleGroupIds((current) => {
                  const next = new Set(current);
                  if (next.has(moduleGroup.id)) {
                    next.delete(moduleGroup.id);
                  } else {
                    next.add(moduleGroup.id);
                  }
                  return next;
                });
              }}
            >
              <b aria-hidden>
                {expandedApiModuleGroupIds.has(moduleGroup.id) ? "-" : "+"}
              </b>
              <span>{moduleGroup.level}</span>
              <strong>{moduleGroup.label}</strong>
              <em>{t("projectMap.relationship.apiGroupStats", {
                endpoints: moduleGroup.endpointCount,
                children: moduleGroup.childGroupIds.length,
              })}</em>
            </button>
            {expandedApiModuleGroupIds.has(moduleGroup.id) ? (
              <div className="project-map-api-contract-controller-list">
                {(apiControllerGroupsByModuleId.get(moduleGroup.id) ?? []).slice(0, 32).map((controllerGroup) => (
                  <button
                    key={controllerGroup.id}
                    type="button"
                    className={cn(selectedApiGroup?.id === controllerGroup.id && "is-active")}
                    onClick={() => {
                      setSelectedApiGroupId(controllerGroup.id);
                      setSelectedApiEndpointId(null);
                    }}
                  >
                    <span>{controllerGroup.level}</span>
                    <strong>{controllerGroup.label}</strong>
                    <em>{t("projectMap.relationship.apiGroupStats", {
                      endpoints: controllerGroup.endpointCount,
                      children: controllerGroup.childGroupIds.length,
                    })}</em>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </section>
  );
}
