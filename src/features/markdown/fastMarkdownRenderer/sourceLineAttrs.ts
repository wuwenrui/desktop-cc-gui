import type { Root as HastRoot, Element, ElementContent } from "hast";
import type { MarkdownSourceLineAnchor } from "./types";

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

/**
 * Walk the HAST tree, attach data-source-line-start/end to block-level
 * elements, and return a flat list of {blockId, startLine, endLine}
 * that consumers can use to scroll/jump without re-querying the DOM.
 */
export function attachSourceLineAttrs(
  root: HastRoot,
  bodyStartLine: number = 1,
  documentKey: string = "",
): MarkdownSourceLineAnchor[] {
  const anchors: MarkdownSourceLineAnchor[] = [];
  const usedBlockIds = new Set<string>();

  const visit = (node: ElementContent | HastRoot) => {
    if (node.type === "root") {
      for (const child of node.children) {
        visit(child as ElementContent);
      }
      return;
    }
    if (node.type === "element") {
      const element = node as Element;
      if (BLOCK_TAGS.has(element.tagName) && element.position) {
        const startLine = element.position.start.line + bodyStartLine - 1;
        const endLine = element.position.end.line + bodyStartLine - 1;
        const blockId = ensureUniqueBlockId(
          usedBlockIds,
          `${element.tagName}:${startLine}:${endLine}`,
        );
        attachLineData(element, startLine, endLine, blockId);
        anchors.push({ blockId, startLine, endLine });
      }
      for (const child of element.children) {
        visit(child as ElementContent);
      }
    }
  };

  visit(root);

  if (documentKey) {
    // No-op: keep documentKey for future telemetry hooks.
  }

  return anchors;
}

function ensureUniqueBlockId(usedBlockIds: Set<string>, baseId: string) {
  let nextId = baseId;
  let suffix = 1;
  while (usedBlockIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedBlockIds.add(nextId);
  return nextId;
}

function attachLineData(
  element: Element,
  startLine: number,
  endLine: number,
  blockId: string,
) {
  element.properties = {
    ...(element.properties ?? {}),
    "data-source-line-start": String(startLine),
    "data-source-line-end": String(endLine),
    "data-source-block-id": blockId,
  };
}
