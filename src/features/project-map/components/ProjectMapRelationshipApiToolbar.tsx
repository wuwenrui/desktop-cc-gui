import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { useTranslation } from "react-i18next";

import type { ProjectMapApiExportFormat } from "../utils/apiContractExport";
import type {
  ProjectMapApiFilterControl,
  ProjectMapApiWorkspaceCommonProps,
} from "./ProjectMapRelationshipApiTypes";

type ProjectMapRelationshipApiToolbarProps = ProjectMapApiWorkspaceCommonProps & {
  primaryApiFilters: ProjectMapApiFilterControl[];
  advancedApiFilters: ProjectMapApiFilterControl[];
  handleApiExport: (format: ProjectMapApiExportFormat) => void;
};

function ProjectMapApiFilterSelect({
  filter,
  onEndpointSelectionReset,
}: {
  filter: ProjectMapApiFilterControl;
  onEndpointSelectionReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <label>
      <span>{filter.label}</span>
      <select
        value={filter.value}
        onChange={(event) => {
          filter.onChange(event.target.value);
          onEndpointSelectionReset();
        }}
      >
        <option value="all">{t("projectMap.relationship.apiFilterAll")}</option>
        {filter.options.sort().map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export function ProjectMapRelationshipApiToolbar({
  activeWorkspaceId,
  advancedApiFilters,
  apiEndpointCount,
  apiGraphMode,
  apiGroups,
  handleApiExport,
  handleRelationshipScanClick,
  primaryApiFilters,
  relationshipDashboardData,
  relationshipScanState,
  setSelectedApiEndpointId,
}: ProjectMapRelationshipApiToolbarProps) {
  const { t } = useTranslation();
  const resetEndpointSelection = () => setSelectedApiEndpointId(null);

  return (
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
        <div className="project-map-api-contract-filters">
          <span className="project-map-api-contract-filter-group-label">
            {t("projectMap.relationship.apiPrimaryFilters")}
          </span>
          {primaryApiFilters.map((filter) => (
            <ProjectMapApiFilterSelect
              key={filter.label}
              filter={filter}
              onEndpointSelectionReset={resetEndpointSelection}
            />
          ))}
          <details className="project-map-api-contract-advanced-filters">
            <summary>{t("projectMap.relationship.apiAdvancedFilters")}</summary>
            <div>
              <div className="project-map-api-contract-export-actions" aria-label={t("projectMap.relationship.apiExportLabel")}>
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
                {([
                  ["markdown", t("projectMap.relationship.apiExportMarkdown")],
                  ["html", t("projectMap.relationship.apiExportHtml")],
                  ["openapi-json", t("projectMap.relationship.apiExportOpenApiJson")],
                ] as const).map(([format, label]) => (
                  <button
                    key={format}
                    type="button"
                    className="project-map-toolbar-action project-map-api-contract-export-action"
                    disabled={!relationshipDashboardData.apiContracts || !apiEndpointCount}
                    onClick={() => handleApiExport(format)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {advancedApiFilters.map((filter) => (
                <ProjectMapApiFilterSelect
                  key={filter.label}
                  filter={filter}
                  onEndpointSelectionReset={resetEndpointSelection}
                />
              ))}
            </div>
          </details>
        </div>
      </div>
      <small className="project-map-api-contract-export-caveat">
        {t("projectMap.relationship.apiExportCaveat")}
      </small>
    </header>
  );
}
