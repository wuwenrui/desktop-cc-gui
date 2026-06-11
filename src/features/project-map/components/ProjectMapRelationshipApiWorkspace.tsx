import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";
import { ProjectMapRelationshipApiEndpointStage } from "./ProjectMapRelationshipApiEndpointStage";
import { ProjectMapRelationshipApiGroupRail } from "./ProjectMapRelationshipApiGroupRail";
import { ProjectMapRelationshipApiInspector } from "./ProjectMapRelationshipApiInspector";
import { ProjectMapRelationshipApiToolbar } from "./ProjectMapRelationshipApiToolbar";
import {
  buildProjectMapApiExportFile,
  type ProjectMapApiExportFormat,
} from "../utils/apiContractExport";
import { useProjectMapApiPaneResize } from "../hooks/useProjectMapApiPaneResize";
import type {
  ProjectMapRelationshipApiWorkspaceProps,
} from "./ProjectMapRelationshipApiTypes";

function downloadProjectMapApiExport(file: { filename: string; mimeType: string; content: string }) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

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
  const [apiInspectorFocused, setApiInspectorFocused] = useState(false);
  const {
    apiContractWorkspaceRef,
    apiPaneStyle,
    beginApiPaneResize,
  } = useProjectMapApiPaneResize(relationshipGraphZoom);
  useEffect(() => {
    setApiInspectorFocused(false);
  }, [selectedApiEndpoint?.id, selectedApiGroup?.id]);
  const handleApiExport = useCallback((format: ProjectMapApiExportFormat) => {
    if (!relationshipDashboardData.apiContracts) {
      return;
    }
    downloadProjectMapApiExport(buildProjectMapApiExportFile(relationshipDashboardData.apiContracts, format));
  }, [relationshipDashboardData.apiContracts]);
  const openApiInspectorPath = useCallback((path: string | null | undefined, line?: number | null) => {
    setApiInspectorFocused(true);
    openProjectMapRelationshipPath(path, line);
  }, [openProjectMapRelationshipPath]);
  const primaryApiFilters = [
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
  ];
  const advancedApiFilters = [
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
  ];

  return (
    <div
      ref={apiContractWorkspaceRef}
      className={cn(
        "project-map-api-contract-workspace",
        `is-layout-${relationshipDashboardLayoutPreset}`,
        apiInspectorFocused && "is-inspector-focused",
      )}
      style={apiPaneStyle}
    >
      <ProjectMapRelationshipApiToolbar
        activeWorkspaceId={activeWorkspaceId}
        advancedApiFilters={advancedApiFilters}
        apiEndpointCount={apiEndpointCount}
        apiGraphMode={apiGraphMode}
        apiGroups={apiGroups}
        handleApiExport={handleApiExport}
        handleRelationshipScanClick={handleRelationshipScanClick}
        primaryApiFilters={primaryApiFilters}
        relationshipDashboardData={relationshipDashboardData}
        relationshipScanState={relationshipScanState}
        setSelectedApiEndpointId={setSelectedApiEndpointId}
      />
      {relationshipDashboardData.apiContracts && apiEndpointCount > 0 ? (
        <div className="project-map-api-contract-grid">
          <ProjectMapRelationshipApiGroupRail
            apiControllerGroupsByModuleId={apiControllerGroupsByModuleId}
            apiModuleGroups={apiModuleGroups}
            expandedApiModuleGroupIds={expandedApiModuleGroupIds}
            selectedApiGroup={selectedApiGroup}
            selectedApiModuleGroup={selectedApiModuleGroup}
            setExpandedApiModuleGroupIds={setExpandedApiModuleGroupIds}
            setSelectedApiEndpointId={setSelectedApiEndpointId}
            setSelectedApiGroupId={setSelectedApiGroupId}
          />
          <div
            className="project-map-api-contract-resizer"
            role="separator"
            aria-label={t("projectMap.relationship.apiResizeLeft")}
            onPointerDown={(event) => beginApiPaneResize("left", event)}
          />
          <ProjectMapRelationshipApiEndpointStage
            apiEndpointSections={apiEndpointSections}
            apiSearchQuery={apiSearchQuery}
            selectedApiEndpoint={selectedApiEndpoint}
            selectedApiGroup={selectedApiGroup}
            selectedApiGroupEndpoints={selectedApiGroupEndpoints}
            selectedApiModuleGroup={selectedApiModuleGroup}
            setSelectedApiEndpointId={setSelectedApiEndpointId}
          />
          <div
            className="project-map-api-contract-resizer"
            role="separator"
            aria-label={t("projectMap.relationship.apiResizeRight")}
            onPointerDown={(event) => beginApiPaneResize("right", event)}
          />
          <ProjectMapRelationshipApiInspector
            apiInspectorFocused={apiInspectorFocused}
            onApiInspectorFocusToggle={() => setApiInspectorFocused((current) => !current)}
            openApiInspectorPath={openApiInspectorPath}
            selectedApiCallChains={selectedApiCallChains}
            selectedApiEndpoint={selectedApiEndpoint}
            selectedApiGroup={selectedApiGroup}
          />
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
