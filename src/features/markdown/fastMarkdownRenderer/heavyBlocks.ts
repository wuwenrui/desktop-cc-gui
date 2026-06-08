import type { Root as MdastRoot, RootContent, Code, Table, Html } from "mdast";
import type { FastMarkdownHeavyBlock, MarkdownHeavyBlockKind } from "./types";
import { hashStableString } from "../../files/utils/fileMarkdownDocument";

/**
 * Identify heavy blocks (mermaid/math/tables/large code) directly
 * from the mdast before HAST conversion. The block id MUST be stable
 * for the same document identity, source line range, language, and
 * block content so cached state survives same-content rerenders.
 */
export function extractHeavyBlocks(
  root: MdastRoot,
  bodyStartLine: number = 1,
): FastMarkdownHeavyBlock[] {
  const blocks: FastMarkdownHeavyBlock[] = [];
  const visit = (node: RootContent) => {
    if (node.type === "code") {
      const codeNode = node as Code;
      const kind = classifyCodeLanguage(codeNode.lang ?? null);
      const startLine = (codeNode.position?.start.line ?? 1) + bodyStartLine - 1;
      const endLine = (codeNode.position?.end.line ?? startLine) + bodyStartLine - 1;
      blocks.push({
        blockId: createBlockId("code", startLine, endLine, codeNode.lang ?? "", codeNode.value),
        kind,
        startLine,
        endLine,
        language: codeNode.lang ?? null,
        contentHash: hashStableString(codeNode.value),
      });
    } else if (node.type === "table") {
      const tableNode = node as Table;
      const startLine = (tableNode.position?.start.line ?? 1) + bodyStartLine - 1;
      const endLine = (tableNode.position?.end.line ?? startLine) + bodyStartLine - 1;
      const serialized = JSON.stringify({
        align: tableNode.align,
        rowCount: tableNode.children.length,
      });
      blocks.push({
        blockId: createBlockId("table", startLine, endLine, "", serialized),
        kind: "table",
        startLine,
        endLine,
        language: null,
        contentHash: hashStableString(serialized),
      });
    } else if (node.type === "html") {
      const htmlNode = node as Html;
      const startLine = (htmlNode.position?.start.line ?? 1) + bodyStartLine - 1;
      const endLine = (htmlNode.position?.end.line ?? startLine) + bodyStartLine - 1;
      blocks.push({
        blockId: createBlockId("html-raw", startLine, endLine, "", htmlNode.value),
        kind: "html-raw",
        startLine,
        endLine,
        language: null,
        contentHash: hashStableString(htmlNode.value),
      });
    } else if (node.type === "math") {
      const startLine = (node.position?.start.line ?? 1) + bodyStartLine - 1;
      const endLine = (node.position?.end.line ?? startLine) + bodyStartLine - 1;
      blocks.push({
        blockId: createBlockId("math", startLine, endLine, "", node.value),
        kind: "math",
        startLine,
        endLine,
        language: null,
        contentHash: hashStableString(node.value),
      });
    } else if (node.type === "inlineMath") {
      const startLine = (node.position?.start.line ?? 1) + bodyStartLine - 1;
      const endLine = (node.position?.end.line ?? startLine) + bodyStartLine - 1;
      blocks.push({
        blockId: createBlockId("math", startLine, endLine, "", node.value),
        kind: "math",
        startLine,
        endLine,
        language: null,
        contentHash: hashStableString(node.value),
      });
    }
    if ("children" in node) {
      for (const child of (node as { children: RootContent[] }).children) {
        visit(child);
      }
    }
  };

  for (const child of root.children) {
    visit(child);
  }
  return blocks;
}

function classifyCodeLanguage(language: string | null): MarkdownHeavyBlockKind {
  if (!language) {
    return "code-block";
  }
  const normalized = language.toLowerCase();
  if (normalized === "mermaid" || normalized === "flowchart") {
    return "mermaid";
  }
  if (normalized === "math" || normalized === "latex" || normalized === "tex") {
    return "math";
  }
  return "code-block";
}

function createBlockId(
  kind: string,
  startLine: number,
  endLine: number,
  language: string,
  content: string,
) {
  return `${kind}:${startLine}:${endLine}:${language || "-"}:${hashStableString(content)}`;
}
