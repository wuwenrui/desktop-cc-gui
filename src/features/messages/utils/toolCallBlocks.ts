export type ToolCallParam = {
  name: string;
  value: string;
};

export type ToolCallBlock = {
  kind: "tool-call";
  raw: string;
  tool?: string;
  params?: ReadonlyArray<ToolCallParam>;
  complete: boolean;
  startOffset: number;
  tagName: "function_calls" | "invoke";
  keySignature: string;
};

export type MarkdownBlock = {
  kind: "md";
  content: string;
};

export type Block = MarkdownBlock | ToolCallBlock;

type OpeningTagMatch = {
  index: number;
  raw: string;
  tagName: ToolCallBlock["tagName"];
};

const TRIGGER_SUBSTRINGS = [
  "function_calls",
  "invoke",
  "antml:function_calls",
  "antml:invoke",
] as const;

const FENCE_START_REGEX = /^([ \t]{0,3})(`{3,}|~{3,})/;
const INVOKE_NAME_REGEX = /<(?:antml:)?invoke\b[^>]*\bname\s*=\s*(["'])(.*?)\1[^>]*>/i;
const PARAMETER_REGEX =
  /<(?:antml:)?parameter\b[^>]*\bname\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/(?:antml:)?parameter>/gi;

export function parseToolCallBlocks(text: string): Block[] {
  if (!hasToolCallTrigger(text)) {
    return [{ kind: "md", content: text }];
  }

  const protectedIndexes = buildProtectedIndexSet(text);
  const blocks: Block[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const openingTag = findNextOpeningTag(text, cursor, protectedIndexes);
    if (!openingTag) {
      appendMarkdownBlock(blocks, text.slice(cursor));
      break;
    }

    if (openingTag.index > cursor) {
      appendMarkdownBlock(blocks, text.slice(cursor, openingTag.index));
    }

    const closingEndIndex = findClosingTagEndIndex(
      text,
      openingTag.index + openingTag.raw.length,
      openingTag.tagName,
      protectedIndexes,
    );
    const complete = closingEndIndex !== null;
    const raw = complete
      ? text.slice(openingTag.index, closingEndIndex)
      : text.slice(openingTag.index);

    blocks.push(buildToolCallBlock({
      complete,
      openingTag,
      raw,
      startOffset: openingTag.index,
    }));

    if (!complete) {
      cursor = text.length;
      break;
    }

    cursor = closingEndIndex;
  }

  return blocks.length > 0 ? blocks : [{ kind: "md", content: text }];
}

function hasToolCallTrigger(text: string) {
  return TRIGGER_SUBSTRINGS.some((trigger) => text.includes(trigger));
}

function appendMarkdownBlock(blocks: Block[], content: string) {
  if (!content) {
    return;
  }
  const previous = blocks[blocks.length - 1];
  if (previous?.kind === "md") {
    previous.content += content;
    return;
  }
  blocks.push({ kind: "md", content });
}

function buildToolCallBlock({
  complete,
  openingTag,
  raw,
  startOffset,
}: {
  complete: boolean;
  openingTag: OpeningTagMatch;
  raw: string;
  startOffset: number;
}): ToolCallBlock {
  const tool = extractToolName(raw);
  const params = extractToolParams(raw);
  return {
    kind: "tool-call",
    raw,
    tool,
    params,
    complete,
    startOffset,
    tagName: openingTag.tagName,
    keySignature: openingTag.raw,
  };
}

function extractToolName(raw: string) {
  const match = raw.match(INVOKE_NAME_REGEX);
  return match?.[2]?.trim() || undefined;
}

function extractToolParams(raw: string): ReadonlyArray<ToolCallParam> | undefined {
  const params: ToolCallParam[] = [];
  PARAMETER_REGEX.lastIndex = 0;
  for (const match of raw.matchAll(PARAMETER_REGEX)) {
    const name = match[2]?.trim();
    if (!name) {
      continue;
    }
    params.push({
      name,
      value: match[3] ?? "",
    });
  }
  return params.length > 0 ? params : undefined;
}

function findNextOpeningTag(
  text: string,
  startIndex: number,
  protectedIndexes: ReadonlySet<number>,
): OpeningTagMatch | null {
  const regex = /<(?:antml:)?(function_calls|invoke)\b[^>]*>/gi;
  regex.lastIndex = startIndex;
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined || isProtectedRange(match.index, match[0].length, protectedIndexes)) {
      continue;
    }
    return {
      index: match.index,
      raw: match[0],
      tagName: (match[1] ?? "invoke") as OpeningTagMatch["tagName"],
    };
  }
  return null;
}

function findClosingTagEndIndex(
  text: string,
  startIndex: number,
  tagName: ToolCallBlock["tagName"],
  protectedIndexes: ReadonlySet<number>,
) {
  const regex = new RegExp(`</(?:antml:)?${tagName}>`, "gi");
  regex.lastIndex = startIndex;
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined || isProtectedRange(match.index, match[0].length, protectedIndexes)) {
      continue;
    }
    return match.index + match[0].length;
  }
  return null;
}

function isProtectedRange(
  startIndex: number,
  length: number,
  protectedIndexes: ReadonlySet<number>,
) {
  for (let offset = 0; offset < length; offset += 1) {
    if (protectedIndexes.has(startIndex + offset)) {
      return true;
    }
  }
  return false;
}

function buildProtectedIndexSet(text: string) {
  const protectedIndexes = new Set<number>();
  markFencedCodeBlocks(text, protectedIndexes);
  markInlineCodeSpans(text, protectedIndexes);
  return protectedIndexes;
}

function markFencedCodeBlocks(text: string, protectedIndexes: Set<number>) {
  let offset = 0;
  let activeFence: { marker: "`" | "~"; length: number } | null = null;
  const lines = text.split(/(\r?\n)/);

  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index] ?? "";
    const newline = lines[index + 1] ?? "";
    const lineStart = offset;
    const lineEnd = offset + line.length + newline.length;

    const fenceMatch = line.match(FENCE_START_REGEX);
    if (!activeFence && fenceMatch) {
      const fenceText = fenceMatch[2] ?? "";
      activeFence = {
        marker: fenceText[0] === "~" ? "~" : "`",
        length: fenceText.length,
      };
      markRange(protectedIndexes, lineStart, lineEnd);
    } else if (activeFence) {
      markRange(protectedIndexes, lineStart, lineEnd);
      const closingMatch = line.match(FENCE_START_REGEX);
      const closingFence = closingMatch?.[2] ?? "";
      if (
        closingFence &&
        closingFence[0] === activeFence.marker &&
        closingFence.length >= activeFence.length
      ) {
        activeFence = null;
      }
    }

    offset = lineEnd;
  }
}

function markInlineCodeSpans(text: string, protectedIndexes: Set<number>) {
  let cursor = 0;
  while (cursor < text.length) {
    if (protectedIndexes.has(cursor) || text[cursor] !== "`") {
      cursor += 1;
      continue;
    }
    const runStart = cursor;
    while (cursor < text.length && text[cursor] === "`") {
      cursor += 1;
    }
    const runLength = cursor - runStart;
    const closingIndex = findInlineCodeClosingRun(
      text,
      cursor,
      runLength,
      protectedIndexes,
    );
    if (closingIndex === null) {
      markRange(protectedIndexes, runStart, text.length);
      cursor = text.length;
      continue;
    }
    markRange(protectedIndexes, runStart, closingIndex + runLength);
    cursor = closingIndex + runLength;
  }
}

function findInlineCodeClosingRun(
  text: string,
  startIndex: number,
  runLength: number,
  protectedIndexes: ReadonlySet<number>,
) {
  for (let index = startIndex; index < text.length; index += 1) {
    if (protectedIndexes.has(index) || text[index] !== "`") {
      continue;
    }
    let cursor = index;
    while (cursor < text.length && text[cursor] === "`") {
      cursor += 1;
    }
    if (cursor - index === runLength) {
      return index;
    }
    index = cursor - 1;
  }
  return null;
}

function markRange(
  protectedIndexes: Set<number>,
  startIndex: number,
  endIndex: number,
) {
  for (let index = startIndex; index < endIndex; index += 1) {
    protectedIndexes.add(index);
  }
}
