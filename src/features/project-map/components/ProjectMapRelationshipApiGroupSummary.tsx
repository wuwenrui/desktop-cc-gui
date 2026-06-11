import { useTranslation } from "react-i18next";

import type { ProjectMapApiGroupWithCount } from "./projectMapRelationshipApiModel";

type ProjectMapRelationshipApiGroupSummaryProps = {
  selectedApiGroup: ProjectMapApiGroupWithCount;
};

export function ProjectMapRelationshipApiGroupSummary({
  selectedApiGroup,
}: ProjectMapRelationshipApiGroupSummaryProps) {
  const { t } = useTranslation();

  return (
    <div className="project-map-api-contract-group-summary">
      <span>{selectedApiGroup.level}</span>
      <strong>{selectedApiGroup.label}</strong>
      <p>{t("projectMap.relationship.apiGroupInspectorSummary", {
        endpoints: selectedApiGroup.endpointCount,
        children: selectedApiGroup.childGroupIds.length,
      })}</p>
      <div className="project-map-api-contract-distribution">
        <h5>{t("projectMap.relationship.apiDistributionProtocol")}</h5>
        <div className="project-map-api-contract-chip-list">
          {Object.entries(selectedApiGroup.protocolCounts ?? {}).map(([key, value]) => (
            <span key={`protocol:${key}`}>{key} · {value}</span>
          ))}
        </div>
        <h5>{t("projectMap.relationship.apiDistributionLanguage")}</h5>
        <div className="project-map-api-contract-chip-list">
          {Object.entries(selectedApiGroup.languageCounts ?? {}).map(([key, value]) => (
            <span key={`language:${key}`}>{key} · {value}</span>
          ))}
        </div>
        <h5>{t("projectMap.relationship.apiDistributionConfidence")}</h5>
        <div className="project-map-api-contract-chip-list">
          {Object.entries(selectedApiGroup.confidenceCounts ?? {}).map(([key, value]) => (
            <span key={`confidence:${key}`}>{key} · {value}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
