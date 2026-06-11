import {
  getProjectMapRelationshipCallCandidate,
  type ProjectMapRelationshipDashboardData,
} from "../utils/relationshipDashboardModel";
import type {
  ProjectMapFileRelation,
  ProjectMapRelationshipSymbol,
  ProjectMapScannedFile,
} from "../types";

export type ProjectMapRelationshipDashboardViewMode = "graph" | "files" | "read" | "api";

export type ProjectMapRelationshipRelationGroup = {
  id: string;
  title: string;
  relations: ProjectMapFileRelation[];
};

export type ProjectMapRelationshipReadLane = "incoming" | "outgoing" | "verify";

export type ProjectMapRelationshipReadRelationCard = {
  id: string;
  lane: ProjectMapRelationshipReadLane;
  relation: ProjectMapFileRelation;
  file: ProjectMapScannedFile | null;
  title: string;
  path: string;
  evidencePath: string;
  evidenceLine: number | null;
  callCandidate: string | null;
};

export type ProjectMapRelationshipReadChainNode = {
  id: string;
  relationId: string | null;
  label: string;
  fileLabel: string;
  path: string;
  line: number | null;
  relationType: ProjectMapFileRelation["type"] | "method";
  confidence: ProjectMapFileRelation["confidence"] | "focus";
  children: ProjectMapRelationshipReadChainNode[];
};

export type ProjectMapRelationshipReadMethodCard = {
  id: string;
  name: string;
  kind: string;
  line: number | null;
  endLine: number | null;
  sourceSnippet: string[];
  sourceFlowNodes: ProjectMapRelationshipReadChainNode[];
  outgoing: ProjectMapFileRelation[];
  incoming: ProjectMapFileRelation[];
  chain: ProjectMapRelationshipReadChainNode;
};

type ProjectMapRelationshipReadSourceMethod = {
  id: string;
  name: string;
  line: number;
  endLine: number;
  signature: string;
  bodyLines: string[];
  flowNodes: ProjectMapRelationshipReadChainNode[];
};

export const READ_ANATOMY_MAX_INCOMING = 7;
export const READ_ANATOMY_MAX_OUTGOING = 9;
export const READ_ANATOMY_MAX_VERIFY = 4;
export const READ_METHOD_INDEX_LIMIT = 18;
export const READ_METHOD_CHAIN_BRANCH_LIMIT = 12;
const READ_METHOD_CHAIN_SECONDARY_LIMIT = 3;

const RELATION_CONFIDENCE_WEIGHT: Record<ProjectMapFileRelation["confidence"], number> = {
  high: 4,
  medium: 3,
  low: 2,
  unknown: 1,
};

export function formatProjectMapReadPathEvidence(relation: ProjectMapFileRelation): string {
  const evidence = relation.evidence[0];
  if (!evidence) {
    return relation.confidence;
  }
  return `${relation.confidence} · ${evidence.path}${evidence.line ? `:${evidence.line}` : ""}`;
}

export function getProjectMapReadPathBasename(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] || path;
}

export function isProjectMapReadVerifyRelation(relation: ProjectMapFileRelation): boolean {
  return relation.type === "tested_by"
    || relation.type === "specified_by"
    || relation.type === "documents"
    || relation.type === "styled_by";
}

export function isProjectMapReadAnatomyRelation(relation: ProjectMapFileRelation): boolean {
  return relation.type === "calls"
    || relation.type === "bridges_to"
    || relation.type === "configures";
}

export function sortProjectMapReadRelations(
  left: ProjectMapFileRelation,
  right: ProjectMapFileRelation,
): number {
  const confidenceDelta = RELATION_CONFIDENCE_WEIGHT[right.confidence] - RELATION_CONFIDENCE_WEIGHT[left.confidence];
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }
  return (left.evidence[0]?.line ?? Number.MAX_SAFE_INTEGER) - (right.evidence[0]?.line ?? Number.MAX_SAFE_INTEGER);
}

function sortProjectMapReadRelationsByEvidenceLine(
  left: ProjectMapFileRelation,
  right: ProjectMapFileRelation,
): number {
  return (left.evidence[0]?.line ?? Number.MAX_SAFE_INTEGER) - (right.evidence[0]?.line ?? Number.MAX_SAFE_INTEGER);
}

function getProjectMapReadRelationCounterpart(
  relation: ProjectMapFileRelation,
  inspectedFileId: string,
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>,
): ProjectMapScannedFile | null {
  const counterpartId = relation.sourceFileId === inspectedFileId
    ? relation.targetFileId
    : relation.sourceFileId;
  return relationshipDashboardFileIndex.get(counterpartId) ?? null;
}

function getProjectMapReadRelationTitle(
  relation: ProjectMapFileRelation,
  inspectedFile: ProjectMapScannedFile,
  counterpartFile: ProjectMapScannedFile | null,
): string {
  const sourceLabel = relation.sourceFileId === inspectedFile.id
    ? inspectedFile.basename
    : counterpartFile?.basename ?? relation.sourceFileId;
  const targetLabel = relation.targetFileId === inspectedFile.id
    ? inspectedFile.basename
    : counterpartFile?.basename ?? relation.targetFileId;
  return `${sourceLabel} -> ${targetLabel}`;
}

export function buildProjectMapReadRelationCard(input: {
  relation: ProjectMapFileRelation;
  lane: ProjectMapRelationshipReadLane;
  inspectedFile: ProjectMapScannedFile;
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
}): ProjectMapRelationshipReadRelationCard {
  const counterpartFile = getProjectMapReadRelationCounterpart(
    input.relation,
    input.inspectedFile.id,
    input.relationshipDashboardFileIndex,
  );
  const evidence = input.relation.evidence[0];
  const fallbackPath = counterpartFile?.path ?? input.inspectedFile.path;
  return {
    id: `${input.lane}:${input.relation.id}`,
    lane: input.lane,
    relation: input.relation,
    file: counterpartFile,
    title: getProjectMapReadRelationTitle(input.relation, input.inspectedFile, counterpartFile),
    path: counterpartFile?.path ?? fallbackPath,
    evidencePath: evidence?.path ?? fallbackPath,
    evidenceLine: evidence?.line ?? null,
    callCandidate: getProjectMapRelationshipCallCandidate(input.relation),
  };
}

function isProjectMapReadMethodSymbol(kind: string): boolean {
  const normalizedKind = kind.toLowerCase();
  return normalizedKind.includes("method")
    || normalizedKind.includes("function")
    || normalizedKind.includes("constructor")
    || normalizedKind === "fn";
}

function getProjectMapReadTerminalCallName(candidate: string | null): string | null {
  if (!candidate) {
    return null;
  }
  const trimmed = candidate.replace(/\(.*/, "").trim();
  const segments = trimmed.split(".");
  return segments[segments.length - 1] || trimmed;
}

function getProjectMapReadRelationLineForFile(
  relation: ProjectMapFileRelation,
  path: string,
): number | null {
  const evidence = relation.evidence.find((entry) => entry.path === path) ?? relation.evidence[0];
  return evidence?.line ?? null;
}

function findProjectMapReadMethodIdByLine(
  methodSymbols: ProjectMapRelationshipSymbol[],
  line: number | null,
): string | null {
  if (!line) {
    return null;
  }
  let selectedMethod: ProjectMapRelationshipSymbol | null = null;
  for (const symbol of methodSymbols) {
    if (symbol.line > line) {
      break;
    }
    selectedMethod = symbol;
  }
  return selectedMethod?.id ?? null;
}

function getProjectMapReadMethodDeclarationName(line: string, language: ProjectMapScannedFile["language"]): string | null {
  const trimmed = line.trim();
  if (
    !trimmed
    || trimmed.startsWith("//")
    || trimmed.startsWith("*")
    || trimmed.startsWith("@")
    || /^(if|for|while|switch|catch|return|throw|new|else|do)\b/.test(trimmed)
  ) {
    return null;
  }
  if (language === "python") {
    const match = /^def\s+([A-Za-z_]\w*)\s*\(/.exec(trimmed);
    return match?.[1] ?? null;
  }
  if (language === "typescript" || language === "javascript") {
    const functionMatch = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(trimmed);
    if (functionMatch?.[1]) {
      return functionMatch[1];
    }
    const arrowMatch = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=.*=>/.exec(trimmed);
    return arrowMatch?.[1] ?? null;
  }
  if (language === "java" || language === "kotlin" || language === "csharp") {
    if (!trimmed.includes("(") || !trimmed.includes(")")) {
      return null;
    }
    const withoutGenerics = trimmed.replace(/<[^>]+>/g, "");
    const match = /(?:public|private|protected|static|final|synchronized|abstract|native|override|\s)+[\w[\].?]+\s+([A-Za-z_$][\w$]*)\s*\(/.exec(withoutGenerics);
    return match?.[1] ?? null;
  }
  const genericMatch = /(?:function\s+|fn\s+|func\s+)([A-Za-z_$][\w$]*)\s*\(/.exec(trimmed);
  return genericMatch?.[1] ?? null;
}

function getProjectMapReadBraceDelta(line: string): number {
  let delta = 0;
  let inString: string | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const previous = index > 0 ? line[index - 1] : "";
    if ((character === "\"" || character === "'" || character === "`") && previous !== "\\") {
      inString = inString === character ? null : inString ?? character;
      continue;
    }
    if (inString) {
      continue;
    }
    if (character === "{") {
      delta += 1;
    } else if (character === "}") {
      delta -= 1;
    }
  }
  return delta;
}

function buildProjectMapReadSourceFlowNodes(input: {
  bodyLines: string[];
  methodLine: number;
  filePath: string;
}): ProjectMapRelationshipReadChainNode[] {
  const blockedNames = new Set([
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "return",
    "throw",
    "new",
    "super",
    "this",
  ]);
  const nodes: ProjectMapRelationshipReadChainNode[] = [];
  const seenByLineAndName = new Set<string>();
  for (const [offset, line] of input.bodyLines.entries()) {
    const sourceLine = input.methodLine + offset;
    if (sourceLine === input.methodLine) {
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) {
      continue;
    }
    const callPattern = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/g;
    for (const match of trimmed.matchAll(callPattern)) {
      const candidate = match[1];
      const terminalName = getProjectMapReadTerminalCallName(candidate);
      if (!candidate || !terminalName || blockedNames.has(terminalName) || blockedNames.has(candidate)) {
        continue;
      }
      const key = `${sourceLine}:${candidate}`;
      if (seenByLineAndName.has(key)) {
        continue;
      }
      seenByLineAndName.add(key);
      nodes.push({
        id: `source-flow:${sourceLine}:${candidate}`,
        relationId: null,
        label: candidate,
        fileLabel: getProjectMapReadPathBasename(input.filePath),
        path: input.filePath,
        line: sourceLine,
        relationType: "method",
        confidence: "focus",
        children: [],
      });
    }
  }
  return nodes.slice(0, READ_METHOD_CHAIN_BRANCH_LIMIT);
}

function buildProjectMapReadSourceMethods(input: {
  content: string;
  file: ProjectMapScannedFile;
}): ProjectMapRelationshipReadSourceMethod[] {
  const lines = input.content.split(/\r?\n/);
  const methods: ProjectMapRelationshipReadSourceMethod[] = [];
  let currentMethod: {
    name: string;
    line: number;
    startIndex: number;
    signature: string;
    braceDepth: number;
    bodyLines: string[];
  } | null = null;
  for (const [lineIndex, line] of lines.entries()) {
    if (!currentMethod) {
      const declarationName = getProjectMapReadMethodDeclarationName(line, input.file.language);
      if (!declarationName) {
        continue;
      }
      currentMethod = {
        name: declarationName,
        line: lineIndex + 1,
        startIndex: lineIndex,
        signature: line.trim(),
        braceDepth: Math.max(0, getProjectMapReadBraceDelta(line)),
        bodyLines: [line],
      };
      if (currentMethod.braceDepth === 0 && line.includes(";")) {
        currentMethod = null;
      }
      continue;
    }
    currentMethod.bodyLines.push(line);
    currentMethod.braceDepth += getProjectMapReadBraceDelta(line);
    if (currentMethod.braceDepth <= 0) {
      const methodLine = currentMethod.line;
      const bodyLines = currentMethod.bodyLines;
      methods.push({
        id: `source-method:${methodLine}:${currentMethod.name}`,
        name: currentMethod.name,
        line: methodLine,
        endLine: lineIndex + 1,
        signature: currentMethod.signature,
        bodyLines,
        flowNodes: buildProjectMapReadSourceFlowNodes({
          bodyLines,
          methodLine,
          filePath: input.file.path,
        }),
      });
      currentMethod = null;
    }
  }
  return methods.slice(0, READ_METHOD_INDEX_LIMIT);
}

function buildProjectMapReadRelationChainNode(input: {
  relation: ProjectMapFileRelation;
  inspectedFileId: string;
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
  relationLookup: ProjectMapFileRelation[];
  depth: number;
  visitedFileIds: Set<string>;
}): ProjectMapRelationshipReadChainNode {
  const targetFile = input.relationshipDashboardFileIndex.get(input.relation.targetFileId);
  const sourceFile = input.relationshipDashboardFileIndex.get(input.relation.sourceFileId);
  const displayFile = targetFile ?? sourceFile;
  const evidence = input.relation.evidence[0];
  const callCandidate = getProjectMapRelationshipCallCandidate(input.relation);
  const nextVisitedFileIds = new Set(input.visitedFileIds);
  nextVisitedFileIds.add(input.relation.targetFileId);
  const canExpand = input.depth < 2 && !input.visitedFileIds.has(input.relation.targetFileId);
  const children = canExpand
    ? input.relationLookup
        .filter((relation) => (
          relation.type === "calls"
          && relation.sourceFileId === input.relation.targetFileId
          && relation.targetFileId !== input.inspectedFileId
        ))
        .sort(sortProjectMapReadRelations)
        .slice(0, READ_METHOD_CHAIN_SECONDARY_LIMIT)
        .map((relation) => buildProjectMapReadRelationChainNode({
          relation,
          inspectedFileId: input.inspectedFileId,
          relationshipDashboardFileIndex: input.relationshipDashboardFileIndex,
          relationLookup: input.relationLookup,
          depth: input.depth + 1,
          visitedFileIds: nextVisitedFileIds,
        }))
    : [];
  return {
    id: `chain:${input.relation.id}:${input.depth}`,
    relationId: input.relation.id,
    label: callCandidate ?? displayFile?.basename ?? input.relation.targetFileId,
    fileLabel: displayFile?.basename ?? input.relation.targetFileId,
    path: displayFile?.path ?? evidence?.path ?? input.relation.id,
    line: evidence?.path === displayFile?.path ? evidence?.line ?? null : null,
    relationType: input.relation.type,
    confidence: input.relation.confidence,
    children,
  };
}

export function buildProjectMapReadMethodCards(input: {
  inspectedFile: ProjectMapScannedFile;
  readSourceContent: string | null;
  relatedRelations: ProjectMapFileRelation[];
  relationshipDashboardData: ProjectMapRelationshipDashboardData;
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
  formatFallbackLine: (line: number) => string;
}): ProjectMapRelationshipReadMethodCard[] {
  const sourceMethods = input.readSourceContent
    ? buildProjectMapReadSourceMethods({
        content: input.readSourceContent,
        file: input.inspectedFile,
      })
    : [];
  const outgoingCalls = input.relatedRelations.filter((relation) => (
    relation.type === "calls"
    && relation.sourceFileId === input.inspectedFile.id
  ));
  const incomingCalls = input.relatedRelations.filter((relation) => (
    relation.type === "calls"
    && relation.targetFileId === input.inspectedFile.id
  ));
  const callSiteLines = new Set(
    outgoingCalls
      .map((relation) => getProjectMapReadRelationLineForFile(relation, input.inspectedFile.path))
      .filter((line): line is number => Boolean(line)),
  );
  const callTerminalNames = new Set(
    outgoingCalls
      .map((relation) => getProjectMapReadTerminalCallName(getProjectMapRelationshipCallCandidate(relation)))
      .filter((name): name is string => Boolean(name)),
  );
  const methodSymbols = input.relationshipDashboardData.symbols
    .filter((symbol) => (
      symbol.fileId === input.inspectedFile.id
      && isProjectMapReadMethodSymbol(symbol.kind)
      && !callTerminalNames.has(symbol.name)
      && !callSiteLines.has(symbol.line)
    ))
    .sort((left, right) => left.line - right.line)
    .slice(0, READ_METHOD_INDEX_LIMIT);
  const methodCardsById = new Map<string, ProjectMapRelationshipReadMethodCard>();
  const methodEntries = sourceMethods.length
    ? sourceMethods.map((sourceMethod) => ({
        id: sourceMethod.id,
        name: sourceMethod.name,
        kind: "method",
        line: sourceMethod.line,
        endLine: sourceMethod.endLine,
        sourceSnippet: sourceMethod.bodyLines.slice(0, 28),
        sourceFlowNodes: sourceMethod.flowNodes,
      }))
    : methodSymbols.map((symbol) => ({
        id: symbol.id,
        name: symbol.name,
        kind: symbol.kind,
        line: symbol.line,
        endLine: null,
        sourceSnippet: [],
        sourceFlowNodes: [],
      }));
  for (const methodEntry of methodEntries) {
    methodCardsById.set(methodEntry.id, {
      id: methodEntry.id,
      name: methodEntry.name,
      kind: methodEntry.kind,
      line: methodEntry.line,
      endLine: methodEntry.endLine,
      sourceSnippet: methodEntry.sourceSnippet,
      sourceFlowNodes: methodEntry.sourceFlowNodes,
      outgoing: [],
      incoming: [],
      chain: {
        id: `method:${methodEntry.id}`,
        relationId: null,
        label: methodEntry.name,
        fileLabel: input.inspectedFile.basename,
        path: input.inspectedFile.path,
        line: methodEntry.line,
        relationType: "method",
        confidence: "focus",
        children: [],
      },
    });
  }
  if (!methodCardsById.size) {
    for (const relation of outgoingCalls.slice(0, READ_METHOD_INDEX_LIMIT)) {
      const line = getProjectMapReadRelationLineForFile(relation, input.inspectedFile.path);
      const methodId = `callsite:${line ?? relation.id}`;
      if (methodCardsById.has(methodId)) {
        continue;
      }
      const fallbackName = line ? input.formatFallbackLine(line) : input.inspectedFile.basename;
      methodCardsById.set(methodId, {
        id: methodId,
        name: fallbackName,
        kind: "callsite",
        line,
        endLine: null,
        sourceSnippet: [],
        sourceFlowNodes: [],
        outgoing: [],
        incoming: [],
        chain: {
          id: `method:${methodId}`,
          relationId: null,
          label: fallbackName,
          fileLabel: input.inspectedFile.basename,
          path: input.inspectedFile.path,
          line,
          relationType: "method",
          confidence: "focus",
          children: [],
        },
      });
    }
  }
  for (const relation of outgoingCalls) {
    const line = getProjectMapReadRelationLineForFile(relation, input.inspectedFile.path);
    const sourceMethod = sourceMethods.find((method) => (
      line !== null && line >= method.line && line <= method.endLine
    ));
    const methodId = sourceMethod?.id ?? findProjectMapReadMethodIdByLine(methodSymbols, line) ?? methodCardsById.keys().next().value;
    const methodCard = methodId ? methodCardsById.get(methodId) : null;
    if (!methodCard) {
      continue;
    }
    methodCard.outgoing.push(relation);
  }
  for (const relation of incomingCalls) {
    const terminalName = getProjectMapReadTerminalCallName(getProjectMapRelationshipCallCandidate(relation));
    const matchedMethod = methodSymbols.find((symbol) => symbol.name === terminalName);
    const methodId = matchedMethod?.id ?? methodCardsById.keys().next().value;
    const methodCard = methodId ? methodCardsById.get(methodId) : null;
    if (!methodCard) {
      continue;
    }
    methodCard.incoming.push(relation);
  }
  for (const methodCard of methodCardsById.values()) {
    methodCard.outgoing.sort(sortProjectMapReadRelationsByEvidenceLine);
    methodCard.incoming.sort(sortProjectMapReadRelations);
    methodCard.chain.children = methodCard.outgoing
      .slice(0, READ_METHOD_CHAIN_BRANCH_LIMIT)
      .map((relation) => buildProjectMapReadRelationChainNode({
        relation,
        inspectedFileId: input.inspectedFile.id,
        relationshipDashboardFileIndex: input.relationshipDashboardFileIndex,
        relationLookup: input.relationshipDashboardData.relations,
        depth: 0,
        visitedFileIds: new Set([input.inspectedFile.id]),
      }));
  }
  return Array.from(methodCardsById.values())
    .filter((methodCard) => methodCard.outgoing.length || methodCard.incoming.length || methodCard.kind !== "callsite")
    .slice(0, READ_METHOD_INDEX_LIMIT);
}

export function buildProjectMapReadRelationFlowNodes(input: {
  inspectedFile: ProjectMapScannedFile | null;
  outgoingRelations: ProjectMapFileRelation[];
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
}): ProjectMapRelationshipReadChainNode[] {
  return input.outgoingRelations.slice(0, READ_METHOD_CHAIN_BRANCH_LIMIT).map((relation) => {
    const targetFile = input.relationshipDashboardFileIndex.get(relation.targetFileId);
    const evidence = relation.evidence[0];
    return {
      id: `relation-flow:${relation.id}`,
      relationId: relation.id,
      label: getProjectMapRelationshipCallCandidate(relation) ?? targetFile?.basename ?? relation.targetFileId,
      fileLabel: targetFile?.basename ?? relation.targetFileId,
      path: targetFile?.path ?? evidence?.path ?? input.inspectedFile?.path ?? relation.id,
      line: evidence?.line ?? null,
      relationType: relation.type,
      confidence: relation.confidence,
      children: [],
    };
  });
}
