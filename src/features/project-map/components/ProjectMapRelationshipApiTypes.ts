import type { Dispatch, SetStateAction } from "react";

import type {
  ProjectMapApiEndpointSection,
  ProjectMapApiGroupWithCount,
} from "./projectMapRelationshipApiModel";
import type { ProjectMapRelationshipDashboardData } from "../utils/relationshipDashboardModel";
import type {
  ProjectMapApiCallChain,
  ProjectMapApiEndpoint,
} from "../types";

export type ProjectMapRelationshipLayoutPreset = "radial" | "tree" | "force";

export type ProjectMapApiInspectorPathOpener = (
  path: string | null | undefined,
  line?: number | null,
) => void;

export type ProjectMapRelationshipScanStatus = {
  status: "idle" | "running" | "success" | "failed";
};

export type ProjectMapApiFilterOptions = {
  protocols: Set<string>;
  languages: Set<string>;
  frameworks: Set<string>;
  modules: Set<string>;
  controllers: Set<string>;
  confidences: Set<string>;
};

export type ProjectMapApiMethodChainTreeNode = {
  symbol: string;
  incomingEdge?: ProjectMapApiCallChain["edges"][number];
  children: ProjectMapApiMethodChainTreeNode[];
};

export type ProjectMapApiFilterControl = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
};

export type ProjectMapApiWorkspaceCommonProps = {
  activeWorkspaceId: string | null;
  apiEndpointCount: number;
  apiGroups: ProjectMapApiGroupWithCount[];
  apiGraphMode: string;
  relationshipDashboardData: ProjectMapRelationshipDashboardData;
  relationshipScanState: ProjectMapRelationshipScanStatus;
  handleRelationshipScanClick: () => void;
  setSelectedApiEndpointId: (value: string | null) => void;
};

export type ProjectMapApiWorkspaceSelectionProps = {
  apiEndpointSections: ProjectMapApiEndpointSection[];
  apiSearchQuery: string;
  selectedApiEndpoint: ProjectMapApiEndpoint | null;
  selectedApiGroup: ProjectMapApiGroupWithCount | null;
  selectedApiGroupEndpoints: ProjectMapApiEndpoint[];
  selectedApiModuleGroup: ProjectMapApiGroupWithCount | null;
  setSelectedApiEndpointId: (value: string | null) => void;
};

export type ProjectMapApiGroupRailProps = {
  apiControllerGroupsByModuleId: ReadonlyMap<string, ProjectMapApiGroupWithCount[]>;
  apiModuleGroups: ProjectMapApiGroupWithCount[];
  expandedApiModuleGroupIds: ReadonlySet<string>;
  selectedApiGroup: ProjectMapApiGroupWithCount | null;
  selectedApiModuleGroup: ProjectMapApiGroupWithCount | null;
  setExpandedApiModuleGroupIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedApiEndpointId: (value: string | null) => void;
  setSelectedApiGroupId: (value: string | null) => void;
};

export type ProjectMapRelationshipApiWorkspaceProps = {
  activeWorkspaceId: string | null;
  apiConfidenceFilter: string;
  apiContractScanExists: boolean;
  apiControllerFilter: string;
  apiControllerGroupsByModuleId: ReadonlyMap<string, ProjectMapApiGroupWithCount[]>;
  apiEndpointCount: number;
  apiEndpointSections: ProjectMapApiEndpointSection[];
  apiFilterOptions: ProjectMapApiFilterOptions;
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
