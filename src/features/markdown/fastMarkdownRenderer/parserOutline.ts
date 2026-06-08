import type { Root as MdastRoot, Heading, PhrasingContent, RootContent } from "mdast";
import type { MarkdownOutlineEntry } from "./types";

/**
 * Slugify a heading title into a stable anchor id.
 *
 * - Lowercase ASCII letters and digits are kept as-is.
 * - CJK characters and other unicode letters are kept verbatim
 *   (they remain stable across re-runs).
 * - Whitespace and unsafe URL characters collapse to a single dash.
 * - Disambiguated later by suffixing the ordinal for duplicates.
 */
export function slugifyHeadingTitle(title: string): string {
  if (!title) {
    return "heading";
  }
  const normalized = title
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, "-")
    .replace(/[`*_~()[\]{}<>|#!?.,:;'"/=+&%@$^|]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (!normalized) {
    return "heading";
  }
  return normalized;
}

function headingDepth(depth: number): MarkdownOutlineEntry["depth"] {
  if (depth <= 1) return 1;
  if (depth >= 6) return 6;
  return depth as MarkdownOutlineEntry["depth"];
}

function collectHeadingText(children: PhrasingContent[]): string {
  let buffer = "";
  for (const child of children) {
    if (child.type === "text" || child.type === "inlineCode") {
      buffer += child.value;
    } else if ("children" in child && Array.isArray(child.children)) {
      buffer += collectHeadingText(child.children as PhrasingContent[]);
    }
  }
  return buffer;
}

function collectHeadings(root: MdastRoot): Array<{
  depth: number;
  title: string;
  startLine: number;
  endLine: number;
}> {
  const headings: Array<{
    depth: number;
    title: string;
    startLine: number;
    endLine: number;
  }> = [];

  const visit = (node: RootContent, lastLine: number) => {
    if (node.type === "heading") {
      const headingNode = node as Heading;
      const startLine = headingNode.position?.start.line ?? lastLine;
      const endLine = headingNode.position?.end.line ?? startLine;
      headings.push({
        depth: headingNode.depth,
        title: collectHeadingText(headingNode.children),
        startLine,
        endLine,
      });
    }
    if ("children" in node) {
      const nextLine = (node as { position?: { end?: { line?: number } } }).position?.end?.line ?? lastLine;
      for (const child of (node as { children: RootContent[] }).children) {
        visit(child, nextLine);
      }
    }
  };

  for (const child of root.children) {
    visit(child, 0);
  }

  return headings;
}

/**
 * Extract outline entries from an mdast Root, with stable
 * disambiguated anchors for duplicate or empty headings.
 */
export function extractMarkdownOutline(
  root: MdastRoot,
  bodyStartLine: number = 1,
): MarkdownOutlineEntry[] {
  const headings = collectHeadings(root);
  const usedAnchors = new Set<string>();
  const entries: MarkdownOutlineEntry[] = [];

  headings.forEach((heading, index) => {
    const baseSlug = slugifyHeadingTitle(heading.title);
    let anchor = baseSlug;
    let suffix = 1;
    while (usedAnchors.has(anchor)) {
      anchor = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    usedAnchors.add(anchor);

    entries.push({
      id: `outline-${index}-${anchor}`,
      depth: headingDepth(heading.depth),
      title: heading.title || `Heading ${index + 1}`,
      startLine: heading.startLine + bodyStartLine - 1,
      endLine: heading.endLine + bodyStartLine - 1,
      anchor,
      ordinal: index,
    });
  });

  return entries;
}
