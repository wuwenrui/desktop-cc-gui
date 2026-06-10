// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectMapRelationshipSection } from "./ProjectMapRelationshipSection";
import { readProjectMapRelationships, scanProjectMapRelationships } from "../services/projectMapPersistence";

vi.mock("../services/projectMapPersistence", () => ({
  readProjectMapRelationships: vi.fn(),
  scanProjectMapRelationships: vi.fn(),
}));

vi.mock("../../intent-canvas/services/relationshipImportQueries", () => ({
  queryProjectMapRelationshipEdge: vi.fn(),
}));

vi.mock("../../intent-canvas/services/intentCanvasStorage", () => ({
  loadIntentCanvasIndex: vi.fn(),
}));

vi.mock("../../intent-canvas/services/relationshipProjector", () => ({
  projectRelationshipEdgeToCanvasSemanticGraph: vi.fn(),
  projectRelationshipFileRelationsToCanvasSemanticGraph: vi.fn(),
}));

function buildLargeApiContractResponse() {
  const endpointIds = Array.from({ length: 64 }, (_, index) => `endpoint-${index}`);
  const groups = [
    {
      id: "group-protocol-http",
      label: "HTTP",
      level: "protocol",
      endpointIds,
      childGroupIds: ["group-module-orders"],
      protocolCounts: { http: 64 },
      languageCounts: { typescript: 64 },
      confidenceCounts: { high: 64 },
    },
    {
      id: "group-module-orders",
      label: "orders-service",
      level: "module",
      parentId: "group-protocol-http",
      endpointIds,
      childGroupIds: ["group-controller-orders"],
      protocolCounts: { http: 64 },
      languageCounts: { typescript: 64 },
      confidenceCounts: { high: 64 },
    },
    {
      id: "group-controller-orders",
      label: "OrderController",
      level: "controller",
      parentId: "group-module-orders",
      endpointIds,
      childGroupIds: [],
      protocolCounts: { http: 64 },
      languageCounts: { typescript: 64 },
      confidenceCounts: { high: 64 },
    },
  ];
  const endpoints = endpointIds.map((id, index) => ({
    id,
    protocol: "http",
    language: "typescript",
    framework: "Express",
    method: "POST",
    path: `/api/orders/${index}`,
    handlerSymbol: `OrderController.create${index}`,
    sourceFile: "src/routes/orders.ts",
    parameters: index === 0 ? [{
      name: "orderParam",
      location: "body",
      required: true,
      description: "订单创建参数",
      schema: {
        id: "schema-order-param",
        name: "OrderParam",
      },
      structuredFields: [{
        name: "orderNo",
        type: "string",
        required: true,
        description: "订单号",
      }],
      evidence: [],
    }] : [],
    requestBody: index === 0 ? {
      contentType: "application/json",
      required: true,
      schema: {
        id: "schema-order-param",
        name: "OrderParam",
      },
      structuredFields: [{
        name: "orderNo",
        type: "string",
        required: true,
        description: "订单号",
      }],
      evidence: [],
    } : undefined,
    responses: [{
      statusCode: "200",
      contentType: "application/json",
      isError: false,
      evidence: [],
    }],
    groupIds: ["group-protocol-http", "group-module-orders", "group-controller-orders"],
    callChainIds: index === 0 ? ["chain-0"] : [],
    callChainUnavailableReason: index === 0 ? undefined : "method-chain-evidence-unavailable",
    confidence: "high",
    evidence: [{
      path: "src/routes/orders.ts",
      line: index + 1,
      excerpt: "app.post('/api/orders/:id', handler)",
      redacted: false,
      parserSource: "fallback-pattern",
      extractorVersion: "test",
      observedAt: "2026-06-07T00:00:00Z",
    }],
  }));
  return {
    storageKey: "mossx-large",
    storageDir: "/tmp/project-map-relations/mossx-large",
    exists: true,
    manifest: {
      schemaVersion: 1,
      storageKey: "mossx-large",
      scanRunId: "scan-large",
      generatedAt: "2026-06-07T00:00:00Z",
      scannedRoot: "/workspace",
      fileCount: 1,
      relationCount: 0,
      ignoredCount: 0,
      repairIssueCount: 0,
    },
    apiContracts: {
      schemaVersion: 1,
      generatedAt: "2026-06-07T00:00:00Z",
      storageKey: "mossx-large",
      scanRunId: "scan-large",
      endpoints,
      groups,
      schemas: [],
      callChains: [{
        id: "chain-0",
        endpointId: "endpoint-0",
        maxDepth: 1,
        truncatedReason: "max-depth-1-conservative-scan",
        edges: [{
          id: "edge-0",
          sourceSymbol: "OrderController.create0",
          targetSymbol: "orderService.createOrder0",
          sourceFile: "src/routes/orders.ts",
          line: 3,
          excerpt: "return orderService.createOrder0(req.body);",
          direction: "forward",
          kind: "service",
          confidence: "low",
          evidence: [],
        }],
      }],
      skipped: [],
    },
    readErrors: [],
  };
}

describe("ProjectMapRelationshipSection API tab smoke", () => {
  beforeEach(() => {
    vi.mocked(readProjectMapRelationships).mockResolvedValue(buildLargeApiContractResponse() as never);
    vi.mocked(scanProjectMapRelationships).mockResolvedValue({
      storageKey: "mossx-large",
      storageDir: "/tmp/project-map-relations/mossx-large",
      scanRunId: "scan-large",
      generatedAt: "2026-06-07T00:00:00Z",
      scannedRoot: "/workspace",
      fileCount: 1,
      relationCount: 0,
      apiEndpointCount: 64,
      apiGroupCount: 3,
      ignoredCount: 0,
      repairIssueCount: 0,
    });
  });

  it("renders large API hierarchy, filters, endpoint inspector, and method chain evidence", async () => {
    const { container } = render(
      <ProjectMapRelationshipSection
        activeWorkspaceId="workspace-1"
        activeReadLocation="global"
        expanded
        reloadRelationshipContext={vi.fn().mockResolvedValue(undefined)}
        scanRequestId={0}
        onSummaryStateChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(readProjectMapRelationships).toHaveBeenCalled());

    fireEvent.click(screen.getByText("projectMap.relationship.view.api"));

    await screen.findByText("projectMap.relationship.apiWorkspaceTitle");
    expect(container.querySelector(".project-map-api-contract-filters")).toBeTruthy();
    expect(screen.getAllByText("orders-service").length).toBeGreaterThan(0);
    const controllerButton = screen
      .getAllByText("OrderController")
      .map((element) => element.closest("button"))
      .find((element): element is HTMLButtonElement => Boolean(element));
    if (!controllerButton) {
      throw new Error("Expected OrderController drill-down button to be rendered");
    }

    fireEvent.click(controllerButton);

    expect(screen.getAllByText("/api/orders/0").length).toBeGreaterThan(0);
    expect(screen.getByText("projectMap.relationship.apiOverviewTitle")).toBeTruthy();
    expect(screen.getByText("projectMap.relationship.apiInvocationTitle")).toBeTruthy();
    expect(screen.getByText("orderParam.orderNo")).toBeTruthy();
    expect(screen.getByText("projectMap.relationship.apiMethodChainTitle")).toBeTruthy();
    expect(container.querySelector(".project-map-api-contract-method-chain-list")).toBeTruthy();
    expect(screen.getAllByText("OrderController.create0").length).toBeGreaterThan(0);
    expect(screen.getByText("orderService.createOrder0")).toBeTruthy();
    expect(screen.getByText("return orderService.createOrder0(req.body);")).toBeTruthy();
  });
});
