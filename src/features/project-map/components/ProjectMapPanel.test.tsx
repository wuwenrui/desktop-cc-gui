// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockProjectMapData } from "../mockProjectMapData";
import type { ProjectMapDatasetController } from "../hooks/useProjectMapDataset";
import type { ProjectMapDataset, ProjectMapNode, ProjectMapRunMetadata } from "../types";
import { PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID } from "../utils/incrementalGeneration";
import { ProjectMapPanel } from "./ProjectMapPanel";

function renderMockProjectMapPanel(
  props: Partial<ComponentProps<typeof ProjectMapPanel>> = {},
) {
  return render(<ProjectMapPanel workspaceName="mossx" dataset={mockProjectMapData} {...props} />);
}

function expandCanvasControls() {
  fireEvent.click(screen.getByRole("button", { name: "projectMap.expandCanvasControls" }));
}

function createDatasetControllerMock(
  overrides: Partial<ProjectMapDatasetController> = {},
): ProjectMapDatasetController {
  return {
    dataset: mockProjectMapData,
    status: "persisted",
    storageDir: "/repo/mossx/.ccgui/project-map/mossx-test",
    activeReadLocation: "global",
    error: null,
    pendingRequest: null,
    reload: vi.fn(async () => undefined),
    switchReadLocation: vi.fn(),
    openGlobalCollection: vi.fn(),
    openUnassignedOrganizer: vi.fn(),
    openNodeGeneration: vi.fn(),
    openRefreshEvidence: vi.fn(),
    closeGenerationRequest: vi.fn(),
    confirmGenerationRequest: vi.fn(async () => undefined),
    cancelGenerationRun: vi.fn(async () => undefined),
    clearFinishedRuns: vi.fn(async () => undefined),
    confirmCandidate: vi.fn(async () => true),
    confirmAllCandidates: vi.fn(async () => ({ confirmed: 0, skipped: 0, errors: [] })),
    rejectCandidate: vi.fn(async () => true),
    confirmNodeCandidate: vi.fn(async () => true),
    rejectNodeCandidate: vi.fn(async () => true),
    deleteNode: vi.fn(async () => true),
    updateDataset: vi.fn(async () => undefined),
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

function getGraphNodeBounds(nodeElement: Element): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const element = nodeElement as HTMLElement;
  const centerX = Number.parseFloat(element.style.left);
  const centerY = Number.parseFloat(element.style.top);
  const width = element.classList.contains("is-core")
    ? 220
    : element.classList.contains("is-hub")
      ? 176
      : 168;
  const height = element.classList.contains("is-core") ? 132 : 96;

  return {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
  };
}

function expectGraphNodesNotToOverlap(container: HTMLElement) {
  const nodeElements = Array.from(container.querySelectorAll(".project-map-graph-viewport > .project-map-node"));

  for (let leftIndex = 0; leftIndex < nodeElements.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodeElements.length; rightIndex += 1) {
      const leftBounds = getGraphNodeBounds(nodeElements[leftIndex]!);
      const rightBounds = getGraphNodeBounds(nodeElements[rightIndex]!);
      const overlaps =
        leftBounds.left < rightBounds.right &&
        leftBounds.right > rightBounds.left &&
        leftBounds.top < rightBounds.bottom &&
        leftBounds.bottom > rightBounds.top;

      expect(
        overlaps,
        `${nodeElements[leftIndex]?.textContent ?? "left"} (${(nodeElements[leftIndex] as HTMLElement | undefined)?.style.left}, ${(nodeElements[leftIndex] as HTMLElement | undefined)?.style.top}) overlaps ${
          nodeElements[rightIndex]?.textContent ?? "right"
        } (${(nodeElements[rightIndex] as HTMLElement | undefined)?.style.left}, ${(nodeElements[rightIndex] as HTMLElement | undefined)?.style.top})`,
      ).toBe(false);
    }
  }
}

function getGraphNodeCenter(nodeElement: Element): { x: number; y: number } {
  const element = nodeElement as HTMLElement;
  return {
    x: Number.parseFloat(element.style.left),
    y: Number.parseFloat(element.style.top),
  };
}

function getMaxGraphDistanceFromSelectedNode(container: HTMLElement): number {
  const selectedNode = container.querySelector(".project-map-graph-viewport > .project-map-node.is-selected");
  const nodeElements = Array.from(container.querySelectorAll(".project-map-graph-viewport > .project-map-node"));
  if (!selectedNode) {
    return 0;
  }

  const selectedCenter = getGraphNodeCenter(selectedNode);
  return Math.max(
    0,
    ...nodeElements
      .filter((nodeElement) => nodeElement !== selectedNode)
      .map((nodeElement) => {
        const center = getGraphNodeCenter(nodeElement);
        return Math.hypot(center.x - selectedCenter.x, center.y - selectedCenter.y);
      }),
  );
}

function createCrowdedProjectMapDataset(): ProjectMapDataset {
  const rootNode = mockProjectMapData.nodes.find((node) => node.id === "project-core")!;
  const riskHub = mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!;
  const crowdedHubIds = Array.from({ length: 6 }, (_, index) => `crowded-risk-hub-${index + 1}`);
  const crowdedLeafIds = Array.from({ length: 7 }, (_, index) => `crowded-risk-leaf-${index + 1}`);
  const crowdedHubs: ProjectMapNode[] = crowdedHubIds.map((id, index) => ({
    ...riskHub,
    id,
    title: `拥挤风险视图 ${index + 1} Crowded Risk ${index + 1}`,
    children: [],
  }));
  const crowdedLeaves: ProjectMapNode[] = crowdedLeafIds.map((id, index) => ({
    ...riskHub,
    id,
    title: `风险子项 ${index + 1} Risk Child ${index + 1}`,
    parentId: "hub-risk",
    children: [],
  }));

  return {
    ...mockProjectMapData,
    nodes: mockProjectMapData.nodes
      .map((node) => {
        if (node.id === rootNode.id) {
          return {
            ...node,
            children: [...node.children, ...crowdedHubIds],
          };
        }

        if (node.id === "hub-risk") {
          return {
            ...node,
            children: [...node.children, ...crowdedLeafIds],
          };
        }

        return node;
      })
      .concat(crowdedHubs, crowdedLeaves),
  };
}

describe("ProjectMapPanel", () => {
  it("renders an empty runtime state when no dataset is provided", () => {
    render(<ProjectMapPanel workspaceName="mossx" />);

    expect(screen.getByText("projectMap.emptyTitle")).toBeTruthy();
    expect(screen.queryByText("项目画像 Project Profile")).toBeNull();
  });

  it("surfaces storage ownership mismatch without rendering trusted graph data", () => {
    const datasetController = createDatasetControllerMock({
      dataset: {
        ...mockProjectMapData,
        nodes: [],
        lenses: [],
      },
      status: "error",
      error: "Project map storage key mismatch: expected mossx-abcd, received springboot-demo-8e13fe53.",
    });

    render(<ProjectMapPanel workspaceName="mossx" datasetController={datasetController} />);

    expect(screen.getByText("projectMap.loadErrorTitle")).toBeTruthy();
    expect(screen.getByText(/storage key mismatch/i)).toBeTruthy();
    expect(screen.queryByText("项目画像 Project Profile")).toBeNull();
    expect(screen.queryByRole("button", { name: /接口表面 API Surface/i })).toBeNull();
  });

  it("renders the spider overview with bilingual project knowledge content", () => {
    const view = renderMockProjectMapPanel();

    expect(screen.getByLabelText("projectMap.panelTitle")).toBeTruthy();
    expect(view.container.querySelector(".project-map-topbar")).toBeTruthy();
    expect(view.container.querySelectorAll(".project-map-meta-pill")).toHaveLength(3);
    expect(view.container.querySelector(".project-map-meta-pill.is-profile")).toBeTruthy();
    expect(screen.getAllByText("项目画像 Project Profile").length).toBeGreaterThan(0);
    expect(screen.getAllByText("接口表面 API Surface").length).toBeGreaterThan(0);
    expect(screen.getAllByText("业务能力 Business Capabilities").length).toBeGreaterThan(0);
    expect(screen.getAllByText("证据链 Evidence").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("projectMap.layerRail")).toBeNull();
    expect(screen.queryByLabelText("projectMap.domainStrip")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: /projectMap\.expandLenses|展开 Lens|Expand lenses/ })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /projectMap\.expandLenses|展开 Lens|Expand lenses/ }));
    expect(screen.getByLabelText("projectMap.domainStrip")).toBeTruthy();
    expect(view.container.querySelectorAll(".project-map-node")).toHaveLength(10);
    expect(screen.getByLabelText("projectMap.canvasControls")).toBeTruthy();
    expect(
      within(screen.getByLabelText("projectMap.detailPanel")).getByRole("button", {
        name: "projectMap.deleteNode",
      }),
    ).toBeTruthy();
    expect(view.container.querySelector("textarea, [contenteditable='true']")).toBeNull();
  });

  it("uses the normalized node projection for graph selection and inspector details", () => {
    const canonicalApiNode = mockProjectMapData.nodes.find((node) => node.id === "hub-api");
    expect(canonicalApiNode).toBeTruthy();
    const duplicateApiNode: ProjectMapNode = {
      ...canonicalApiNode!,
      summary: "Duplicate API surface summary from a later lens pass.",
      detail: {
        ...canonicalApiNode!.detail,
        coreDescription: "Duplicate API surface summary from a later lens pass.",
        keyFacts: ["Duplicate node contributed an extra API evidence fact."],
        keyLogic: [],
        riskSignals: [],
        relatedArtifacts: [
          { type: "file", label: "duplicate-api", path: "src/duplicate/api.ts" },
        ],
      },
      children: [],
      sources: [{ type: "file", label: "duplicate-api", path: "src/duplicate/api.ts" }],
      confidence: "medium",
      lastGeneratedAt: "2026-05-26T03:00:00.000Z",
    };
    const datasetWithDuplicateNode: ProjectMapDataset = {
      ...mockProjectMapData,
      nodes: [...mockProjectMapData.nodes, duplicateApiNode],
    };

    render(<ProjectMapPanel workspaceName="mossx" dataset={datasetWithDuplicateNode} />);
    fireEvent.click(screen.getByRole("button", { name: /接口表面 API Surface/i }));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("该视角来自 Project Profile 和 evidence scan，不是 UI 固定枚举。")).toBeTruthy();
    expect(within(detailPanel).getByText("Duplicate node contributed an extra API evidence fact.")).toBeTruthy();
    expect(within(detailPanel).getAllByText("src/duplicate/api.ts").length).toBeGreaterThan(0);
  });

  it("uses a provided dataset controller for Project Map actions", () => {
    const openNodeGeneration = vi.fn();
    const datasetController = createDatasetControllerMock({ openNodeGeneration });

    render(
      <ProjectMapPanel
        workspaceName="mossx"
        dataset={mockProjectMapData}
        datasetController={datasetController}
      />,
    );

    fireEvent.click(within(screen.getByLabelText("projectMap.detailPanel")).getByText("projectMap.completeNode"));

    expect(openNodeGeneration).toHaveBeenCalledWith(
      "node",
      expect.objectContaining({ id: "project-core" }),
    );
  });

  it("shows AI organizer action when unassigned discoveries exist", () => {
    const openUnassignedOrganizer = vi.fn();
    const unassignedChild: ProjectMapNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "risk-taxonomy-drift")!,
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    };
    const unassignedParent: ProjectMapNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      title: "待整理发现 Unassigned Discoveries",
      parentId: "project-core",
      children: [unassignedChild.id],
    };
    const dataset: ProjectMapDataset = {
      ...mockProjectMapData,
      nodes: [
        ...mockProjectMapData.nodes.filter((node) => node.id !== unassignedChild.id),
        unassignedChild,
        unassignedParent,
      ],
    };
    const datasetController = createDatasetControllerMock({
      dataset,
      openUnassignedOrganizer,
    });

    render(<ProjectMapPanel workspaceName="mossx" datasetController={datasetController} />);
    fireEvent.click(screen.getByRole("button", { name: "projectMap.organizeUnassigned" }));

    expect(openUnassignedOrganizer).toHaveBeenCalledTimes(1);
  });

  it("explains how to operate unassigned discoveries from the detail panel", () => {
    const openUnassignedOrganizer = vi.fn();
    const unassignedChild: ProjectMapNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "risk-taxonomy-drift")!,
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
    };
    const unassignedParent: ProjectMapNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      title: "待整理发现 Unassigned Discoveries",
      parentId: "project-core",
      children: [unassignedChild.id],
    };
    const dataset: ProjectMapDataset = {
      ...mockProjectMapData,
      nodes: [
        ...mockProjectMapData.nodes.filter((node) => node.id !== unassignedChild.id),
        unassignedChild,
        unassignedParent,
      ],
    };
    const datasetController = createDatasetControllerMock({
      dataset,
      openUnassignedOrganizer,
    });

    render(<ProjectMapPanel workspaceName="mossx" datasetController={datasetController} />);
    fireEvent.click(screen.getByRole("button", { name: /待整理发现 Unassigned Discoveries/i }));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("projectMap.unassignedOrganizer.title")).toBeTruthy();
    fireEvent.click(within(detailPanel).getByRole("button", { name: "projectMap.unassignedOrganizer.organize" }));
    expect(openUnassignedOrganizer).toHaveBeenCalledTimes(1);
  });

  it("collapses the project map chrome into a compact header", () => {
    const view = renderMockProjectMapPanel();

    fireEvent.click(screen.getByRole("button", { name: "projectMap.collapseChrome" }));

    expect(view.container.querySelector(".project-map-panel")?.classList.contains("is-chrome-collapsed")).toBe(true);
    expect(view.container.querySelector(".project-map-lens-shell")).toBeNull();
    expect(screen.getByRole("button", { name: "projectMap.expandChrome" })).toBeTruthy();
    expect(screen.getByText("mossx")).toBeTruthy();
  });

  it("requires engine and model selection before enabling auto ingestion", async () => {
    renderMockProjectMapPanel();

    fireEvent.click(screen.getByRole("checkbox", { name: "projectMap.settings.autoIngestion" }));

    expect(screen.getByRole("dialog", { name: "projectMap.settings.configureAutoIngestion" })).toBeTruthy();
    expect(screen.getByLabelText("projectMap.settings.engine")).toBeTruthy();
    expect(screen.getByLabelText("projectMap.settings.model")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "projectMap.settings.cancelEnable" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "projectMap.settings.configureAutoIngestion" })).toBeNull();
    });
    expect(
      (screen.getByRole("checkbox", { name: "projectMap.settings.autoIngestion" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  it("keeps crowded overview and focused graph cards mutually exclusive", () => {
    const crowdedDataset = createCrowdedProjectMapDataset();
    const view = render(<ProjectMapPanel workspaceName="mossx" dataset={crowdedDataset} />);

    expectGraphNodesNotToOverlap(view.container);

    fireEvent.click(screen.getByRole("button", { name: /风险 Risk/i }));
    fireEvent.click(screen.getByRole("button", { name: "projectMap.drillIn" }));

    expectGraphNodesNotToOverlap(view.container);
  });

  it("selects first, then drills into a detected lens node and returns to overview", () => {
    const view = renderMockProjectMapPanel();

    fireEvent.click(screen.getByLabelText(/接口表面 API Surface/i));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getAllByText("接口表面 API Surface").length).toBeGreaterThan(0);
    expect(within(detailPanel).getByRole("button", { name: "projectMap.deleteNode" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /HTTP \/ RPC Endpoints/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "projectMap.drillIn" }));

    expect(screen.getByRole("button", { name: /HTTP \/ RPC Endpoints/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /分类漂移 Taxonomy Drift/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: "projectMap.backToPrevious" }).length).toBeGreaterThan(0);
    const detailNavigationGroup = within(detailPanel).getByRole("group", { name: "projectMap.viewNavigation" });
    expect(within(detailNavigationGroup).getByRole("button", { name: "projectMap.collapseDetail" })).toBeTruthy();
    expect(within(detailNavigationGroup).getByRole("button", { name: "projectMap.backToPrevious" })).toBeTruthy();
    expect(within(detailNavigationGroup).getByRole("button", { name: "projectMap.backToOverview" })).toBeTruthy();
    expectGraphNodesNotToOverlap(view.container);
    expect(getMaxGraphDistanceFromSelectedNode(view.container)).toBeLessThan(540);

    fireEvent.click(screen.getAllByRole("button", { name: "projectMap.backToPrevious" })[0]!);

    expect(screen.queryByRole("button", { name: /HTTP \/ RPC Endpoints/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /风险 Risk/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "projectMap.drillIn" }));

    fireEvent.click(screen.getByRole("button", { name: /projectMap\.backToOverview/i }));

    expect(screen.queryByRole("button", { name: /分类漂移 Taxonomy Drift/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /风险 Risk/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("项目画像 Project Profile").length).toBeGreaterThan(0);
  });

  it("opens the unified delete confirmation dialog for any selected node", async () => {
    renderMockProjectMapPanel();

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    fireEvent.click(within(detailPanel).getByRole("button", { name: "projectMap.deleteNode" }));

    expect(screen.getByText("projectMap.confirmDeleteNodeTitle")).toBeTruthy();
    expect(screen.getByText("projectMap.confirmDeleteNode")).toBeTruthy();
    expect(screen.getByRole("button", { name: "projectMap.confirmDeleteNodeConfirm" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "projectMap.confirmDeleteNodeCancel" }));

    await waitFor(() => {
      expect(screen.queryByText("projectMap.confirmDeleteNodeTitle")).toBeNull();
    });
    expect(within(detailPanel).getAllByText("项目画像 Project Profile").length).toBeGreaterThan(0);
  });

  it("keeps canvas panning from swallowing node selection", () => {
    renderMockProjectMapPanel();

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("项目画像 Project Profile")).toBeTruthy();

    const modulesNode = screen.getByRole("button", { name: /模块结构 Modules/i });
    fireEvent.pointerDown(modulesNode);
    fireEvent.click(modulesNode);

    expect(within(detailPanel).getAllByText("模块结构 Modules").length).toBeGreaterThan(0);
    expect(within(detailPanel).queryByText("项目画像 Project Profile")).toBeNull();
  });

  it("moves selected graph nodes together during a drag preview", async () => {
    const view = renderMockProjectMapPanel();
    const canvas = view.container.querySelector(".project-map-graph-canvas") as HTMLElement;
    const apiNode = screen.getByRole("button", { name: /接口表面 API Surface/i });
    const riskNode = screen.getByRole("button", { name: /风险 Risk/i });
    const initialApiCenter = getGraphNodeCenter(apiNode);
    const initialRiskCenter = getGraphNodeCenter(riskNode);

    fireEvent.click(apiNode, { shiftKey: true });
    fireEvent.click(riskNode, { shiftKey: true });
    expect(apiNode.classList.contains("is-group-selected")).toBe(true);
    expect(riskNode.classList.contains("is-group-selected")).toBe(true);

    fireEvent.pointerDown(riskNode, { pointerId: 7, clientX: 120, clientY: 160 });
    fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 180, clientY: 200 });

    const movedApiCenter = getGraphNodeCenter(apiNode);
    const movedRiskCenter = getGraphNodeCenter(riskNode);
    expect(movedApiCenter.x).toBeGreaterThan(initialApiCenter.x);
    expect(movedRiskCenter.x).toBeGreaterThan(initialRiskCenter.x);

    fireEvent.pointerUp(canvas, { pointerId: 7, clientX: 180, clientY: 200 });
    fireEvent.click(riskNode);

    await waitFor(() => {
      expect(apiNode.classList.contains("is-group-selected")).toBe(true);
      expect(riskNode.classList.contains("is-group-selected")).toBe(true);
    });
  });

  it("keeps node-body pointer capture dragging even when move events land on the node", async () => {
    renderMockProjectMapPanel();
    const apiNode = screen.getByRole("button", { name: /接口表面 API Surface/i });
    const initialApiCenter = getGraphNodeCenter(apiNode);

    fireEvent.pointerDown(apiNode, { pointerId: 11, clientX: 140, clientY: 180 });
    fireEvent.pointerMove(apiNode, { pointerId: 11, clientX: 210, clientY: 220 });

    const movedApiCenter = getGraphNodeCenter(apiNode);
    expect(movedApiCenter.x).toBeGreaterThan(initialApiCenter.x);
    expect(movedApiCenter.y).toBeGreaterThan(initialApiCenter.y);

    await act(async () => {
      fireEvent.pointerUp(apiNode, { pointerId: 11, clientX: 210, clientY: 220 });
    });
  });

  it("clears drag preview state when switching the layout preset", () => {
    const view = renderMockProjectMapPanel();
    expandCanvasControls();
    const canvas = view.container.querySelector(".project-map-graph-canvas") as HTMLElement;
    const apiNode = screen.getByRole("button", { name: /接口表面 API Surface/i });
    const initialApiCenter = getGraphNodeCenter(apiNode);

    fireEvent.pointerDown(apiNode, { pointerId: 8, clientX: 120, clientY: 160 });
    fireEvent.pointerMove(canvas, { pointerId: 8, clientX: 220, clientY: 160 });
    expect(getGraphNodeCenter(apiNode).x).toBeGreaterThan(initialApiCenter.x);

    fireEvent.change(screen.getByLabelText("projectMap.layoutPreset"), {
      target: { value: "tree" },
    });

    expect(getGraphNodeCenter(apiNode)).toMatchObject(initialApiCenter);
  });

  it("renders layout controls and recenters the viewport from the mini map", () => {
    const view = renderMockProjectMapPanel();
    const viewport = view.container.querySelector(".project-map-graph-viewport") as HTMLElement;
    const beforeTransform = viewport.style.transform;

    expect(screen.getByRole("button", { name: "projectMap.expandCanvasControls" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "projectMap.autoLayout" })).toBeNull();
    expandCanvasControls();
    expect(screen.getByRole("button", { name: "projectMap.autoLayout" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "projectMap.resetLayout" })).toBeTruthy();
    expect(screen.getByLabelText("projectMap.layoutPreset")).toBeTruthy();
    expect(view.container.querySelector(".project-map-settings")).toBeTruthy();
    expect(screen.getByLabelText("projectMap.settings.threshold")).toBeTruthy();
    expect(screen.getByLabelText("projectMap.settings.interval")).toBeTruthy();
    expect(screen.getByLabelText("projectMap.settings.applyMode")).toBeTruthy();

    const miniMap = screen.getByRole("button", { name: "projectMap.miniMap" });
    miniMap.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 180,
      bottom: 118,
      width: 180,
      height: 118,
      toJSON: () => ({}),
    });
    fireEvent.click(miniMap, { clientX: 40, clientY: 24 });

    expect(viewport.style.transform).not.toBe(beforeTransform);
  });

  it("persists the canvas controls collapsed state without layout actions changing it", () => {
    const view = renderMockProjectMapPanel();

    expandCanvasControls();
    expect(window.localStorage.getItem("ccgui.projectMap.canvasControlsCollapsed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "projectMap.resetView" }));
    fireEvent.click(screen.getByRole("button", { name: "projectMap.autoLayout" }));
    fireEvent.click(screen.getByRole("button", { name: "projectMap.resetLayout" }));
    fireEvent.change(screen.getByLabelText("projectMap.layoutPreset"), {
      target: { value: "tree" },
    });
    expect(screen.getByRole("button", { name: "projectMap.collapseCanvasControls" })).toBeTruthy();
    expect(window.localStorage.getItem("ccgui.projectMap.canvasControlsCollapsed")).toBe("false");

    view.unmount();
    renderMockProjectMapPanel();
    expect(screen.getByRole("button", { name: "projectMap.collapseCanvasControls" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "projectMap.collapseCanvasControls" }));
    expect(window.localStorage.getItem("ccgui.projectMap.canvasControlsCollapsed")).toBe("true");
  });

  it("fits the initial graph left of the open detail panel", () => {
    const view = renderMockProjectMapPanel();
    const canvas = view.container.querySelector(".project-map-graph-canvas") as HTMLElement;
    const detailPanel = screen.getByLabelText("projectMap.detailPanel") as HTMLElement;

    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1200,
      bottom: 720,
      width: 1200,
      height: 720,
      toJSON: () => ({}),
    });
    detailPanel.getBoundingClientRect = () => ({
      x: 704,
      y: 16,
      left: 704,
      top: 16,
      right: 1182,
      bottom: 704,
      width: 478,
      height: 688,
      toJSON: () => ({}),
    });

    expandCanvasControls();
    fireEvent.click(screen.getByRole("button", { name: "projectMap.resetView" }));

    const viewport = view.container.querySelector(".project-map-graph-viewport") as HTMLElement;
    expect(viewport.style.transform).toContain("translate(-239px");
  });

  it("keeps the viewport stable when selecting another node with the detail panel open", () => {
    const view = renderMockProjectMapPanel();
    const canvas = view.container.querySelector(".project-map-graph-canvas") as HTMLElement;
    const detailPanel = screen.getByLabelText("projectMap.detailPanel") as HTMLElement;

    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1200,
      bottom: 720,
      width: 1200,
      height: 720,
      toJSON: () => ({}),
    });
    detailPanel.getBoundingClientRect = () => ({
      x: 704,
      y: 16,
      left: 704,
      top: 16,
      right: 1182,
      bottom: 704,
      width: 478,
      height: 688,
      toJSON: () => ({}),
    });

    expandCanvasControls();
    fireEvent.click(screen.getByRole("button", { name: "projectMap.resetView" }));
    fireEvent.click(within(detailPanel).getByRole("button", { name: "projectMap.collapseDetail" }));
    fireEvent.click(screen.getByRole("button", { name: /接口表面 API Surface/i }));

    const viewport = view.container.querySelector(".project-map-graph-viewport") as HTMLElement;
    const transformAfterOpeningDetail = viewport.style.transform;
    expect(transformAfterOpeningDetail).toContain("translate(-239px");

    fireEvent.click(screen.getByRole("button", { name: /风险 Risk/i }));

    expect(viewport.style.transform).toBe(transformAfterOpeningDetail);
  });

  it("zooms the graph canvas around the mouse wheel anchor", () => {
    const view = renderMockProjectMapPanel();
    const canvas = view.container.querySelector(".project-map-graph-canvas") as HTMLElement;
    const viewport = view.container.querySelector(".project-map-graph-viewport") as HTMLElement;

    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 600,
      width: 1000,
      height: 600,
      toJSON: () => ({}),
    });
    const beforeTransform = viewport.style.transform;

    fireEvent.wheel(canvas, {
      deltaY: -120,
      clientX: 740,
      clientY: 210,
    });

    expect(viewport.style.transform).not.toBe(beforeTransform);
    expect(viewport.style.transform).toContain("scale(");
    expect(viewport.style.transform).not.toContain("translate(0px, 0px)");
  });

  it("uses colored node drill icons for down and up navigation", () => {
    renderMockProjectMapPanel();

    const apiNode = screen.getByRole("button", { name: /接口表面 API Surface/i });
    const drillDown = within(apiNode).getByLabelText("projectMap.drillDownNode");

    expect(drillDown.classList.contains("is-down")).toBe(true);
    fireEvent.click(drillDown);

    expect(screen.getByRole("button", { name: /HTTP \/ RPC Endpoints/i })).toBeTruthy();

    const focusedApiNode = screen.getByRole("button", { name: /接口表面 API Surface/i });
    const drillUp = within(focusedApiNode).getByLabelText("projectMap.drillUpNode");

    expect(drillUp.classList.contains("is-up")).toBe(true);
    fireEvent.click(drillUp);

    expect(screen.queryByRole("button", { name: /HTTP \/ RPC Endpoints/i })).toBeNull();
    expect(screen.getAllByText("项目画像 Project Profile").length).toBeGreaterThan(0);
  });

  it("renders a safe profile summary when persisted profile data is incomplete", () => {
    const malformedProfileDataset = {
      ...mockProjectMapData,
      profile: {
        primaryLanguage: "typescript",
      },
    } as ProjectMapDataset;

    render(<ProjectMapPanel workspaceName="mossx" dataset={malformedProfileDataset} />);

    expect(screen.getByLabelText("projectMap.panelTitle")).toBeTruthy();
    expect(screen.getAllByText("项目画像 Project Profile").length).toBeGreaterThan(0);
  });

  it("collapses the floating detail panel and reopens it when a node is selected", () => {
    renderMockProjectMapPanel();

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("projectMap.detail.coreDescription")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /projectMap\.collapseDetail|收起详情|Collapse detail/ }));

    expect(detailPanel.classList.contains("is-collapsed")).toBe(true);
    expect(within(detailPanel).queryByText("projectMap.detail.coreDescription")).toBeNull();
    expect(within(detailPanel).getByText("项目画像 Project Profile")).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/接口表面 API Surface/i));

    expect(detailPanel.classList.contains("is-collapsed")).toBe(false);
    expect(within(detailPanel).getByText("projectMap.detail.coreDescription")).toBeTruthy();
  });

  it("keeps stale, candidate, confidence, and one-hop focus states visible", () => {
    const view = renderMockProjectMapPanel();

    fireEvent.click(screen.getByRole("button", { name: /projectMap\.expandLenses|展开 Lens|Expand lenses/ }));
    const domainStrip = screen.getByLabelText("projectMap.domainStrip");
    fireEvent.click(within(domainStrip).getByRole("button", { name: /风险 Risk/i }));
    const modeDriftNode = screen.getByRole("button", { name: /分类漂移 Taxonomy Drift/i });
    fireEvent.click(modeDriftNode);

    expect(modeDriftNode.classList.contains("is-stale")).toBe(true);
    expect(modeDriftNode.classList.contains("is-candidate")).toBe(true);
    expect(modeDriftNode.classList.contains("confidence-high")).toBe(true);
    expect(view.container.querySelector(".project-map-edge.is-focused")).toBeTruthy();

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("projectMap.detail.coreDescription")).toBeTruthy();
    expect(within(detailPanel).getByText("projectMap.evidenceTitle")).toBeTruthy();
    expect(within(detailPanel).getByText("projectMap.candidateNotice.title")).toBeTruthy();
  });

  it("uses candidate badge as a review entry and removes redundant refresh controls", () => {
    renderMockProjectMapPanel();

    expect(screen.queryByRole("button", { name: "projectMap.refreshEvidence" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "projectMap.candidateBadge" }));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("projectMap.candidateNotice.title")).toBeTruthy();
    expect(within(detailPanel).getByRole("button", { name: "projectMap.backToParent" })).toBeTruthy();
    expect(within(detailPanel).queryByRole("button", { name: "projectMap.refreshEvidence" })).toBeNull();

    fireEvent.click(within(detailPanel).getByRole("button", { name: "projectMap.backToParent" }));

    expect(screen.queryByRole("button", { name: /分类漂移 Taxonomy Drift/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /风险 Risk/i }).length).toBeGreaterThan(0);
  });

  it("accepts all current candidates from the toolbar", async () => {
    const confirmAllCandidates = vi.fn(async () => ({ confirmed: 2, skipped: 1, errors: [] }));
    renderMockProjectMapPanel({
      datasetController: createDatasetControllerMock({
        confirmAllCandidates,
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "projectMap.confirmAllCandidates" }));

    await waitFor(() => expect(confirmAllCandidates).toHaveBeenCalledTimes(1));
    expect(screen.getByText("projectMap.confirmAllCandidatesResult")).toBeTruthy();
  });

  it("uses candidate badge as a review entry for AI organizer parent-move candidates", () => {
    const movingNode: ProjectMapNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "risk-taxonomy-drift")!,
      parentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      candidate: false,
    };
    const unassignedParent: ProjectMapNode = {
      ...mockProjectMapData.nodes.find((node) => node.id === "hub-risk")!,
      id: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
      title: "待整理发现 Unassigned Discoveries",
      parentId: "project-core",
      children: [movingNode.id],
    };
    const dataset: ProjectMapDataset = {
      ...mockProjectMapData,
      nodes: [
        ...mockProjectMapData.nodes.filter((node) => node.id !== movingNode.id),
        movingNode,
        unassignedParent,
      ],
      candidates: [
        {
          id: "organizer-move-risk",
          status: "pending",
          createdAt: "2026-05-30T08:00:00.000Z",
          updatedAt: "2026-05-30T08:00:00.000Z",
          source: "organizer",
          kind: "parentMove",
          targetLensId: movingNode.lensId,
          targetNodeId: movingNode.id,
          patch: { nodeId: movingNode.id },
          move: {
            nodeId: movingNode.id,
            fromParentId: PROJECT_MAP_UNASSIGNED_DISCOVERIES_NODE_ID,
            suggestedParentId: "hub-risk",
            confidence: "medium",
            reason: "风险节点应归入 Risk hub。",
          },
          evidence: [],
        },
      ],
    };

    render(<ProjectMapPanel workspaceName="mossx" dataset={dataset} />);
    fireEvent.click(screen.getByRole("button", { name: "projectMap.candidateBadge" }));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("projectMap.candidateNotice.parentMoveBody")).toBeTruthy();
    expect(within(detailPanel).getByRole("button", { name: "projectMap.candidateNotice.confirm" })).toBeTruthy();
    expect(within(detailPanel).getByRole("button", { name: "projectMap.candidateNotice.reject" })).toBeTruthy();
  });

  it("shows confirm and reject actions when a selected node has a pending candidate record", () => {
    const reviewDataset: ProjectMapDataset = {
      ...mockProjectMapData,
      candidates: [
        {
          id: "candidate-risk-taxonomy-drift",
          status: "pending",
          createdAt: "2026-05-26T01:00:00.000Z",
          updatedAt: "2026-05-26T01:00:00.000Z",
          source: "conversation",
          targetLensId: "risk",
          targetNodeId: "risk-taxonomy-drift",
          patch: {
            nodeId: "risk-taxonomy-drift",
            summary: "Confirmed taxonomy drift risk.",
            confidence: "medium",
            candidate: false,
            sources: [
              {
                type: "spec",
                label: "design",
                path: "openspec/changes/add-project-xray-panel/design.md",
              },
            ],
          },
          evidence: [],
        },
      ],
    };
    render(<ProjectMapPanel workspaceName="mossx" dataset={reviewDataset} />);

    fireEvent.click(screen.getByRole("button", { name: /projectMap\.expandLenses|展开 Lens|Expand lenses/ }));
    const domainStrip = screen.getByLabelText("projectMap.domainStrip");
    fireEvent.click(within(domainStrip).getByRole("button", { name: /风险 Risk/i }));
    fireEvent.click(screen.getByRole("button", { name: /分类漂移 Taxonomy Drift/i }));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByRole("button", { name: "projectMap.candidateNotice.confirm" })).toBeTruthy();
    expect(within(detailPanel).getByRole("button", { name: "projectMap.candidateNotice.reject" })).toBeTruthy();
  });

  it("explains calibrated candidates that still need manual resolution", () => {
    const calibrationRun: ProjectMapRunMetadata = {
      id: "calibrate-risk-taxonomy-drift",
      kind: "node",
      status: "completed",
      engine: "codex",
      model: "gpt-5.3-codex-spark",
      startedAt: "2026-05-26T01:00:00.000Z",
      completedAt: "2026-05-26T01:01:00.000Z",
      scope: "node",
      requestScope: {
        kind: "node",
        nodeId: "risk-taxonomy-drift",
        includeDescendants: false,
      },
      generationIntent: "calibrateNode",
    };
    const calibratedDataset: ProjectMapDataset = {
      ...mockProjectMapData,
      runs: [calibrationRun],
      candidates: [],
      nodes: mockProjectMapData.nodes.map((node) =>
        node.id === "risk-taxonomy-drift"
          ? {
              ...node,
              candidate: true,
              stale: true,
              confidence: "low",
              generatedBy: {
                ...node.generatedBy,
                runId: calibrationRun.id,
              },
            }
          : node,
      ),
    };
    render(<ProjectMapPanel workspaceName="mossx" dataset={calibratedDataset} />);

    fireEvent.click(screen.getByRole("button", { name: /projectMap\.expandLenses|展开 Lens|Expand lenses/ }));
    fireEvent.click(within(screen.getByLabelText("projectMap.domainStrip")).getByRole("button", { name: /风险 Risk/i }));
    fireEvent.click(screen.getByRole("button", { name: /分类漂移 Taxonomy Drift/i }));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("projectMap.candidateNotice.calibratedTitle")).toBeTruthy();
    expect(within(detailPanel).getByText("projectMap.candidateNotice.calibratedBody")).toBeTruthy();
    expect(within(detailPanel).getByRole("button", { name: "projectMap.candidateNotice.confirm" })).toBeTruthy();
    expect(within(detailPanel).getByRole("button", { name: "projectMap.candidateNotice.reject" })).toBeTruthy();
  });

  it("renders traceable artifact and evidence source controls without faking missing links", () => {
    const rootNode = mockProjectMapData.nodes[0]!;
    const openEvidenceFile = vi.fn();
    const traceDataset: ProjectMapDataset = {
      ...mockProjectMapData,
      nodes: mockProjectMapData.nodes.map((node) =>
        node.id === "project-core"
          ? {
              ...node,
              detail: {
                ...node.detail,
                relatedArtifacts: [
                  { type: "file", label: "Panel", path: "src/features/project-map/components/ProjectMapPanel.tsx", line: 42 },
                  JSON.parse('"src/main/resources/application.yml"') as ProjectMapNode["detail"]["relatedArtifacts"][number],
                  { type: "symbol", label: "README.md" },
                  { type: "conversation", label: "Design chat" },
                ],
                diagramArtifacts: [
                  {
                    id: "auth-service-flow",
                    label: "AuthService Token Flow",
                    path: ".ccgui/project-map/mossx-abcd/diagrams/auth-service-flow.md",
                    kind: "sequence",
                    summary: "Login and refresh token flow.",
                    sourceRefs: ["src/AuthService.ts"],
                  },
                ],
              },
              sources: [
                {
                  type: "spec",
                  label: "UX spec",
                  path: "openspec/changes/improve-project-map-inspector-evidence-ux/specs/project-xray-panel/spec.md",
                  line: 12,
                  excerpt: "Candidate badge navigates to candidate node.",
                },
                {
                  type: "conversation",
                  label: "Unlinked note",
                },
              ],
            }
          : node,
      ),
    };

    render(
      <ProjectMapPanel
        workspaceName="mossx"
        dataset={traceDataset}
        onOpenEvidenceFile={openEvidenceFile}
      />,
    );

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("projectMap.detail.diagrams")).toBeTruthy();
    fireEvent.click(within(detailPanel).getByRole("button", { name: /auth-service-flow\.md/i }));
    expect(openEvidenceFile).toHaveBeenCalledWith(
      ".ccgui/project-map/mossx-abcd/diagrams/auth-service-flow.md",
      undefined,
    );
    fireEvent.click(within(detailPanel).getByRole("button", { name: /ProjectMapPanel\.tsx:42/i }));
    expect(openEvidenceFile).toHaveBeenCalledWith(
      "src/features/project-map/components/ProjectMapPanel.tsx",
      { line: 42, column: 1 },
    );
    fireEvent.click(within(detailPanel).getByRole("button", { name: /application\.yml/i }));
    expect(openEvidenceFile).toHaveBeenCalledWith(
      "src/main/resources/application.yml",
      undefined,
    );
    fireEvent.click(within(detailPanel).getByRole("button", { name: /README\.md/i }));
    expect(openEvidenceFile).toHaveBeenCalledWith("README.md", undefined);
    fireEvent.click(within(detailPanel).getByRole("button", { name: /project-xray-panel\/spec\.md:12/i }));
    expect(openEvidenceFile).toHaveBeenCalledWith(
      "openspec/changes/improve-project-map-inspector-evidence-ux/specs/project-xray-panel/spec.md",
      { line: 12, column: 1 },
    );
    expect(within(detailPanel).getByText("Candidate badge navigates to candidate node.")).toBeTruthy();
    expect(within(detailPanel).getByText("Design chat").tagName.toLowerCase()).toBe("span");
    expect(within(detailPanel).getByText("Unlinked note").tagName.toLowerCase()).toBe("span");
    expect(rootNode.id).toBe("project-core");
  });

  it("opens generation confirmation from global and node-level actions", async () => {
    const legacyStringArtifact = JSON.parse(
      '"org.springframework.cloud:spring-cloud-starter-gateway"',
    ) as ProjectMapNode["detail"]["relatedArtifacts"][number];
    const datasetWithLegacyArtifact: ProjectMapDataset = {
      ...mockProjectMapData,
      nodes: mockProjectMapData.nodes.map((node, index) =>
        index === 0
          ? {
              ...node,
              detail: {
                ...node.detail,
                relatedArtifacts: [legacyStringArtifact],
              },
            }
          : node,
      ),
    };
    renderMockProjectMapPanel({ dataset: datasetWithLegacyArtifact });

    fireEvent.click(screen.getByRole("button", { name: "projectMap.collectFramework" }));

    expect(screen.getByRole("dialog", { name: "projectMap.confirmation.title" })).toBeTruthy();
    expect(screen.getByText("projectMap.confirmation.writePath")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("projectMap.confirmation.engine"), {
      target: { value: "codex" },
    });
    expect((screen.getByLabelText("projectMap.confirmation.engine") as HTMLSelectElement).value).toBe(
      "codex",
    );
    expect((screen.getByLabelText("projectMap.confirmation.model") as HTMLSelectElement).value).toBe(
      "default",
    );
    fireEvent.click(screen.getByRole("button", { name: "projectMap.confirmation.cancel" }));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("org.springframework.cloud:spring-cloud-starter-gateway")).toBeTruthy();
    expect(within(detailPanel).queryByText("UNDEFINED")).toBeNull();
    fireEvent.click(within(detailPanel).getByRole("button", { name: "projectMap.completeNode" }));

    expect(screen.getByRole("dialog", { name: "projectMap.confirmation.title" })).toBeTruthy();
    expect(screen.getByText("node")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "projectMap.confirmation.cancel" }));

    fireEvent.click(within(detailPanel).getByRole("button", { name: "projectMap.calibrateNode" }));

    expect(screen.getByRole("dialog", { name: "projectMap.confirmation.title" })).toBeTruthy();
    expect(screen.getByText("node")).toBeTruthy();
  });

  it("renders generated node-kind labels through readable fallbacks instead of raw i18n keys", () => {
    const rootNode = mockProjectMapData.nodes[0]!;
    const generatedDataset = {
      ...mockProjectMapData,
      nodes: mockProjectMapData.nodes.map((node) =>
        node.id === "project-core"
          ? { ...node, children: [...node.children, "generated-record"] }
          : node,
      ).concat({
        ...rootNode,
        id: "generated-record",
        lensId: "overview",
        nodeKind: "record",
        title: "Evidence Index",
        summary: "Generated source index.",
        parentId: "project-core",
        children: [],
        sources: [
          {
            type: "file",
            label: "AGENTS.md",
            path: "AGENTS.md",
          },
        ],
      }),
    };

    render(<ProjectMapPanel workspaceName="mossx" dataset={generatedDataset} />);

    fireEvent.click(screen.getByRole("button", { name: /Evidence Index/i }));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getAllByText("Record").length).toBeGreaterThan(0);
    expect(within(detailPanel).getAllByText("FILE").length).toBeGreaterThan(0);
    expect(screen.queryByText("projectMap.nodeKind.record")).toBeNull();
    expect(screen.queryByText("projectMap.sourceType.file")).toBeNull();
  });

  it("shows compact generation tasks without duplicating active runs", () => {
    const queuedDataset = {
      ...mockProjectMapData,
      runs: [
        {
          id: "global_run_1",
          kind: "global" as const,
          status: "pending" as const,
          engine: "codex",
          model: "gpt-5.4",
          startedAt: "2026-05-26T01:40:00.000Z",
          completedAt: null,
          scope: "global",
          writePath: ".ccgui/project-map/springboot-demo-8e13fe53",
        },
        {
          id: "global_run_2",
          kind: "node" as const,
          status: "pending" as const,
          engine: "codex",
          model: "gpt-5.4",
          startedAt: "2026-05-26T01:41:00.000Z",
          completedAt: null,
          scope: "node",
          requestScope: { kind: "node" as const, nodeId: "project-core", includeDescendants: true },
          generationIntent: "completeNode" as const,
          writePath: ".ccgui/project-map/springboot-demo-8e13fe53",
        },
        {
          id: "global_run_done",
          kind: "global" as const,
          status: "completed" as const,
          engine: "codex",
          model: "gpt-5.4",
          startedAt: "2026-05-26T01:20:00.000Z",
          completedAt: "2026-05-26T01:22:00.000Z",
          scope: "global",
          writePath: ".ccgui/project-map/springboot-demo-8e13fe53",
        },
        ...mockProjectMapData.runs,
      ],
    };

    render(<ProjectMapPanel workspaceName="mossx" dataset={queuedDataset} />);

    expect(screen.getByLabelText("projectMap.tasks.bannerAria")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /projectMap\.tasks\.button|Tasks|任务/ }));

    const drawer = screen.getByRole("dialog", { name: "projectMap.tasks.drawerTitle" });
    expect(within(drawer).getAllByText("global_run_1")).toHaveLength(1);
    expect(within(drawer).getByText("global_run_2")).toBeTruthy();
    expect(within(drawer).getByText("global_run_done")).toBeTruthy();
    expect(within(drawer).getByText("Complete Node")).toBeTruthy();
    expect(within(drawer).getByText(/项目画像 Project Profile · project-core/)).toBeTruthy();
    expect(within(drawer).getByText("projectMap.tasks.phase.queued")).toBeTruthy();
    expect(within(drawer).getByLabelText("projectMap.tasks.progressAria")).toBeTruthy();
    expect(within(drawer).getByLabelText("projectMap.tasks.stopRun")).toBeTruthy();
    expect(within(drawer).getByLabelText("projectMap.tasks.cancelRun")).toBeTruthy();
    expect(within(drawer).getByText("projectMap.tasks.clearDone")).toBeTruthy();
    expect(within(drawer).getByText("projectMap.tasks.closeHint")).toBeTruthy();
  });

  it("shows failed run categories and diagnostics in the task drawer", () => {
    const failedDataset: ProjectMapDataset = {
      ...mockProjectMapData,
      runs: [
        {
          id: "global_run_failed",
          kind: "global",
          status: "failed",
          phase: "failed",
          engine: "codex",
          model: "gpt-5.4",
          startedAt: "2026-05-26T01:20:00.000Z",
          completedAt: "2026-05-26T01:21:00.000Z",
          scope: "global",
          failureCategory: "output_parse_failed",
          error: "AI output did not contain a JSON object.",
        },
      ],
    };

    render(<ProjectMapPanel workspaceName="mossx" dataset={failedDataset} />);

    fireEvent.click(screen.getByRole("button", { name: /projectMap\.tasks\.button|Tasks|任务/ }));

    const drawer = screen.getByRole("dialog", { name: "projectMap.tasks.drawerTitle" });
    expect(within(drawer).getByText("global_run_failed")).toBeTruthy();
    expect(within(drawer).getByText("projectMap.tasks.failureCategory.label")).toBeTruthy();
    expect(within(drawer).getByText("projectMap.tasks.failureCategory.output_parse_failed")).toBeTruthy();
    expect(within(drawer).getByText("AI output did not contain a JSON object.")).toBeTruthy();
  });
});
