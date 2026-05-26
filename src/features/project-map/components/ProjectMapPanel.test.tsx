// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mockProjectMapData } from "../mockProjectMapData";
import type { ProjectMapDataset, ProjectMapNode } from "../types";
import { ProjectMapPanel } from "./ProjectMapPanel";

function renderMockProjectMapPanel() {
  return render(<ProjectMapPanel workspaceName="mossx" dataset={mockProjectMapData} />);
}

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
    ? 192
    : element.classList.contains("is-hub")
      ? 176
      : 168;
  const height = element.classList.contains("is-core") ? 110 : 96;

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

  it("renders the spider overview with bilingual project knowledge content", () => {
    const view = renderMockProjectMapPanel();

    expect(screen.getByLabelText("projectMap.panelTitle")).toBeTruthy();
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
    expect(view.container.querySelector("textarea, [contenteditable='true']")).toBeNull();
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

    fireEvent.click(screen.getByRole("button", { name: /projectMap\.candidateBadge|候选|candidates/i }));

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByText("projectMap.candidateNotice.title")).toBeTruthy();
    expect(within(detailPanel).getByRole("button", { name: "projectMap.backToParent" })).toBeTruthy();
    expect(within(detailPanel).queryByRole("button", { name: "projectMap.refreshEvidence" })).toBeNull();

    fireEvent.click(within(detailPanel).getByRole("button", { name: "projectMap.backToParent" }));

    expect(screen.queryByRole("button", { name: /分类漂移 Taxonomy Drift/i })).toBeNull();
    expect(screen.getAllByRole("button", { name: /风险 Risk/i }).length).toBeGreaterThan(0);
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

  it("renders traceable artifact and evidence source controls without faking missing links", () => {
    const rootNode = mockProjectMapData.nodes[0]!;
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
                  { type: "conversation", label: "Design chat" },
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

    render(<ProjectMapPanel workspaceName="mossx" dataset={traceDataset} />);

    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    expect(within(detailPanel).getByRole("button", { name: /ProjectMapPanel\.tsx:42/i })).toBeTruthy();
    expect(within(detailPanel).getByRole("button", { name: /project-xray-panel\/spec\.md:12/i })).toBeTruthy();
    expect(within(detailPanel).getByText("Candidate badge navigates to candidate node.")).toBeTruthy();
    expect(within(detailPanel).getByText("Design chat").tagName.toLowerCase()).toBe("span");
    expect(within(detailPanel).getByText("Unlinked note").tagName.toLowerCase()).toBe("span");
    expect(rootNode.id).toBe("project-core");
  });

  it("opens generation confirmation from global and node-level actions", async () => {
    renderMockProjectMapPanel();

    fireEvent.click(screen.getByRole("button", { name: /projectMap\.collectFramework|收集|Collect/ }));

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

    fireEvent.click(screen.getByLabelText(/接口表面 API Surface/i));
    const detailPanel = screen.getByLabelText("projectMap.detailPanel");
    fireEvent.click(within(detailPanel).getByRole("button", { name: "projectMap.completeNode" }));

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
          kind: "global" as const,
          status: "pending" as const,
          engine: "codex",
          model: "gpt-5.4",
          startedAt: "2026-05-26T01:41:00.000Z",
          completedAt: null,
          scope: "global",
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
    expect(within(drawer).getByText("projectMap.tasks.phase.queued")).toBeTruthy();
    expect(within(drawer).getByLabelText("projectMap.tasks.progressAria")).toBeTruthy();
    expect(within(drawer).getByLabelText("projectMap.tasks.stopRun")).toBeTruthy();
    expect(within(drawer).getByLabelText("projectMap.tasks.cancelRun")).toBeTruthy();
    expect(within(drawer).getByText("projectMap.tasks.clearDone")).toBeTruthy();
    expect(within(drawer).getByText("projectMap.tasks.closeHint")).toBeTruthy();
  });
});
