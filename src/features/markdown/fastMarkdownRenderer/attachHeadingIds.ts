import type { Root as HastRoot, Element, ElementContent } from "hast";

/**
 * Attach stable `id` attributes to heading elements in a HAST tree
 * using a pre-computed list of heading anchors (from the mdast
 * outline pass). This ensures heading anchors in the rendered HTML
 * match the `anchorId` values used in the parser-derived outline.
 *
 * Heading elements are matched by their rendered text content to
 * align with the outline entries (which were collected in mdast
 * parse order, mirroring the HAST tree visit order).
 */
export function attachHeadingIds(
  root: HastRoot,
  headingAnchors: Array<{ anchorId: string; title: string }>,
): void {
  const anchorIndex = headingAnchors[Symbol.iterator]();

  const visit = (node: ElementContent | HastRoot): void => {
    if (node.type === "root") {
      for (const child of node.children) {
        visit(child as ElementContent);
      }
      return;
    }
    if (node.type !== "element") {
      return;
    }
    const element = node as Element;
    const tagName = element.tagName;
    if (tagName.length === 2 && tagName[0] === "h" && tagName[1] >= "1" && tagName[1] <= "6") {
      const next = anchorIndex.next();
      if (!next.done) {
        element.properties = {
          ...(element.properties ?? {}),
          id: next.value.anchorId,
        };
      }
    }
    for (const child of element.children) {
      visit(child as ElementContent);
    }
  };

  visit(root);
}
