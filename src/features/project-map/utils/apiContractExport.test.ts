import { describe, expect, it } from "vitest";

import { buildProjectMapApiExportFile } from "./apiContractExport";
import type { ProjectMapApiContractGraph } from "../types";

function buildExportFixture(): ProjectMapApiContractGraph {
  return {
    schemaVersion: 1,
    generatedAt: "2026-06-07T00:00:00Z",
    endpoints: [{
      id: "endpoint-1",
      protocol: "http",
      language: "typescript",
      framework: "Express",
      method: "GET",
      path: "/api/users/{id}",
      operationName: "getUser",
      handlerSymbol: "UserController.getUser",
      sourceFile: "src/routes/users.ts",
      parameters: [{
        name: "id",
        location: "path",
        required: true,
        description: "用户 ID <script>alert(1)</script>",
        schema: {
          id: "schema-string",
          name: "string",
        },
        evidence: [],
      }, {
        name: "filter",
        location: "query",
        required: false,
        description: "过滤条件",
        schema: {
          id: "schema-user-filter",
          name: "UserFilter",
        },
        evidence: [],
      }, {
        name: "payload",
        location: "body",
        required: true,
        description: "创建参数",
        schema: {
          id: "schema-create-user",
          name: "CreateUserRequest",
        },
        structuredFields: [{
          name: "name",
          type: "string",
          required: true,
          description: "用户名",
          example: "湘宁",
        }],
        evidence: [],
      }],
      requestBody: {
        contentType: "application/json",
        required: true,
        schema: {
          id: "schema-create-user",
          name: "CreateUserRequest",
        },
        structuredFields: [{
          name: "name",
          type: "string",
          required: true,
          description: "用户名",
          example: "湘宁",
        }],
        evidence: [],
      },
      responses: [{
        statusCode: "200",
        contentType: "application/json",
        schema: {
          id: "schema-user",
          name: "UserDto",
        },
        structuredFields: [{
          name: "name",
          type: "string",
          required: true,
          description: "User name",
        }],
        isError: false,
        evidence: [],
      }],
      description: "获取用户 <img src=x onerror=alert(1)>",
      descriptionSources: [{
        kind: "doc-comment",
        text: "获取用户 <img src=x onerror=alert(1)>",
        evidence: [],
      }],
      groupIds: [],
      callChainIds: [],
      confidence: "high",
      evidence: [{
        path: "src/routes/users.ts",
        line: 12,
        parserSource: "fallback-pattern",
        redacted: false,
      }],
    }],
    groups: [],
    schemas: [],
    callChains: [],
  };
}

describe("apiContractExport", () => {
  it("escapes executable markup in HTML exports", () => {
    const file = buildProjectMapApiExportFile(buildExportFixture(), "html");

    expect(file.filename).toBe("api-contracts.html");
    expect(file.content).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(file.content).not.toContain("<script>");
    expect(file.content).not.toContain("<img src=x onerror=alert(1)>");
  });

  it("exports OpenAPI 3 JSON with project-map metadata", () => {
    const file = buildProjectMapApiExportFile(buildExportFixture(), "openapi-json");
    const document = JSON.parse(file.content);

    expect(file.filename).toBe("api-contracts.openapi.json");
    expect(document.openapi).toBe("3.0.3");
    expect(document.paths["/api/users/{id}"].get.operationId).toBe("getUser");
    expect(document.paths["/api/users/{id}"].get["x-project-map-confidence"]).toBe("high");
    expect(document.paths["/api/users/{id}"].get.parameters).toHaveLength(2);
    expect(document.paths["/api/users/{id}"].get.parameters[1].schema).toEqual({
      type: "object",
      "x-project-map-schemaName": "UserFilter",
    });
    expect(document.paths["/api/users/{id}"].get.requestBody.content["application/json"].schema.properties.name.description).toBe("用户名");
  });

  it("does not fabricate OpenAPI operations for unsupported or pathless endpoints", () => {
    const graph = buildExportFixture();
    graph.endpoints.push({
      id: "graphql-users",
      protocol: "graphql",
      language: "typescript",
      sourceFile: "src/schema.graphql",
      parameters: [],
      responses: [],
      groupIds: [],
      callChainIds: [],
      confidence: "spec",
      evidence: [],
    });

    const file = buildProjectMapApiExportFile(graph, "openapi-json");
    const document = JSON.parse(file.content);

    expect(document.paths["/graphql-users"]).toBeUndefined();
    expect(document["x-project-map-unsupportedEndpoints"]).toEqual([
      expect.objectContaining({
        id: "graphql-users",
        protocol: "graphql",
        reason: "path-unavailable",
      }),
    ]);
  });
});
