import type { MarkdownOutlineEntry } from "../../markdown/fastMarkdownRenderer";

const HEADING_LINE_REGEX = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

function extractHeadingTitleFromInline(inline: string): string {
  // Strip common inline markdown markers so the floater shows a clean
  // title (matches what a user sees in the rendered heading).
  return inline
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

/**
 * Best-effort heading extractor for the messages-side outline floater.
 *
 * Why "best-effort":
 * - The messages surface does not run the fast pipeline that produces
 *   `MarkdownOutlineEntry[]` for file previews. A full mdast parse on
 *   every value change would block the main thread and add noticeable
 *   latency to AI streaming updates.
 * - A regex line scan keeps the cost bounded (one pass, no allocation
 *   beyond a small outline array) and is good enough for a TOC.
 *
 * Limitations (documented; not worth fixing in this scope):
 * - ATX headings only (`#`, `##`, ...). Setext (`===` / `---`)
 *   underlines are not detected because the messages-side markdown
 *   engine renders them as `<h1>` / `<h2>` but the raw source line
 *   is the underline, not the heading text.
 * - `#` inside a fenced code block is correctly skipped via a
 *   fence-depth tracker; # inside an inline code span is left as-is
 *   (rare in AI responses, and skipping it would require full
 *   inline parsing).
 * - Headings inside HTML blocks (`<details>` etc.) are not detected.
 */
export function extractOutlineFromMarkdown(
  markdown: string | null | undefined,
): MarkdownOutlineEntry[] {
  if (!markdown) {
    return [];
  }
  const lines = markdown.split(/\r?\n/);
  const seen = new Map<string, number>();
  const outline: MarkdownOutlineEntry[] = [];
  let ordinal = 0;
  // Track fenced code block depth: ``` and ~~~ are valid fences; we
  // match the closing fence by counting run length (>= 3 of the same
  // character on the same delimiter). This is a TOC, not a parser.
  let fenceChar: "`" | "~" | null = null;
  let fenceRun = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const fenceOpen = line.match(/^\s*(`{3,}|~{3,})\s*\S?/);
    if (fenceOpen) {
      const token = fenceOpen[1] ?? "";
      const ch = token[0] as "`" | "~";
      const run = token.length;
      if (fenceChar === null) {
        fenceChar = ch;
        fenceRun = run;
        continue;
      }
      // Close fence: same char, run length >= opener run.
      if (ch === fenceChar && run >= fenceRun) {
        fenceChar = null;
        fenceRun = 0;
        continue;
      }
    }
    if (fenceChar !== null) {
      // Inside a code fence: skip the line entirely so a literal
      // `# heading` does not show up in the floater.
      continue;
    }
    const m = line.match(HEADING_LINE_REGEX);
    if (!m) {
      continue;
    }
    const hashes = m[1] ?? "";
    const title = extractHeadingTitleFromInline(m[2] ?? "");
    if (!title) {
      continue;
    }
    const depth = Math.min(6, Math.max(1, hashes.length)) as 1 | 2 | 3 | 4 | 5 | 6;
    const baseAnchor = slugifyHeadingTitle(title) || "heading";
    const seenCount = seen.get(baseAnchor) ?? 0;
    const anchor = seenCount === 0 ? baseAnchor : `${baseAnchor}-${seenCount}`;
    seen.set(baseAnchor, seenCount + 1);
    ordinal += 1;
    outline.push({
      id: anchor,
      depth,
      title,
      startLine: i + 1,
      endLine: i + 1,
      anchor,
      ordinal,
    });
  }
  return outline;
}

function slugifyHeadingTitle(title: string): string {
  // Mirror `fastMarkdownRenderer/parserOutline.ts` slugify so a click
  // on a floater row matches the heading id set by `attachHeadingIds`.
  if (!title) {
    return "heading";
  }
  const normalized = title
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, "-")
    .replace(/[`*_~()[\]{}<>#!?.,:;'"/=+&%@$^|]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalized || "heading";
}
