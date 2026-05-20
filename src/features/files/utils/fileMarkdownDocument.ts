import { normalizeMarkdownMathForFilePreview } from "../../markdown/markdownMath";

export type FileMarkdownFrontmatterField = {
  key: string;
  value: string;
};

export type CompiledFileMarkdownDocument = {
  cacheKey: string;
  contentHash: string;
  documentKey: string;
  frontmatterFields: FileMarkdownFrontmatterField[];
  body: string;
  bodyStartLine: number;
  lineMap: number[];
  metrics: {
    byteLength: number;
    lineCount: number;
    blockCount: number;
    heavyBlockCount: number;
  };
  renderStrategy: "rich" | "progressive" | "low-cost";
};

type CompileFileMarkdownDocumentArgs = {
  documentKey: string;
  rawMarkdown: string;
  rendererProfile: string;
};

const MAX_COMPILED_DOCUMENTS = 30;
const MAX_RICH_MARKDOWN_BYTES = 96_000;
const MAX_RICH_MARKDOWN_LINES = 2_500;
const MAX_RICH_MARKDOWN_BLOCKS = 900;
const MAX_RICH_HEAVY_BLOCKS = 20;
const compiledDocumentCache = new Map<string, CompiledFileMarkdownDocument>();

export function hashStableString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function normalizeFrontmatterValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => normalizeFrontmatterValue(item))
      .filter(Boolean)
      .join(" · ");
  }
  return trimmed;
}

function extractFrontmatter(value: string): {
  fields: FileMarkdownFrontmatterField[];
  body: string;
  bodyStartLine: number;
} {
  const match = value.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) {
    return { fields: [], body: value, bodyStartLine: 1 };
  }

  const frontmatterBlock = match[1] ?? "";
  const fields = frontmatterBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex <= 0) {
        return null;
      }
      return {
        key: line.slice(0, separatorIndex).trim(),
        value: normalizeFrontmatterValue(line.slice(separatorIndex + 1).trim()),
      };
    })
    .filter((field): field is FileMarkdownFrontmatterField => Boolean(field));

  return {
    fields,
    body: value.slice(match[0].length),
    bodyStartLine: (match[0].match(/\r?\n/g) ?? []).length + 1,
  };
}

function countMarkdownBlocks(value: string) {
  const lines = value.split(/\r?\n/);
  let blockCount = 0;
  let heavyBlockCount = 0;
  let insideFence = false;
  let fenceLanguage = "";
  let previousWasBlank = true;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^```+\s*([\w-]+)?/);
    if (fenceMatch) {
      if (!insideFence) {
        blockCount += 1;
        fenceLanguage = (fenceMatch[1] ?? "").toLowerCase();
        if (["mermaid", "math", "latex", "tex"].includes(fenceLanguage)) {
          heavyBlockCount += 1;
        }
      }
      insideFence = !insideFence;
      previousWasBlank = false;
      continue;
    }

    if (insideFence) {
      continue;
    }
    if (!trimmed) {
      previousWasBlank = true;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed) || /^>\s?/.test(trimmed) || /^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed) || /^\|/.test(trimmed)) {
      blockCount += 1;
      previousWasBlank = false;
      if (/^\|/.test(trimmed)) {
        heavyBlockCount += 1;
      }
      continue;
    }
    if (previousWasBlank) {
      blockCount += 1;
    }
    previousWasBlank = false;
  }

  return { blockCount, heavyBlockCount };
}

function resolveRenderStrategy(metrics: CompiledFileMarkdownDocument["metrics"]) {
  if (
    metrics.byteLength > MAX_RICH_MARKDOWN_BYTES ||
    metrics.lineCount > MAX_RICH_MARKDOWN_LINES ||
    metrics.blockCount > MAX_RICH_MARKDOWN_BLOCKS ||
    metrics.heavyBlockCount > MAX_RICH_HEAVY_BLOCKS
  ) {
    return "progressive" as const;
  }
  return "rich" as const;
}

export function compileFileMarkdownDocument({
  documentKey,
  rawMarkdown,
  rendererProfile,
}: CompileFileMarkdownDocumentArgs): CompiledFileMarkdownDocument {
  const contentHash = hashStableString(rawMarkdown);
  const cacheKey = `${documentKey}:${rendererProfile}:${contentHash}`;
  const cachedDocument = compiledDocumentCache.get(cacheKey);
  if (cachedDocument) {
    compiledDocumentCache.delete(cacheKey);
    compiledDocumentCache.set(cacheKey, cachedDocument);
    return cachedDocument;
  }

  const frontmatter = extractFrontmatter(rawMarkdown);
  const normalizedMarkdown = normalizeMarkdownMathForFilePreview(frontmatter.body);
  const blockMetrics = countMarkdownBlocks(normalizedMarkdown.value);
  const metrics = {
    byteLength: new TextEncoder().encode(rawMarkdown).length,
    lineCount: rawMarkdown.length === 0 ? 0 : rawMarkdown.split(/\r?\n/).length,
    blockCount: blockMetrics.blockCount,
    heavyBlockCount: blockMetrics.heavyBlockCount,
  };
  const compiledDocument: CompiledFileMarkdownDocument = {
    cacheKey,
    contentHash,
    documentKey,
    frontmatterFields: frontmatter.fields,
    body: normalizedMarkdown.value,
    bodyStartLine: frontmatter.bodyStartLine,
    lineMap: normalizedMarkdown.lineMap,
    metrics,
    renderStrategy: resolveRenderStrategy(metrics),
  };

  compiledDocumentCache.set(cacheKey, compiledDocument);
  while (compiledDocumentCache.size > MAX_COMPILED_DOCUMENTS) {
    const oldestKey = compiledDocumentCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    compiledDocumentCache.delete(oldestKey);
  }
  return compiledDocument;
}

export function clearFileMarkdownDocumentCacheForTests() {
  compiledDocumentCache.clear();
}
