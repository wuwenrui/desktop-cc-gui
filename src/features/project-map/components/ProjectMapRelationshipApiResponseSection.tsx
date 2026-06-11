import { useTranslation } from "react-i18next";

import type { ProjectMapApiEndpointDetail } from "./projectMapRelationshipApiModel";

type ProjectMapRelationshipApiResponseSectionProps = {
  selectedApiEndpointDetail: ProjectMapApiEndpointDetail;
};

export function ProjectMapRelationshipApiResponseSection({
  selectedApiEndpointDetail,
}: ProjectMapRelationshipApiResponseSectionProps) {
  const { t } = useTranslation();
  const errorResponses = selectedApiEndpointDetail.responses.filter((response) => response.isError);

  return (
    <>
      <section className="project-map-api-contract-inspector-section">
        <h5>{t("projectMap.relationship.apiEndpointResponses")}</h5>
        {selectedApiEndpointDetail.responses.length ? (
          <div className="project-map-api-contract-response-list">
            {selectedApiEndpointDetail.responses.map((response, responseIndex) => (
              <article key={`${response.statusCode}:${response.rawType}:${responseIndex}`}>
                <div className="project-map-api-contract-response-head">
                  <strong>{response.statusCode}</strong>
                  <span>{response.contentType}</span>
                </div>
                <em className="project-map-api-contract-response-schema">
                  {response.rawType}
                  {response.businessType !== response.rawType ? ` · data: ${response.businessType}` : ""}
                  {response.description ? ` · ${response.description}` : ""}
                </em>
                {response.fields.length ? (
                  <div className="project-map-api-contract-response-fields">
                    {response.fields.slice(0, 16).map((field, fieldIndex) => (
                      <div key={`${response.statusCode}:${field.path}:${fieldIndex}`}>
                        <code>{field.path}</code>
                        {field.type ? <span>{field.type}</span> : null}
                        {field.description ? <p>{field.description}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p>{t("projectMap.relationship.apiNoResponses")}</p>
        )}
      </section>
      <section className="project-map-api-contract-inspector-section">
        <h5>{t("projectMap.relationship.apiErrorCodesTitle")}</h5>
        {errorResponses.length ? (
          <div className="project-map-api-contract-response-list">
            {errorResponses.map((response, responseIndex) => (
              <article key={`error:${response.statusCode}:${responseIndex}`}>
                <strong>{response.statusCode}</strong>
                <span>{response.description ?? t("projectMap.relationship.apiDeclaredUnavailable")}</span>
                <em>{t("projectMap.relationship.apiErrorHandlingHint")}</em>
              </article>
            ))}
          </div>
        ) : (
          <p>{t("projectMap.relationship.apiNoErrorCodes")}</p>
        )}
      </section>
      <section className="project-map-api-contract-inspector-section">
        <h5>{t("projectMap.relationship.apiEndpointDescription")}</h5>
        {selectedApiEndpointDetail.descriptionBlocks.length ? (
          selectedApiEndpointDetail.descriptionBlocks.map((block) => (
            <p key={`${block.kind}:${block.text}`}>{block.kind} · {block.text}</p>
          ))
        ) : (
          <p>{t("projectMap.relationship.apiDescriptionUnavailable")}</p>
        )}
      </section>
    </>
  );
}
