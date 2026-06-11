import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";
import { buildProjectMapApiEndpointRow } from "./projectMapRelationshipApiModel";
import type { ProjectMapApiWorkspaceSelectionProps } from "./ProjectMapRelationshipApiTypes";

export function ProjectMapRelationshipApiEndpointStage({
  apiEndpointSections,
  apiSearchQuery,
  selectedApiEndpoint,
  selectedApiGroup,
  selectedApiGroupEndpoints,
  selectedApiModuleGroup,
  setSelectedApiEndpointId,
}: ProjectMapApiWorkspaceSelectionProps) {
  const { t } = useTranslation();

  return (
    <section className="project-map-api-contract-stage">
      <div className="project-map-api-contract-breadcrumb">
        <span>{t("projectMap.relationship.apiBreadcrumbRoot")}</span>
        {selectedApiModuleGroup ? <strong>{selectedApiModuleGroup.label}</strong> : null}
        {selectedApiGroup && selectedApiGroup.id !== selectedApiModuleGroup?.id
          ? <strong>{selectedApiGroup.label}</strong>
          : null}
      </div>
      <div className="project-map-api-contract-stage-summary">
        <strong>
          {selectedApiGroup?.label
            ?? selectedApiModuleGroup?.label
            ?? t("projectMap.relationship.apiBreadcrumbRoot")}
        </strong>
        <span>{t("projectMap.relationship.apiStageEndpointSummary", {
          endpoints: selectedApiGroupEndpoints.length,
          sections: apiEndpointSections.length,
        })}</span>
      </div>
      {apiEndpointSections.length ? (
        <div className="project-map-api-contract-node-layer is-endpoints">
          {apiEndpointSections.slice(0, 8).map((section) => (
            <section key={section.id} className="project-map-api-contract-endpoint-section">
              <header>
                <strong>{section.title}</strong>
                <span>{section.hint}</span>
              </header>
              <div className="project-map-api-contract-endpoint-grid">
                {section.endpoints.slice(0, 36).map((endpoint) => {
                  const endpointRow = buildProjectMapApiEndpointRow(endpoint);
                  return (
                    <button
                      key={`endpoint:${endpoint.id}`}
                      type="button"
                      className={cn(
                        "project-map-api-contract-endpoint-node",
                        selectedApiEndpoint?.id === endpoint.id && "is-active",
                      )}
                      onClick={() => setSelectedApiEndpointId(endpoint.id)}
                    >
                      <span>{endpointRow.methodLabel}</span>
                      <strong>{endpointRow.pathLabel}</strong>
                      <em>{endpointRow.summary ?? endpointRow.handlerLabel ?? endpoint.sourceFile}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="project-map-api-contract-stage-empty">
          {apiSearchQuery
            ? t("projectMap.relationship.apiSearchEmpty")
            : t("projectMap.relationship.apiNoEndpointsInGroup")}
        </p>
      )}
    </section>
  );
}
