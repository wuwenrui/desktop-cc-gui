import { useTranslation } from "react-i18next";

import type { ProjectMapApiInspectorPathOpener } from "./ProjectMapRelationshipApiTypes";
import type { ProjectMapApiEndpoint } from "../types";

type ProjectMapRelationshipApiEvidenceSectionProps = {
  openApiInspectorPath: ProjectMapApiInspectorPathOpener;
  selectedApiEndpoint: ProjectMapApiEndpoint;
};

export function ProjectMapRelationshipApiEvidenceSection({
  openApiInspectorPath,
  selectedApiEndpoint,
}: ProjectMapRelationshipApiEvidenceSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="project-map-api-contract-evidence">
      <h5>{t("projectMap.relationship.apiEvidenceTitle")}</h5>
      {selectedApiEndpoint.evidence.slice(0, 4).map((evidence) => (
        <button
          key={`${evidence.path}:${evidence.line ?? 0}:${evidence.parserSource}`}
          type="button"
          onClick={() => openApiInspectorPath(evidence.path, evidence.line)}
        >
          <span>{evidence.parserSource}{evidence.redacted ? " · redacted" : ""}</span>
          <strong>{evidence.path}{evidence.line ? `:${evidence.line}` : ""}</strong>
          {evidence.excerpt ? <em>{evidence.excerpt}</em> : null}
        </button>
      ))}
      {!selectedApiEndpoint.evidence.length ? (
        <p>{t("projectMap.relationship.apiEvidenceEmpty")}</p>
      ) : null}
    </section>
  );
}
