import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ProjectMapRelationshipApiEvidenceSection } from "./ProjectMapRelationshipApiEvidenceSection";
import { ProjectMapRelationshipApiGroupSummary } from "./ProjectMapRelationshipApiGroupSummary";
import {
  buildProjectMapApiMethodChainTree,
  ProjectMapRelationshipApiMethodChainSection,
} from "./ProjectMapRelationshipApiMethodChainSection";
import { ProjectMapRelationshipApiOverviewSection } from "./ProjectMapRelationshipApiOverviewSection";
import { ProjectMapRelationshipApiParameterSection } from "./ProjectMapRelationshipApiParameterSection";
import { ProjectMapRelationshipApiResponseSection } from "./ProjectMapRelationshipApiResponseSection";
import {
  buildProjectMapApiEndpointDetail,
  type ProjectMapApiGroupWithCount,
} from "./projectMapRelationshipApiModel";
import type { ProjectMapApiInspectorPathOpener } from "./ProjectMapRelationshipApiTypes";
import type {
  ProjectMapApiCallChain,
  ProjectMapApiEndpoint,
} from "../types";

type ProjectMapRelationshipApiInspectorProps = {
  apiInspectorFocused: boolean;
  selectedApiCallChains: ProjectMapApiCallChain[];
  selectedApiEndpoint: ProjectMapApiEndpoint | null;
  selectedApiGroup: ProjectMapApiGroupWithCount | null;
  onApiInspectorFocusToggle: () => void;
  openApiInspectorPath: ProjectMapApiInspectorPathOpener;
};

export function ProjectMapRelationshipApiInspector({
  apiInspectorFocused,
  onApiInspectorFocusToggle,
  openApiInspectorPath,
  selectedApiCallChains,
  selectedApiEndpoint,
  selectedApiGroup,
}: ProjectMapRelationshipApiInspectorProps) {
  const { t } = useTranslation();
  const selectedApiEndpointDetail = useMemo(
    () => selectedApiEndpoint ? buildProjectMapApiEndpointDetail(selectedApiEndpoint) : null,
    [selectedApiEndpoint],
  );
  const selectedApiMethodChainTrees = useMemo(() => (
    selectedApiCallChains.map((chain) => ({
      chain,
      roots: buildProjectMapApiMethodChainTree(chain, selectedApiEndpoint?.handlerSymbol),
    }))
  ), [selectedApiCallChains, selectedApiEndpoint?.handlerSymbol]);

  return (
    <aside className="project-map-api-contract-inspector">
      <header>
        <div>
          <span>{t("projectMap.relationship.apiInspectorTitle")}</span>
          <button
            type="button"
            className="project-map-api-contract-inspector-focus-toggle"
            onClick={onApiInspectorFocusToggle}
          >
            {apiInspectorFocused
              ? t("projectMap.relationship.apiInspectorExitFocus")
              : t("projectMap.relationship.apiInspectorFocus")}
          </button>
        </div>
        {selectedApiEndpoint ? null : (
          <strong>{selectedApiGroup?.label ?? t("projectMap.relationship.apiInspectorEmpty")}</strong>
        )}
      </header>
      {selectedApiEndpoint && selectedApiEndpointDetail ? (
        <>
          <ProjectMapRelationshipApiOverviewSection
            selectedApiEndpoint={selectedApiEndpoint}
            selectedApiEndpointDetail={selectedApiEndpointDetail}
          />
          <ProjectMapRelationshipApiParameterSection selectedApiEndpointDetail={selectedApiEndpointDetail} />
          <ProjectMapRelationshipApiResponseSection selectedApiEndpointDetail={selectedApiEndpointDetail} />
          <ProjectMapRelationshipApiEvidenceSection
            openApiInspectorPath={openApiInspectorPath}
            selectedApiEndpoint={selectedApiEndpoint}
          />
          <ProjectMapRelationshipApiMethodChainSection
            openApiInspectorPath={openApiInspectorPath}
            selectedApiCallChains={selectedApiCallChains}
            selectedApiEndpoint={selectedApiEndpoint}
            selectedApiMethodChainTrees={selectedApiMethodChainTrees}
          />
        </>
      ) : selectedApiGroup ? (
        <ProjectMapRelationshipApiGroupSummary selectedApiGroup={selectedApiGroup} />
      ) : null}
    </aside>
  );
}
