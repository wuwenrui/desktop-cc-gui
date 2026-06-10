import type {
  CanvasSemanticEdge,
  CanvasSemanticNode,
  IntentCanvasContextCompleteness,
  IntentCanvasDocument,
  IntentCanvasElementDigest,
  IntentCanvasRelationDigest,
  IntentCanvasTransmissionContext,
  IntentCanvasTransmissionEvidence,
  IntentCanvasTransmissionSemanticEdge,
  IntentCanvasTransmissionSemanticNode,
  IntentCanvasTransmissionVisualArrow,
} from "../types";
import type { IntentCanvasContextSendAttachment } from "../../../types";

const SEMANTIC_NODE_SEND_LIMIT = 240;
const SEMANTIC_EDGE_SEND_LIMIT = 480;
const EVIDENCE_SEND_LIMIT = 240;
const VISUAL_TEXT_SEND_LIMIT = 120;
const VISUAL_ARROW_SEND_LIMIT = 160;

function capItems<T>(items: T[], limit: number): { sent: T[]; omitted: number } {
  return {
    sent: items.slice(0, limit),
    omitted: Math.max(0, items.length - limit),
  };
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function uniqueByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const seenKeys = new Set<string>();
  const result: T[] = [];
  items.forEach((item) => {
    const key = getKey(item);
    if (seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    result.push(item);
  });
  return result;
}

function isDeletedSceneElement(value: unknown): boolean {
  return Boolean(
    value
      && typeof value === "object"
      && "isDeleted" in value
      && (value as { isDeleted?: unknown }).isDeleted === true,
  );
}

function getSceneElementType(value: unknown): string | null {
  return value
    && typeof value === "object"
    && typeof (value as { type?: unknown }).type === "string"
    ? (value as { type: string }).type
    : null;
}

function readSceneElementText(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const rawElement = value as { text?: unknown; originalText?: unknown; label?: unknown };
  const candidates = [rawElement.text, rawElement.originalText, rawElement.label];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function hasDisplayEllipsis(value: string): boolean {
  return value.includes("...") || value.includes("…");
}

function countVisualElements(document: IntentCanvasDocument): {
  totalElements: number;
  totalRelations: number;
  textBlocks: string[];
  displayAbbreviatedTextBlockCount: number;
  unlabeledShapeCount: number;
} {
  const textBlocks = new Set<string>();
  const displayAbbreviatedTextBlocks = new Set<string>();
  let totalElements = 0;
  let totalRelations = 0;
  let unlabeledShapeCount = 0;

  document.scene.elements.forEach((element) => {
    if (isDeletedSceneElement(element)) {
      return;
    }
    totalElements += 1;
    const type = getSceneElementType(element);
    if (type === "arrow" || type === "line") {
      totalRelations += 1;
    }
    const text = readSceneElementText(element);
    if (text) {
      if (hasDisplayEllipsis(text)) {
        displayAbbreviatedTextBlocks.add(text);
      } else {
        textBlocks.add(text);
      }
      return;
    }
    if (type && type !== "arrow" && type !== "line" && type !== "text") {
      unlabeledShapeCount += 1;
    }
  });

  return {
    totalElements,
    totalRelations,
    textBlocks: Array.from(textBlocks),
    displayAbbreviatedTextBlockCount: displayAbbreviatedTextBlocks.size,
    unlabeledShapeCount,
  };
}

function getSemanticNodeFilePath(node: CanvasSemanticNode): string | null {
  const anchor = node.sourceAnchor;
  if (anchor?.kind === "relationship-node" || anchor?.kind === "code-symbol") {
    return normalizeText(anchor.filePath);
  }
  return null;
}

function getSemanticNodeRole(node: CanvasSemanticNode): string | null {
  const anchor = node.sourceAnchor;
  if (anchor?.kind === "relationship-node") {
    return normalizeText(anchor.nodeKind);
  }
  if (anchor?.kind === "code-symbol") {
    return normalizeText(anchor.symbolKind);
  }
  const roleMatch = node.summary?.match(/role:([^;]+)/);
  return normalizeText(roleMatch?.[1] ?? null);
}

function toTransmissionSemanticNode(node: CanvasSemanticNode): IntentCanvasTransmissionSemanticNode {
  return {
    id: node.id,
    label: node.label,
    kind: node.kind,
    filePath: getSemanticNodeFilePath(node),
    role: getSemanticNodeRole(node),
    summary: normalizeText(node.summary),
  };
}

function toTransmissionSemanticEdge(edge: CanvasSemanticEdge): IntentCanvasTransmissionSemanticEdge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    relation: edge.relationKind,
    label: normalizeText(edge.label),
    evidenceIds: edge.evidenceIds?.length ? edge.evidenceIds : undefined,
  };
}

function collectSemanticNodes(document: IntentCanvasDocument): IntentCanvasTransmissionSemanticNode[] {
  return uniqueByKey(
    document.semanticGraphs.flatMap((graph) => graph.nodes.map(toTransmissionSemanticNode)),
    (node) => node.id,
  );
}

function collectSemanticEdges(document: IntentCanvasDocument): IntentCanvasTransmissionSemanticEdge[] {
  return uniqueByKey(
    document.semanticGraphs.flatMap((graph) => graph.edges.map(toTransmissionSemanticEdge)),
    (edge) => edge.id,
  );
}

function collectSemanticEvidence(
  edges: IntentCanvasTransmissionSemanticEdge[],
): IntentCanvasTransmissionEvidence[] {
  return uniqueByKey(
    edges.flatMap((edge) => (edge.evidenceIds ?? []).map((evidenceId) => ({
      id: evidenceId,
      summary: edge.label
        ? `${edge.source} -> ${edge.target}: ${edge.label}`
        : `${edge.source} -> ${edge.target}: ${edge.relation}`,
    }))),
    (evidence) => evidence.id,
  );
}

function buildElementLabelIndex(elements: IntentCanvasElementDigest[]): Map<string, string> {
  const labelsById = new Map<string, string>();
  elements.forEach((element) => {
    const label = normalizeText(element.label);
    if (label && !hasDisplayEllipsis(label)) {
      labelsById.set(element.id, label);
    }
  });
  return labelsById;
}

function toTransmissionVisualArrow(
  relation: IntentCanvasRelationDigest,
  labelsByElementId: ReadonlyMap<string, string>,
): IntentCanvasTransmissionVisualArrow {
  return {
    id: relation.id,
    from: relation.startBindingId ? labelsByElementId.get(relation.startBindingId) ?? relation.startBindingId : null,
    to: relation.endBindingId ? labelsByElementId.get(relation.endBindingId) ?? relation.endBindingId : null,
    label: normalizeText(relation.label),
  };
}

export function buildIntentCanvasTransmissionContext(
  document: IntentCanvasDocument,
  workspaceName?: string | null,
): IntentCanvasTransmissionContext {
  const visualCounts = countVisualElements(document);
  const semanticNodes = collectSemanticNodes(document);
  const semanticEdges = collectSemanticEdges(document);
  const semanticEvidence = collectSemanticEvidence(semanticEdges);
  const labelsByElementId = buildElementLabelIndex(document.aiContext.elementDigest);
  const visualArrows = document.aiContext.relationDigest.map((relation) =>
    toTransmissionVisualArrow(relation, labelsByElementId),
  );
  const sentVisualDigestElementCount = Math.min(
    document.aiContext.elementDigest.length,
    visualCounts.totalElements,
  );
  const omittedVisualDigestElementCount = Math.max(
    0,
    visualCounts.totalElements - sentVisualDigestElementCount,
  );

  const cappedNodes = capItems(semanticNodes, SEMANTIC_NODE_SEND_LIMIT);
  const cappedEdges = capItems(semanticEdges, SEMANTIC_EDGE_SEND_LIMIT);
  const cappedEvidence = capItems(semanticEvidence, EVIDENCE_SEND_LIMIT);
  const cappedTextBlocks = capItems(visualCounts.textBlocks, VISUAL_TEXT_SEND_LIMIT);
  const cappedVisualArrows = capItems(visualArrows, VISUAL_ARROW_SEND_LIMIT);
  const totalOmitted =
    omittedVisualDigestElementCount
    + cappedNodes.omitted
    + cappedEdges.omitted
    + cappedEvidence.omitted
    + cappedTextBlocks.omitted
    + visualCounts.displayAbbreviatedTextBlockCount
    + Math.max(0, visualCounts.totalRelations - cappedVisualArrows.sent.length);
  const hasSemanticGraph = semanticNodes.length > 0 || semanticEdges.length > 0;
  const compressionMode: IntentCanvasContextCompleteness["compressionMode"] =
    totalOmitted > 0 ? "chunked" : hasSemanticGraph ? "semantic" : "compact";

  const completeness: IntentCanvasContextCompleteness = {
    elements: {
      total: visualCounts.totalElements,
      sent: sentVisualDigestElementCount,
      omitted: omittedVisualDigestElementCount,
    },
    semanticNodes: {
      total: semanticNodes.length,
      sent: cappedNodes.sent.length,
      omitted: cappedNodes.omitted,
    },
    semanticEdges: {
      total: semanticEdges.length,
      sent: cappedEdges.sent.length,
      omitted: cappedEdges.omitted,
    },
    evidence: {
      total: semanticEvidence.length,
      sent: cappedEvidence.sent.length,
      omitted: cappedEvidence.omitted,
    },
    visualTextBlocks: {
      total: visualCounts.textBlocks.length + visualCounts.displayAbbreviatedTextBlockCount,
      sent: cappedTextBlocks.sent.length,
      omitted: cappedTextBlocks.omitted + visualCounts.displayAbbreviatedTextBlockCount,
    },
    visualArrows: {
      total: visualCounts.totalRelations,
      sent: cappedVisualArrows.sent.length,
      omitted: Math.max(0, visualCounts.totalRelations - cappedVisualArrows.sent.length),
    },
    unlabeledShapeCount: visualCounts.unlabeledShapeCount,
    truncated: totalOmitted > 0,
    compressionMode,
  };

  return {
    type: "intent_canvas_context",
    version: 2,
    canvasId: document.id,
    title: document.title,
    mode: document.mode,
    workspaceName: workspaceName ?? document.workspace.name,
    summary: document.summary,
    links: document.links,
    updatedAt: document.updatedAt,
    completeness,
    semanticGraph: {
      nodes: cappedNodes.sent,
      edges: cappedEdges.sent,
      evidence: cappedEvidence.sent,
    },
    visualClues: {
      textBlocks: cappedTextBlocks.sent,
      arrows: cappedVisualArrows.sent,
      unlabeledShapeCount: visualCounts.unlabeledShapeCount,
    },
  };
}

export function buildIntentCanvasContextAttachment(
  document: IntentCanvasDocument,
  workspaceName: string | null | undefined,
): IntentCanvasContextSendAttachment {
  const transmissionContext = buildIntentCanvasTransmissionContext(document, workspaceName);
  const rawPayload = JSON.stringify(transmissionContext);
  const completeness = transmissionContext.completeness;
  return {
    kind: "intent_canvas_context",
    attachmentId: `intent-canvas-${document.id}-${document.updatedAt}`,
    canvasId: document.id,
    title: document.title,
    mode: document.mode,
    compressionMode: completeness.compressionMode,
    truncated: completeness.truncated,
    payloadCharacters: rawPayload.length,
    rawPayload,
    semanticNodes: completeness.semanticNodes,
    semanticEdges: completeness.semanticEdges,
    evidence: completeness.evidence,
    visualTextBlocks: completeness.visualTextBlocks,
  };
}

function listOrNone(items: string[]): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ["- none"];
}

function formatCountLine(label: string, value: { total: number; sent: number; omitted: number }): string {
  const omitted = value.omitted > 0 ? `, omitted ${value.omitted}` : "";
  return `- ${label}: ${value.sent}/${value.total}${omitted}`;
}

export function formatIntentCanvasThreadContext(
  document: IntentCanvasDocument,
  workspaceName: string | null | undefined,
): string {
  const transmissionContext = buildIntentCanvasTransmissionContext(document, workspaceName);
  const compactTransmissionPayload = JSON.stringify(transmissionContext);
  const visualCountsForAudit = countVisualElements(document);
  const payloadContainsLiteralEllipsis = hasDisplayEllipsis(compactTransmissionPayload);
  const modeLabel =
    document.mode === "architect"
      ? "架构师白板 Architect Canvas"
      : document.mode === "spotlight"
        ? "代码探照灯 Code Spotlight"
        : "文件意图图 File Intent Canvas";

  return [
    "请把下面的 Intent Canvas 当作本轮对话的结构化上下文。",
    "它是用户绘制的意图/逻辑图，不代表代码已经实现，也不要自动写回 Project Map 事实。",
    "上下文已做语义压缩：优先保留 Project Map 语义节点、关系、文件路径、证据线索和用户手写文本；视觉坐标、颜色、尺寸等低价值绘图信息默认不发送。",
    "审计口径：下面的 JSON 是本次实际发送给模型的完整 transmission payload；它不是原始 Excalidraw scene 全量导出。",
    "JSON 使用 compact/minified 格式压缩展示体积，不省略字段；如果 truncated=yes 或任一 omitted > 0，表示内容层做了显式语义压缩，不是静默截断。",
    "",
    `Canvas: ${document.title}`,
    `Mode: ${modeLabel}`,
    `Workspace: ${workspaceName ?? document.workspace.name ?? "unknown"}`,
    `Updated: ${document.updatedAt}`,
    `Compression mode: ${transmissionContext.completeness.compressionMode}`,
    "",
    "Payload audit:",
    "- JSON payload complete: yes",
    "- JSON format: compact/minified",
    "- Raw canvas scene complete: no; low-value visual coordinates/styles are summarized",
    "- Display-abbreviated visual text with literal ellipsis is excluded from JSON visualClues",
    `- Literal ellipsis remains in JSON: ${payloadContainsLiteralEllipsis ? "yes" : "no"}`,
    `- Display-abbreviated visual text excluded: ${visualCountsForAudit.displayAbbreviatedTextBlockCount}`,
    `- Content truncated: ${transmissionContext.completeness.truncated ? "yes" : "no"}`,
    `- Payload characters: ${compactTransmissionPayload.length}`,
    "",
    "Intent Summary:",
    document.summary.trim() || "未填写",
    "",
    "Linked files:",
    ...listOrNone(document.links.filePaths),
    "",
    "Linked Project Map nodes:",
    ...listOrNone(document.links.projectMapNodeIds),
    "",
    "Linked threads:",
    ...listOrNone(document.links.threadIds),
    "",
    "Context completeness:",
    formatCountLine("visual digest elements", transmissionContext.completeness.elements),
    formatCountLine("semantic nodes", transmissionContext.completeness.semanticNodes),
    formatCountLine("semantic edges", transmissionContext.completeness.semanticEdges),
    formatCountLine("evidence clues", transmissionContext.completeness.evidence),
    formatCountLine("visual text blocks", transmissionContext.completeness.visualTextBlocks),
    formatCountLine("visual arrows", transmissionContext.completeness.visualArrows),
    `- unlabeled visual shapes compressed: ${transmissionContext.completeness.unlabeledShapeCount}`,
    `- truncated: ${transmissionContext.completeness.truncated ? "yes" : "no"}`,
    "",
    "Structured transmission payload compact JSON:",
    "```json",
    compactTransmissionPayload,
    "```",
  ].join("\n");
}
