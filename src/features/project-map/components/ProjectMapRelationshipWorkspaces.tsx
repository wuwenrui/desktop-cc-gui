import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

import { cn } from "../../../lib/utils";
import {
  getProjectMapRelationshipCallCandidate,
  getProjectMapRelationshipRoleColor,
  type ProjectMapRelationshipDashboardData,
} from "../utils/relationshipDashboardModel";
import type {
  ProjectMapApiCallChain,
  ProjectMapApiEndpoint,
  ProjectMapApiGroup,
  ProjectMapFileRelation,
  ProjectMapScannedFile,
} from "../types";

type ProjectMapRelationshipDashboardViewMode = "graph" | "files" | "read" | "api";
type ProjectMapRelationshipLayoutPreset = "radial" | "tree" | "force";

type ProjectMapApiGroupWithCount = ProjectMapApiGroup & {
  endpointCount: number;
};

type ProjectMapApiEndpointSection = {
  id: string;
  title: string;
  hint: string;
  endpoints: ProjectMapApiEndpoint[];
};

type ProjectMapRelationshipFileTreeGroup = {
  id: string;
  label: string;
  files: ProjectMapScannedFile[];
  relationCount: number;
};

type ProjectMapRelationshipFileDirectionCount = {
  incoming: number;
  outgoing: number;
};

type ProjectMapRelationshipRelationGroup = {
  id: string;
  title: string;
  relations: ProjectMapFileRelation[];
};

type ProjectMapRelationshipScopeWarning = {
  kind: string;
  path?: string | null;
  message: string;
};

type ProjectMapRelationshipScanStatus = {
  status: "idle" | "running" | "success" | "failed";
};

const PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT = 80;

type ProjectMapRelationshipApiWorkspaceProps = {
  activeWorkspaceId: string | null;
  apiConfidenceFilter: string;
  apiContractScanExists: boolean;
  apiControllerFilter: string;
  apiControllerGroupsByModuleId: ReadonlyMap<string, ProjectMapApiGroupWithCount[]>;
  apiEndpointCount: number;
  apiEndpointSections: ProjectMapApiEndpointSection[];
  apiFilterOptions: {
    protocols: Set<string>;
    languages: Set<string>;
    frameworks: Set<string>;
    modules: Set<string>;
    controllers: Set<string>;
    confidences: Set<string>;
  };
  apiFrameworkFilter: string;
  apiGraphMode: string;
  apiGroups: ProjectMapApiGroupWithCount[];
  apiLanguageFilter: string;
  apiModuleFilter: string;
  apiModuleGroups: ProjectMapApiGroupWithCount[];
  apiProtocolFilter: string;
  apiSearchQuery: string;
  expandedApiModuleGroupIds: ReadonlySet<string>;
  handleRelationshipScanClick: () => void;
  openProjectMapRelationshipPath: (path: string | null | undefined, line?: number | null) => void;
  relationshipDashboardData: ProjectMapRelationshipDashboardData;
  relationshipDashboardLayoutPreset: ProjectMapRelationshipLayoutPreset;
  relationshipGraphZoom: number;
  relationshipScanState: ProjectMapRelationshipScanStatus;
  selectedApiCallChains: ProjectMapApiCallChain[];
  selectedApiEndpoint: ProjectMapApiEndpoint | null;
  selectedApiGroup: ProjectMapApiGroupWithCount | null;
  selectedApiGroupEndpoints: ProjectMapApiEndpoint[];
  selectedApiModuleGroup: ProjectMapApiGroupWithCount | null;
  setApiConfidenceFilter: (value: string) => void;
  setApiControllerFilter: (value: string) => void;
  setApiFrameworkFilter: (value: string) => void;
  setApiLanguageFilter: (value: string) => void;
  setApiModuleFilter: (value: string) => void;
  setApiProtocolFilter: (value: string) => void;
  setExpandedApiModuleGroupIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedApiEndpointId: (value: string | null) => void;
  setSelectedApiGroupId: (value: string | null) => void;
};

export function ProjectMapRelationshipApiWorkspace({
  activeWorkspaceId,
  apiConfidenceFilter,
  apiContractScanExists,
  apiControllerFilter,
  apiControllerGroupsByModuleId,
  apiEndpointCount,
  apiEndpointSections,
  apiFilterOptions,
  apiFrameworkFilter,
  apiGraphMode,
  apiGroups,
  apiLanguageFilter,
  apiModuleFilter,
  apiModuleGroups,
  apiProtocolFilter,
  apiSearchQuery,
  expandedApiModuleGroupIds,
  handleRelationshipScanClick,
  openProjectMapRelationshipPath,
  relationshipDashboardData,
  relationshipDashboardLayoutPreset,
  relationshipGraphZoom,
  relationshipScanState,
  selectedApiCallChains,
  selectedApiEndpoint,
  selectedApiGroup,
  selectedApiGroupEndpoints,
  selectedApiModuleGroup,
  setApiConfidenceFilter,
  setApiControllerFilter,
  setApiFrameworkFilter,
  setApiLanguageFilter,
  setApiModuleFilter,
  setApiProtocolFilter,
  setExpandedApiModuleGroupIds,
  setSelectedApiEndpointId,
  setSelectedApiGroupId,
}: ProjectMapRelationshipApiWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "project-map-api-contract-workspace",
        `is-layout-${relationshipDashboardLayoutPreset}`,
      )}
      style={{ "--relationship-graph-scale": relationshipGraphZoom } as CSSProperties}
    >
      <header className="project-map-relationship-workspace-header project-map-api-contract-toolbar">
        <div className="project-map-api-contract-toolbar-copy">
          <strong>{t("projectMap.relationship.apiWorkspaceTitle")}</strong>
          <span>{t("projectMap.relationship.apiWorkspaceSummary", {
            endpoints: apiEndpointCount,
            groups: apiGroups.length,
            mode: t(`projectMap.relationship.apiGraphMode.${apiGraphMode}`),
          })}</span>
        </div>
        <div className="project-map-api-contract-toolbar-controls">
          <button
            type="button"
            className="project-map-toolbar-action project-map-api-contract-scan-action"
            onClick={handleRelationshipScanClick}
            disabled={!activeWorkspaceId || relationshipScanState.status === "running"}
          >
            <RefreshCw aria-hidden />
            {relationshipScanState.status === "running"
              ? t("projectMap.relationship.scanning")
              : t("projectMap.relationship.apiScan")}
          </button>
          <div className="project-map-api-contract-filters">
            {[
              {
                label: t("projectMap.relationship.apiFilterProtocol"),
                value: apiProtocolFilter,
                onChange: setApiProtocolFilter,
                options: Array.from(apiFilterOptions.protocols),
              },
              {
                label: t("projectMap.relationship.apiFilterLanguage"),
                value: apiLanguageFilter,
                onChange: setApiLanguageFilter,
                options: Array.from(apiFilterOptions.languages),
              },
              {
                label: t("projectMap.relationship.apiFilterFramework"),
                value: apiFrameworkFilter,
                onChange: setApiFrameworkFilter,
                options: Array.from(apiFilterOptions.frameworks),
              },
              {
                label: t("projectMap.relationship.apiFilterModule"),
                value: apiModuleFilter,
                onChange: setApiModuleFilter,
                options: Array.from(apiFilterOptions.modules),
              },
              {
                label: t("projectMap.relationship.apiFilterController"),
                value: apiControllerFilter,
                onChange: setApiControllerFilter,
                options: Array.from(apiFilterOptions.controllers),
              },
              {
                label: t("projectMap.relationship.apiFilterConfidence"),
                value: apiConfidenceFilter,
                onChange: setApiConfidenceFilter,
                options: Array.from(apiFilterOptions.confidences),
              },
            ].map((filter) => (
              <label key={filter.label}>
                <span>{filter.label}</span>
                <select
                  value={filter.value}
                  onChange={(event) => {
                    filter.onChange(event.target.value);
                    setSelectedApiEndpointId(null);
                  }}
                >
                  <option value="all">{t("projectMap.relationship.apiFilterAll")}</option>
                  {filter.options.sort().map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      </header>
      {relationshipDashboardData.apiContracts && apiEndpointCount > 0 ? (
        <div className="project-map-api-contract-grid">
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
                      {expandedApiModuleGroupIds.has(moduleGroup.id) ? "−" : "+"}
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
                        const endpointTitle = endpoint.path
                          ?? endpoint.operationName
                          ?? endpoint.handlerSymbol
                          ?? endpoint.sourceFile;
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
                            <span>{endpoint.method ?? endpoint.protocol}</span>
                            <strong>{endpointTitle}</strong>
                            <em>{endpoint.handlerSymbol ?? endpoint.operationName ?? endpoint.framework ?? endpoint.sourceFile}</em>
                            <small>{endpoint.confidence} · {endpoint.language} · {endpoint.framework ?? "source"}</small>
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
          <aside className="project-map-api-contract-inspector">
            <header>
              <span>{t("projectMap.relationship.apiInspectorTitle")}</span>
              <strong>
                {selectedApiEndpoint?.path
                  ?? selectedApiEndpoint?.operationName
                  ?? selectedApiGroup?.label
                  ?? t("projectMap.relationship.apiInspectorEmpty")}
              </strong>
            </header>
            {selectedApiEndpoint ? (
              <>
                <article className="project-map-api-contract-swagger-card">
                  <div className="project-map-api-contract-operation-line">
                    <span>{selectedApiEndpoint.method ?? selectedApiEndpoint.protocol}</span>
                    <strong>
                      {selectedApiEndpoint.path
                        ?? selectedApiEndpoint.operationName
                        ?? selectedApiEndpoint.handlerSymbol
                        ?? selectedApiEndpoint.sourceFile}
                    </strong>
                  </div>
                  <p>
                    {selectedApiEndpoint.description
                      ?? selectedApiEndpoint.usageScenario
                      ?? selectedApiEndpoint.handlerSymbol
                      ?? selectedApiEndpoint.sourceFile}
                  </p>
                </article>
                <div className="project-map-api-contract-tags">
                  <span>{selectedApiEndpoint.protocol}</span>
                  <span>{selectedApiEndpoint.confidence}</span>
                  <span>{selectedApiEndpoint.language}</span>
                  {selectedApiEndpoint.framework ? <span>{selectedApiEndpoint.framework}</span> : null}
                </div>
                <dl className="project-map-api-contract-detail-list">
                  <div>
                    <dt>{t("projectMap.relationship.apiEndpointHandler")}</dt>
                    <dd>{selectedApiEndpoint.handlerSymbol ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>{t("projectMap.relationship.apiEndpointSource")}</dt>
                    <dd>{selectedApiEndpoint.sourceFile}</dd>
                  </div>
                  <div>
                    <dt>{t("projectMap.relationship.apiEndpointParams")}</dt>
                    <dd>{selectedApiEndpoint.parameters.length}</dd>
                  </div>
                  <div>
                    <dt>{t("projectMap.relationship.apiEndpointResponses")}</dt>
                    <dd>{selectedApiEndpoint.responses.map((response) => response.statusCode ?? response.contentType ?? "response").join(", ") || "-"}</dd>
                  </div>
                </dl>
                <section className="project-map-api-contract-inspector-section">
                  <h5>{t("projectMap.relationship.apiEndpointParams")}</h5>
                  {selectedApiEndpoint.parameters.length ? (
                    <div className="project-map-api-contract-schema-table">
                      <span>{t("projectMap.relationship.apiParamColumnName")}</span>
                      <span>{t("projectMap.relationship.apiParamColumnIn")}</span>
                      <span>{t("projectMap.relationship.apiParamColumnRequired")}</span>
                      <span>{t("projectMap.relationship.apiParamColumnSchema")}</span>
                      {selectedApiEndpoint.parameters.slice(0, 12).flatMap((parameter) => [
                        <strong key={`${parameter.location}:${parameter.name}:name`}>
                          {parameter.name}
                        </strong>,
                        <em key={`${parameter.location}:${parameter.name}:location`}>
                          {parameter.location}
                        </em>,
                        <em key={`${parameter.location}:${parameter.name}:required`}>
                          {parameter.required ? "true" : "false"}
                        </em>,
                        <em key={`${parameter.location}:${parameter.name}:schema`}>
                          {parameter.schema?.name ?? parameter.defaultValue ?? parameter.example ?? "-"}
                        </em>,
                      ])}
                    </div>
                  ) : (
                    <p>{t("projectMap.relationship.apiNoParameters")}</p>
                  )}
                </section>
                <section className="project-map-api-contract-inspector-section">
                  <h5>{t("projectMap.relationship.apiRequestBody")}</h5>
                  {selectedApiEndpoint.requestBody ? (
                    <div className="project-map-api-contract-schema-card">
                      <strong>{selectedApiEndpoint.requestBody.contentType ?? "body"}</strong>
                      <span>{selectedApiEndpoint.requestBody.schema?.name ?? t("projectMap.relationship.apiSchemaUnknown")}</span>
                      {selectedApiEndpoint.requestBody.examples?.slice(0, 2).map((example, index) => (
                        <em key={`${example}:${index}`}>{example}</em>
                      ))}
                    </div>
                  ) : (
                    <p>{t("projectMap.relationship.apiNoRequestBody")}</p>
                  )}
                </section>
                <section className="project-map-api-contract-inspector-section">
                  <h5>{t("projectMap.relationship.apiEndpointResponses")}</h5>
                  {selectedApiEndpoint.responses.length ? (
                    <div className="project-map-api-contract-response-list">
                      {selectedApiEndpoint.responses.slice(0, 8).map((response, index) => (
                        <article key={`${response.statusCode ?? "response"}:${response.contentType ?? index}`}>
                          <strong>{response.statusCode ?? "response"}</strong>
                          <span>{response.contentType ?? t("projectMap.relationship.apiContentTypeUnknown")}</span>
                          <em>{response.schema?.name ?? (response.isError ? "error" : t("projectMap.relationship.apiSchemaUnknown"))}</em>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>{t("projectMap.relationship.apiNoResponses")}</p>
                  )}
                </section>
                {selectedApiEndpoint.description || selectedApiEndpoint.usageScenario ? (
                  <section className="project-map-api-contract-inspector-section">
                    <h5>{t("projectMap.relationship.apiEndpointDescription")}</h5>
                    {selectedApiEndpoint.description ? <p>{selectedApiEndpoint.description}</p> : null}
                    {selectedApiEndpoint.usageScenario ? <p>{selectedApiEndpoint.usageScenario}</p> : null}
                  </section>
                ) : null}
                <section className="project-map-api-contract-evidence">
                  <h5>{t("projectMap.relationship.apiEvidenceTitle")}</h5>
                  {selectedApiEndpoint.evidence.slice(0, 4).map((evidence) => (
                    <button
                      key={`${evidence.path}:${evidence.line ?? 0}:${evidence.parserSource}`}
                      type="button"
                      onClick={() => openProjectMapRelationshipPath(evidence.path, evidence.line)}
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
                <section className="project-map-api-contract-inspector-section">
                  <h5>{t("projectMap.relationship.apiMethodChainTitle")}</h5>
                  {selectedApiCallChains.length ? (
                    <div className="project-map-api-contract-method-chain-list">
                      {selectedApiCallChains.map((chain) => (
                        <article key={chain.id} className="project-map-api-contract-method-chain-card">
                          {chain.truncatedReason ? (
                            <span className="project-map-api-contract-method-chain-warning">
                              {t("projectMap.relationship.apiMethodChainTruncated", {
                                reason: chain.truncatedReason,
                              })}
                            </span>
                          ) : null}
                          {chain.edges.slice(0, 8).map((edge) => (
                            <div key={edge.id} className="project-map-api-contract-method-chain-edge">
                              <div className="project-map-api-contract-method-chain-flow">
                                <span>{t("projectMap.relationship.apiMethodChainSource")}</span>
                                <strong>{edge.sourceSymbol}</strong>
                                <b aria-hidden>{"->"}</b>
                                <span>{t("projectMap.relationship.apiMethodChainTarget")}</span>
                                <strong>{edge.targetSymbol}</strong>
                              </div>
                              <div className="project-map-api-contract-method-chain-meta">
                                <span>{edge.kind}</span>
                                <span>{edge.confidence}</span>
                                <span>{edge.sourceFile}{edge.line ? `:${edge.line}` : ""}</span>
                              </div>
                              {edge.excerpt ? (
                                <code className="project-map-api-contract-method-chain-excerpt">
                                  {edge.excerpt}
                                </code>
                              ) : null}
                            </div>
                          ))}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>
                      {selectedApiEndpoint.callChainUnavailableReason
                        ? t("projectMap.relationship.apiMethodChainUnavailable", {
                            reason: selectedApiEndpoint.callChainUnavailableReason,
                          })
                        : t("projectMap.relationship.apiMethodChainEmpty")}
                    </p>
                  )}
                </section>
              </>
            ) : selectedApiGroup ? (
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
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="project-map-api-contract-empty">
          <strong>
            {apiContractScanExists
              ? t("projectMap.relationship.apiEmptyScannedTitle")
              : t("projectMap.relationship.apiEmptyTitle")}
          </strong>
          <p>
            {apiContractScanExists
              ? t("projectMap.relationship.apiEmptyScannedBody")
              : t("projectMap.relationship.apiEmptyBody")}
          </p>
          <small>
            {apiContractScanExists
              ? t("projectMap.relationship.apiEmptyScannedHint")
              : t("projectMap.relationship.apiEmptyHint")}
          </small>
        </div>
      )}
    </div>
  );
}

type ProjectMapRelationshipFileWorkspaceProps = {
  expandedRelationshipFileGroups: ReadonlySet<string>;
  relationshipDashboardDirectionCountByFile: ReadonlyMap<string, ProjectMapRelationshipFileDirectionCount>;
  relationshipDashboardExplorerRenderedFileCount: number;
  relationshipDashboardFileTreeGroups: ProjectMapRelationshipFileTreeGroup[];
  relationshipDashboardFilteredFiles: ProjectMapScannedFile[];
  relationshipDashboardLayoutPreset: ProjectMapRelationshipLayoutPreset;
  relationshipDashboardScannedFileCount: number;
  relationshipDashboardVisibleFileTotal: number;
  relationshipFilesZoom: number;
  selectedRelationshipFile: ProjectMapScannedFile | null;
  setInspectedRelationshipFileId: (value: string | null) => void;
  setRelationshipDashboardViewMode: (value: ProjectMapRelationshipDashboardViewMode) => void;
  setSelectedRelationshipFileId: (value: string | null) => void;
  setSelectedRelationshipRelationId: (value: string | null) => void;
  toggleRelationshipFileTreeGroup: (groupId: string) => void;
};

export function ProjectMapRelationshipFileWorkspace({
  expandedRelationshipFileGroups,
  relationshipDashboardDirectionCountByFile,
  relationshipDashboardExplorerRenderedFileCount,
  relationshipDashboardFileTreeGroups,
  relationshipDashboardFilteredFiles,
  relationshipDashboardLayoutPreset,
  relationshipDashboardScannedFileCount,
  relationshipDashboardVisibleFileTotal,
  relationshipFilesZoom,
  selectedRelationshipFile,
  setInspectedRelationshipFileId,
  setRelationshipDashboardViewMode,
  setSelectedRelationshipFileId,
  setSelectedRelationshipRelationId,
  toggleRelationshipFileTreeGroup,
}: ProjectMapRelationshipFileWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <div className="project-map-relationship-file-workspace">
      <header className="project-map-relationship-workspace-header">
        <div>
          <strong>{t("projectMap.relationship.filesWorkspaceTitle")}</strong>
          <span>{t("projectMap.relationship.filesWorkspaceSummary", {
            rendered: relationshipDashboardExplorerRenderedFileCount,
            matching: relationshipDashboardVisibleFileTotal,
            scanned: relationshipDashboardScannedFileCount,
          })}</span>
        </div>
        <button
          type="button"
          className="project-map-toolbar-action"
          onClick={() => setRelationshipDashboardViewMode("graph")}
        >
          {t("projectMap.relationship.openGraph")}
        </button>
      </header>
      <div
        className={cn(
          "project-map-relationship-file-tree",
          `is-layout-${relationshipDashboardLayoutPreset}`,
        )}
        style={{ "--relationship-files-scale": relationshipFilesZoom } as CSSProperties}
      >
        <div className="project-map-relationship-file-tree-zoom">
          {relationshipDashboardFileTreeGroups.length ? (
            relationshipDashboardFileTreeGroups.map((group) => (
              <section key={group.id} className="project-map-relationship-file-tree-group">
                <header>
                  <strong>{group.label}</strong>
                  <span>{t("projectMap.relationship.filesTreeGroupStats", {
                    rendered: expandedRelationshipFileGroups.has(group.id)
                      ? group.files.length
                      : Math.min(group.files.length, PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT),
                    files: group.files.length,
                    relations: group.relationCount,
                  })}</span>
                </header>
                <div className="project-map-relationship-file-tree-list">
                  {(expandedRelationshipFileGroups.has(group.id)
                    ? group.files
                    : group.files.slice(0, PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT)
                  ).map((file) => {
                    const directionCount =
                      relationshipDashboardDirectionCountByFile.get(file.id)
                      ?? { incoming: 0, outgoing: 0 };
                    return (
                      <button
                        key={file.id}
                        type="button"
                        className={cn(
                          "project-map-relationship-file-tree-row",
                          selectedRelationshipFile?.id === file.id && "is-active",
                        )}
                        title={file.path}
                        onClick={() => {
                          setSelectedRelationshipFileId(file.id);
                          setInspectedRelationshipFileId(file.id);
                          setSelectedRelationshipRelationId(null);
                          setRelationshipDashboardViewMode("graph");
                        }}
                      >
                        <span
                          style={{
                            "--relationship-node-color": getProjectMapRelationshipRoleColor(file.role),
                          } as CSSProperties}
                        />
                        <div>
                          <strong>{file.basename}</strong>
                          <em>{file.path}</em>
                        </div>
                        <small>
                          {t("projectMap.relationship.graphFileLanguageDirectionSummary", {
                            role: file.role,
                            language: file.language,
                            incoming: directionCount.incoming,
                            outgoing: directionCount.outgoing,
                          })}
                        </small>
                      </button>
                    );
                  })}
                  {group.files.length > PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT ? (
                    <button
                      type="button"
                      className="project-map-relationship-file-tree-row"
                      onClick={() => toggleRelationshipFileTreeGroup(group.id)}
                    >
                      <strong>
                        {expandedRelationshipFileGroups.has(group.id)
                          ? t("projectMap.relationship.filesTreeGroupCollapse")
                          : t("projectMap.relationship.filesTreeGroupMore", {
                              count: group.files.length - PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT,
                            })}
                      </strong>
                      <em>{t("projectMap.relationship.filesTreeGroupSearchHint")}</em>
                    </button>
                  ) : null}
                </div>
              </section>
            ))
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.noFiles")}
            </p>
          )}
        </div>
      </div>
      {relationshipDashboardVisibleFileTotal > relationshipDashboardFilteredFiles.length ? (
        <p className="project-map-relationship-list-cap">
          {t("projectMap.relationship.listCap", {
            visible: relationshipDashboardFilteredFiles.length,
            total: relationshipDashboardVisibleFileTotal,
          })}
        </p>
      ) : null}
    </div>
  );
}

type ProjectMapRelationshipReadWorkspaceProps = {
  inspectedRelationshipFile: ProjectMapScannedFile | null;
  relationshipDashboardData: ProjectMapRelationshipDashboardData;
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
  relationshipDashboardModuleByFileId: ReadonlyMap<string, string>;
  selectedRelationshipRelation: ProjectMapFileRelation | null;
  selectedRelationshipRelationGroups: ProjectMapRelationshipRelationGroup[];
  selectedRelationshipScopeWarnings: ProjectMapRelationshipScopeWarning[];
  setRelationshipDashboardViewMode: (value: ProjectMapRelationshipDashboardViewMode) => void;
  setSelectedRelationshipRelationId: (value: string | null) => void;
};

export function ProjectMapRelationshipReadWorkspace({
  inspectedRelationshipFile,
  relationshipDashboardData,
  relationshipDashboardFileIndex,
  relationshipDashboardModuleByFileId,
  selectedRelationshipRelation,
  selectedRelationshipRelationGroups,
  selectedRelationshipScopeWarnings,
  setRelationshipDashboardViewMode,
  setSelectedRelationshipRelationId,
}: ProjectMapRelationshipReadWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <div className="project-map-relationship-read-workspace">
      <section className="project-map-relationship-read-main">
        <header className="project-map-relationship-workspace-header">
          <div>
            <strong>{t("projectMap.relationship.readWorkspaceTitle")}</strong>
            <span>
              {inspectedRelationshipFile
                ? inspectedRelationshipFile.path
                : t("projectMap.relationship.readWorkspaceEmpty")}
            </span>
          </div>
          <button
            type="button"
            className="project-map-toolbar-action"
            onClick={() => setRelationshipDashboardViewMode("graph")}
          >
            {t("projectMap.relationship.openGraph")}
          </button>
        </header>
        {inspectedRelationshipFile ? (
          <article className="project-map-relationship-read-profile">
            <span>{t("projectMap.relationship.readFileProfile")}</span>
            <strong>{inspectedRelationshipFile.basename}</strong>
            <p>{inspectedRelationshipFile.path}</p>
            <div>
              <small>{inspectedRelationshipFile.role}</small>
              <small>{inspectedRelationshipFile.language}</small>
              <small>{relationshipDashboardModuleByFileId.get(inspectedRelationshipFile.id) ?? inspectedRelationshipFile.layer}</small>
              <small>{inspectedRelationshipFile.parseStatus}</small>
            </div>
          </article>
        ) : null}
        <div className="project-map-relationship-read-relation-groups">
          <h5>{t("projectMap.relationship.readRelationshipSections")}</h5>
          {selectedRelationshipRelationGroups.length ? (
            selectedRelationshipRelationGroups.map((group) => (
              <section key={group.id} className="project-map-relationship-read-relation-group">
                <header>
                  <strong>{group.title}</strong>
                  <span>{t("projectMap.relationship.chainGroupCount", {
                    count: group.relations.length,
                  })}</span>
                </header>
                {group.relations.slice(0, 8).map((relation) => {
                  const sourceFile = relationshipDashboardFileIndex.get(relation.sourceFileId);
                  const targetFile = relationshipDashboardFileIndex.get(relation.targetFileId);
                  const callCandidate = getProjectMapRelationshipCallCandidate(relation);
                  const evidence = relation.evidence[0];
                  return (
                    <button
                      key={relation.id}
                      type="button"
                      className={cn(
                        "project-map-relationship-read-edge-row",
                        selectedRelationshipRelation?.id === relation.id && "is-active",
                      )}
                      onClick={() => setSelectedRelationshipRelationId(relation.id)}
                    >
                      <span>{relation.type === "calls" ? t("projectMap.relationship.methodCall") : relation.type}</span>
                      <strong>{sourceFile?.basename ?? relation.sourceFileId} {"->"} {targetFile?.basename ?? relation.targetFileId}</strong>
                      {callCandidate ? <em>{callCandidate}</em> : null}
                      {evidence ? (
                        <small>
                          {evidence.path}
                          {evidence.line ? ":" + evidence.line : ""}
                        </small>
                      ) : null}
                    </button>
                  );
                })}
              </section>
            ))
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.noNeighborhood")}
            </p>
          )}
        </div>
      </section>
      <aside className="project-map-relationship-read-side">
        <section>
          <h5>{t("projectMap.relationship.readContextTitle")}</h5>
          {relationshipDashboardData.contextPack ? (
            <>
              <div className="project-map-relationship-read-chip-list">
                <strong>{t("projectMap.relationship.readMustReadTitle")}</strong>
                {relationshipDashboardData.contextPack.mustReadFiles.slice(0, 8).map((item) => (
                  <span key={"must:" + item}>{item}</span>
                ))}
              </div>
              <div className="project-map-relationship-read-chip-list">
                <strong>{t("projectMap.relationship.readRelatedTitle")}</strong>
                {relationshipDashboardData.contextPack.relatedFiles.slice(0, 8).map((item) => (
                  <span key={"related:" + item}>{item}</span>
                ))}
              </div>
              <div className="project-map-relationship-read-chip-list">
                <strong>{t("projectMap.relationship.readTestsTitle")}</strong>
                {relationshipDashboardData.contextPack.testTargets.slice(0, 6).map((item) => (
                  <span key={"test:" + item}>{item}</span>
                ))}
              </div>
              <div className="project-map-relationship-read-chip-list">
                <strong>{t("projectMap.relationship.readContractsTitle")}</strong>
                {relationshipDashboardData.contextPack.contracts.slice(0, 6).map((item) => (
                  <span key={"contract:" + item}>{item}</span>
                ))}
              </div>
              {relationshipDashboardData.contextPack.riskFlags.length ? (
                <div className="project-map-relationship-read-chip-list is-risk">
                  <strong>{t("projectMap.relationship.readRiskTitle")}</strong>
                  {relationshipDashboardData.contextPack.riskFlags.slice(0, 6).map((flag) => (
                    <span key={flag.severity + ":" + flag.label}>{flag.severity} · {flag.label}</span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.readPlanEmpty")}
            </p>
          )}
        </section>
        <section>
          <h5>{t("projectMap.relationship.readImpactTitle")}</h5>
          {relationshipDashboardData.impactSummary ? (
            <div className="project-map-relationship-read-metrics">
              <span>{relationshipDashboardData.impactSummary.changedFiles.length}{t("projectMap.relationship.impactChanged")}</span>
              <span>{relationshipDashboardData.impactSummary.directlyAffectedFiles.length}{t("projectMap.relationship.impactDirect")}</span>
              <span>{relationshipDashboardData.impactSummary.transitivelyAffectedFiles.length}{t("projectMap.relationship.impactTransitive")}</span>
              <span>{relationshipDashboardData.impactSummary.unmappedFiles.length}{t("projectMap.relationship.impactUnmapped")}</span>
            </div>
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.impactEmpty")}
            </p>
          )}
        </section>
        {selectedRelationshipScopeWarnings.length ? (
          <section>
            <h5>{t("projectMap.relationship.readScopeTitle")}</h5>
            <div className="project-map-relationship-read-chip-list is-warning">
              {selectedRelationshipScopeWarnings.slice(0, 4).map((reason) => (
                <span key={reason.kind + ":" + (reason.path ?? reason.message)}>
                  {reason.path ?? reason.message}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
