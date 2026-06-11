import { useTranslation } from "react-i18next";

import type { ProjectMapApiEndpointDetail } from "./projectMapRelationshipApiModel";
import type { ProjectMapApiEndpoint } from "../types";

type ProjectMapRelationshipApiOverviewSectionProps = {
  selectedApiEndpoint: ProjectMapApiEndpoint;
  selectedApiEndpointDetail: ProjectMapApiEndpointDetail;
};

export function ProjectMapRelationshipApiOverviewSection({
  selectedApiEndpoint,
  selectedApiEndpointDetail,
}: ProjectMapRelationshipApiOverviewSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <article className="project-map-api-contract-swagger-card">
        <div className="project-map-api-contract-operation-line">
          <span>{selectedApiEndpointDetail.invocation.httpMethod}</span>
          <strong>{selectedApiEndpointDetail.invocation.url}</strong>
        </div>
        <p>{selectedApiEndpointDetail.overview.description ?? t("projectMap.relationship.apiDescriptionUnavailable")}</p>
        <div className="project-map-api-contract-endpoint-meta">
          <span>{selectedApiEndpoint.protocol}</span>
          <span>{selectedApiEndpoint.confidence}</span>
          <span>{selectedApiEndpoint.language}</span>
          {selectedApiEndpoint.framework ? <span>{selectedApiEndpoint.framework}</span> : null}
          <em>
            {t("projectMap.relationship.apiTrustEvidenceSummary", {
              count: selectedApiEndpoint.evidence.length,
              sources: Array.from(new Set(selectedApiEndpoint.evidence.map((entry) => entry.parserSource))).join(", ")
                || t("projectMap.relationship.apiTrustEvidenceUnavailable"),
            })}
          </em>
        </div>
      </article>
      <section className="project-map-api-contract-inspector-section project-map-api-contract-overview-section">
        <h5>{t("projectMap.relationship.apiOverviewTitle")}</h5>
        <dl className="project-map-api-contract-detail-list project-map-api-contract-overview-list project-map-api-contract-invocation-list">
          <div>
            <dt>{t("projectMap.relationship.apiOverviewName")}</dt>
            <dd>{selectedApiEndpointDetail.overview.interfaceName}</dd>
          </div>
          <div>
            <dt>{t("projectMap.relationship.apiOverviewMethodName")}</dt>
            <dd>{selectedApiEndpointDetail.overview.methodName}</dd>
          </div>
          <div>
            <dt>{t("projectMap.relationship.apiOverviewChineseComment")}</dt>
            <dd>{selectedApiEndpointDetail.overview.chineseComment ?? t("projectMap.relationship.apiDescriptionUnavailable")}</dd>
          </div>
          <div>
            <dt>{t("projectMap.relationship.apiOverviewScenario")}</dt>
            <dd>{selectedApiEndpointDetail.overview.scenario ?? t("projectMap.relationship.apiDeclaredUnavailable")}</dd>
          </div>
          <div>
            <dt>{t("projectMap.relationship.apiOverviewVersion")}</dt>
            <dd>{selectedApiEndpointDetail.overview.version ?? t("projectMap.relationship.apiDeclaredUnavailable")}</dd>
          </div>
        </dl>
      </section>
      <section className="project-map-api-contract-inspector-section project-map-api-contract-overview-section">
        <h5>{t("projectMap.relationship.apiInvocationTitle")}</h5>
        <dl className="project-map-api-contract-detail-list project-map-api-contract-overview-list">
          <div>
            <dt>{t("projectMap.relationship.apiInvocationMethod")}</dt>
            <dd>{selectedApiEndpointDetail.invocation.httpMethod}</dd>
          </div>
          <div>
            <dt>{t("projectMap.relationship.apiInvocationUrl")}</dt>
            <dd>{selectedApiEndpointDetail.invocation.url}</dd>
          </div>
          <div>
            <dt>{t("projectMap.relationship.apiInvocationContentType")}</dt>
            <dd>{selectedApiEndpointDetail.invocation.contentType}</dd>
          </div>
          <div>
            <dt>{t("projectMap.relationship.apiInvocationHeaders")}</dt>
            <dd>
              {selectedApiEndpointDetail.invocation.headers.length
                ? selectedApiEndpointDetail.invocation.headers.map((header) => header.name).join(", ")
                : t("projectMap.relationship.apiNoHeaders")}
            </dd>
          </div>
        </dl>
        {selectedApiEndpointDetail.invocation.requestExample ? (
          <code className="project-map-api-contract-example">
            {selectedApiEndpointDetail.invocation.requestExample}
          </code>
        ) : null}
      </section>
    </>
  );
}
