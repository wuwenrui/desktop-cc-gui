import type {
  ProjectMapApiEndpoint,
  ProjectMapApiEvidence,
  ProjectMapApiGroup,
  ProjectMapApiParameter,
  ProjectMapApiResponse,
  ProjectMapApiStructuredSchemaField,
} from "../types";

export type ProjectMapApiGroupWithCount = ProjectMapApiGroup & {
  endpointCount: number;
};

export type ProjectMapApiEndpointSection = {
  id: string;
  title: string;
  hint: string;
  endpoints: ProjectMapApiEndpoint[];
};

export type ProjectMapApiEndpointRow = {
  id: string;
  methodLabel: string;
  pathLabel: string;
  handlerLabel: string | null;
  summary: string | null;
};

export type ProjectMapApiDetailSchemaField = {
  path: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  description?: string;
  enumValues: string[];
  range?: string;
  example?: string;
  depth: number;
};

export type ProjectMapApiDetailInputParameter = {
  name: string;
  location: ProjectMapApiParameter["location"];
  type: string;
  required?: boolean;
  defaultValue?: string;
  description?: string;
  example?: string;
  fields: ProjectMapApiDetailSchemaField[];
};

export type ProjectMapApiDetailResponse = {
  statusCode: string;
  contentType: string;
  rawType: string;
  businessType: string;
  description?: string;
  isError?: boolean;
  fields: ProjectMapApiDetailSchemaField[];
};

export type ProjectMapApiEndpointDetail = {
  overview: {
    interfaceName: string;
    methodName: string;
    chineseComment: string | null;
    description: string | null;
    scenario: string | null;
    version: string | null;
  };
  invocation: {
    httpMethod: string;
    url: string;
    contentType: string;
    headers: ProjectMapApiDetailInputParameter[];
    requestExample: string | null;
  };
  inputParameters: ProjectMapApiDetailInputParameter[];
  responses: ProjectMapApiDetailResponse[];
  descriptionBlocks: Array<{ kind: string; text: string }>;
  evidence: ProjectMapApiEvidence[];
};

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  return values.find((value) => value && value.trim().length > 0)?.trim() ?? null;
}

function normalizeTypeLabel(value: string | null | undefined): string {
  return value?.trim() || "unavailable";
}

function extractPathVersion(path: string | null | undefined): string | null {
  const match = path?.match(/\/(v\d+(?:\.\d+)*)\b/i);
  return match?.[1] ?? null;
}

function unwrapBusinessType(typeName: string): string {
  const trimmed = typeName.trim();
  const genericMatch = /^(?:R|Result|ResponseEntity|Mono|Flux|CompletableFuture)<(.+)>$/.exec(trimmed);
  if (genericMatch?.[1]) {
    return genericMatch[1].trim();
  }
  return trimmed;
}

function fieldDescription(field: ProjectMapApiStructuredSchemaField): string | undefined {
  return firstNonEmpty([
    field.description,
    field.enumValues?.length ? `enum: ${field.enumValues.join(", ")}` : null,
    field.range,
  ]) ?? undefined;
}

function flattenStructuredFields(
  fields: ProjectMapApiStructuredSchemaField[] | undefined,
  parentPath: string,
  depth = 0,
): ProjectMapApiDetailSchemaField[] {
  if (!fields?.length || depth > 5) {
    return [];
  }
  return fields.flatMap((field) => {
    const path = parentPath ? `${parentPath}.${field.name}` : field.name;
    return [
      {
        path,
        name: field.name,
        type: field.type,
        required: field.required,
        defaultValue: field.defaultValue,
        description: fieldDescription(field),
        enumValues: field.enumValues ?? [],
        range: field.range,
        example: field.example,
        depth,
      },
      ...flattenStructuredFields(field.children, path, depth + 1),
    ];
  });
}

function buildParameterFields(parameter: ProjectMapApiParameter): ProjectMapApiDetailSchemaField[] {
  return flattenStructuredFields(parameter.structuredFields, parameter.name);
}

function buildInputParameter(parameter: ProjectMapApiParameter): ProjectMapApiDetailInputParameter {
  return {
    name: parameter.name,
    location: parameter.location,
    type: normalizeTypeLabel(parameter.schema?.name ?? parameter.defaultValue),
    required: parameter.required,
    defaultValue: parameter.defaultValue,
    description: parameter.description,
    example: parameter.example,
    fields: buildParameterFields(parameter),
  };
}

function requestExampleFromInputs(parameters: ProjectMapApiDetailInputParameter[]): string | null {
  const body = parameters.find((parameter) => parameter.location === "body");
  if (!body) {
    return null;
  }
  const bodyFields = body.fields.filter((field) => field.depth === 0);
  if (!bodyFields.length) {
    return body.type === "unavailable" ? null : `{ "${body.name}": "${body.type}" }`;
  }
  const sample = Object.fromEntries(bodyFields.map((field) => [
    field.name,
    field.example ?? (field.type?.toLowerCase().includes("boolean") ? true : "string"),
  ]));
  return JSON.stringify(sample, null, 2);
}

function responseDescription(response: ProjectMapApiResponse): string | undefined {
  return response.structuredFields
    ?.map((field) => field.description)
    .find((description): description is string => Boolean(description?.trim()));
}

function buildResponse(response: ProjectMapApiResponse): ProjectMapApiDetailResponse {
  const rawType = normalizeTypeLabel(response.schema?.name);
  return {
    statusCode: response.statusCode ?? "default",
    contentType: response.contentType ?? "application/json",
    rawType,
    businessType: unwrapBusinessType(rawType),
    description: responseDescription(response),
    isError: response.isError,
    fields: flattenStructuredFields(response.structuredFields, "data"),
  };
}

export function selectBestEndpointDescription(endpoint: ProjectMapApiEndpoint): string | null {
  const chineseDescription = endpoint.descriptionSources
    ?.map((source) => source.text)
    .find((text) => /[\u4e00-\u9fff]/.test(text));
  return firstNonEmpty([
    chineseDescription,
    endpoint.description,
    endpoint.descriptionSources?.[0]?.text,
    endpoint.usageScenario,
  ]);
}

export function buildProjectMapApiEndpointRow(endpoint: ProjectMapApiEndpoint): ProjectMapApiEndpointRow {
  return {
    id: endpoint.id,
    methodLabel: endpoint.method ?? endpoint.protocol.toUpperCase(),
    pathLabel: endpoint.path ?? endpoint.operationName ?? endpoint.handlerSymbol ?? endpoint.sourceFile,
    handlerLabel: endpoint.handlerSymbol ?? endpoint.operationName ?? null,
    summary: selectBestEndpointDescription(endpoint),
  };
}

export function buildProjectMapApiEndpointDetail(endpoint: ProjectMapApiEndpoint): ProjectMapApiEndpointDetail {
  const descriptionBlocks = [
    ...(endpoint.descriptionSources ?? []).map((source) => ({
      kind: source.kind,
      text: source.text,
    })),
    ...(endpoint.description ? [{ kind: "description", text: endpoint.description }] : []),
    ...(endpoint.usageScenario ? [{ kind: "usage", text: endpoint.usageScenario }] : []),
  ];
  const inputParameters = endpoint.parameters.map(buildInputParameter);
  const headers = inputParameters.filter((parameter) => parameter.location === "header");
  const description = selectBestEndpointDescription(endpoint);
  return {
    overview: {
      interfaceName: description ?? endpoint.operationName ?? endpoint.handlerSymbol ?? endpoint.path ?? endpoint.id,
      methodName: endpoint.handlerSymbol ?? endpoint.operationName ?? endpoint.id,
      chineseComment: descriptionBlocks.map((block) => block.text).find((text) => /[\u4e00-\u9fff]/.test(text)) ?? null,
      description,
      scenario: endpoint.usageScenario ?? null,
      version: extractPathVersion(endpoint.path),
    },
    invocation: {
      httpMethod: endpoint.method ?? endpoint.protocol.toUpperCase(),
      url: endpoint.path ?? endpoint.operationName ?? endpoint.id,
      contentType: endpoint.requestBody?.contentType ?? (inputParameters.some((parameter) => parameter.location === "body") ? "application/json" : "-") ,
      headers,
      requestExample: requestExampleFromInputs(inputParameters),
    },
    inputParameters,
    responses: endpoint.responses.map(buildResponse),
    descriptionBlocks,
    evidence: endpoint.evidence,
  };
}

function projectMapApiSearchIncludes(query: string, values: Array<string | null | undefined>): boolean {
  if (!query) {
    return true;
  }
  return values.some((value) => value?.toLowerCase().includes(query));
}

function schemaFieldSearchValues(fields: ProjectMapApiStructuredSchemaField[] | undefined): string[] {
  if (!fields?.length) {
    return [];
  }
  return fields.flatMap((field) => [
    field.name,
    field.type,
    field.description,
    field.defaultValue,
    field.example,
    field.range,
    ...(field.enumValues ?? []),
    ...schemaFieldSearchValues(field.children),
  ]).filter((value): value is string => Boolean(value));
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
    ...(endpoint.descriptionSources?.map((source) => source.text) ?? []),
    endpoint.usageScenario,
    ...endpoint.parameters.flatMap((parameter) => [
      parameter.name,
      parameter.location,
      parameter.schema?.name,
      parameter.schema?.sourceFile,
      parameter.description,
      parameter.defaultValue,
      parameter.example,
      ...schemaFieldSearchValues(parameter.structuredFields),
    ]),
    endpoint.requestBody?.contentType,
    endpoint.requestBody?.schema?.name,
    endpoint.requestBody?.schema?.sourceFile,
    ...schemaFieldSearchValues(endpoint.requestBody?.structuredFields),
    ...endpoint.responses.flatMap((response) => [
      response.statusCode,
      response.contentType,
      response.schema?.name,
      response.schema?.sourceFile,
      ...schemaFieldSearchValues(response.structuredFields),
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
