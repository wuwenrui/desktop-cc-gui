import type { ProjectMapApiEndpoint, ProjectMapApiGroup } from "../types";

export type ProjectMapApiGroupWithCount = ProjectMapApiGroup & {
  endpointCount: number;
};

export type ProjectMapApiEndpointSection = {
  id: string;
  title: string;
  hint: string;
  endpoints: ProjectMapApiEndpoint[];
};

function projectMapApiSearchIncludes(query: string, values: Array<string | null | undefined>): boolean {
  if (!query) {
    return true;
  }
  return values.some((value) => value?.toLowerCase().includes(query));
}

export function projectMapApiEndpointMatchesQuery(endpoint: ProjectMapApiEndpoint, query: string): boolean {
  return projectMapApiSearchIncludes(query, [
    endpoint.id,
    endpoint.protocol,
    endpoint.language,
    endpoint.framework,
    endpoint.method,
    endpoint.path,
    endpoint.operationName,
    endpoint.handlerSymbol,
    endpoint.sourceFile,
    endpoint.description,
    endpoint.usageScenario,
    ...endpoint.parameters.flatMap((parameter) => [
      parameter.name,
      parameter.location,
      parameter.schema?.name,
      parameter.schema?.sourceFile,
      parameter.defaultValue,
      parameter.example,
    ]),
    endpoint.requestBody?.contentType,
    endpoint.requestBody?.schema?.name,
    endpoint.requestBody?.schema?.sourceFile,
    ...endpoint.responses.flatMap((response) => [
      response.statusCode,
      response.contentType,
      response.schema?.name,
      response.schema?.sourceFile,
    ]),
    ...endpoint.evidence.flatMap((evidence) => [
      evidence.path,
      evidence.excerpt,
      evidence.parserSource,
    ]),
  ]);
}

export function projectMapApiGroupMatchesQuery(group: ProjectMapApiGroup, query: string): boolean {
  return projectMapApiSearchIncludes(query, [
    group.id,
    group.label,
    group.level,
    group.parentId,
  ]);
}
