import { useTranslation } from "react-i18next";

import type { ProjectMapApiEndpointDetail } from "./projectMapRelationshipApiModel";

type ProjectMapRelationshipApiParameterSectionProps = {
  selectedApiEndpointDetail: ProjectMapApiEndpointDetail;
};

export function ProjectMapRelationshipApiParameterSection({
  selectedApiEndpointDetail,
}: ProjectMapRelationshipApiParameterSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="project-map-api-contract-inspector-section">
      <h5>{t("projectMap.relationship.apiEndpointParams")}</h5>
      {selectedApiEndpointDetail.inputParameters.length ? (
        <div className="project-map-api-contract-parameter-list">
          {selectedApiEndpointDetail.inputParameters.map((parameter) => (
            <article key={`${parameter.location}:${parameter.name}`} className="project-map-api-contract-parameter-card">
              <div>
                <span>{parameter.location}</span>
                <strong>{parameter.name}</strong>
                <em>{parameter.type}{parameter.required ? " · required" : ""}</em>
              </div>
              {parameter.description ? <p>{parameter.description}</p> : null}
              {parameter.defaultValue || parameter.example ? (
                <small>
                  {parameter.defaultValue ? `default: ${parameter.defaultValue}` : ""}
                  {parameter.defaultValue && parameter.example ? " · " : ""}
                  {parameter.example ? `example: ${parameter.example}` : ""}
                </small>
              ) : null}
              {parameter.fields.length ? (
                <div className="project-map-api-contract-field-table">
                  <span>{t("projectMap.relationship.apiParamColumnName")}</span>
                  <span>{t("projectMap.relationship.apiParamColumnSchema")}</span>
                  <span>{t("projectMap.relationship.apiParamColumnRequired")}</span>
                  <span>{t("projectMap.relationship.apiParamColumnDescription")}</span>
                  {parameter.fields.slice(0, 24).flatMap((field) => [
                    <strong key={`${parameter.name}:${field.path}:name`} style={{ paddingLeft: `${6 + field.depth * 12}px` }}>
                      {field.path}
                    </strong>,
                    <em key={`${parameter.name}:${field.path}:type`}>{field.type ?? "-"}</em>,
                    <em key={`${parameter.name}:${field.path}:required`}>{field.required ? "true" : "false"}</em>,
                    <em key={`${parameter.name}:${field.path}:description`}>
                      {field.description ?? field.defaultValue ?? field.example ?? "-"}
                    </em>,
                  ])}
                </div>
              ) : (
                <p>{t("projectMap.relationship.apiParamFieldsUnavailable")}</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p>{t("projectMap.relationship.apiNoParameters")}</p>
      )}
    </section>
  );
}
