export type MessageMarkdownHeavyIslandCategory =
  | "code-block"
  | "html-raw"
  | "math"
  | "mermaid"
  | "nested-markdown-fence"
  | "table"
  | "tool-call-xml";

export type MessageMarkdownHeavyIsland = {
  category: MessageMarkdownHeavyIslandCategory;
  startLine: number;
  endLine: number;
  lineCount: number;
};

export type MessageMarkdownHeavyIslandSummary = {
  totalSourceLines: number;
  totalHeavyIslands: number;
  categoryCounts: Partial<Record<MessageMarkdownHeavyIslandCategory, number>>;
  islands: MessageMarkdownHeavyIsland[];
};

const TABLE_ROW_MINIMUM = 6;
const TOOL_CALL_XML_PATTERN =
  /<\s*(?:antml:)?(?:function_calls?|invoke|tool_call|tool_result|tool_use)\b/i;
const HTML_RAW_PATTERN = /<\s*(?:details|table|script|style)\b/i;

function incrementCategory(
  categoryCounts: MessageMarkdownHeavyIslandSummary["categoryCounts"],
  category: MessageMarkdownHeavyIslandCategory,
) {
  categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
}

function classifyFenceLanguage(language: string | null): MessageMarkdownHeavyIslandCategory {
  const normalized = language?.trim().toLowerCase() ?? "";
  if (normalized === "mermaid" || normalized === "flowchart") {
    return "mermaid";
  }
  if (normalized === "math" || normalized === "latex" || normalized === "tex") {
    return "math";
  }
  if (normalized === "markdown" || normalized === "md" || normalized === "mdx") {
    return "nested-markdown-fence";
  }
  return "code-block";
}

function isMarkdownTableLine(line: string) {
  const pipeCount = line.match(/\|/g)?.length ?? 0;
  return pipeCount >= 2;
}

function pushIsland(
  islands: MessageMarkdownHeavyIsland[],
  categoryCounts: MessageMarkdownHeavyIslandSummary["categoryCounts"],
  category: MessageMarkdownHeavyIslandCategory,
  startLine: number,
  endLine: number,
) {
  islands.push({
    category,
    startLine,
    endLine,
    lineCount: Math.max(1, endLine - startLine + 1),
  });
  incrementCategory(categoryCounts, category);
}

export function classifyMessageMarkdownHeavyIslands(
  source: string,
): MessageMarkdownHeavyIslandSummary {
  const lines = source.split(/\r?\n/);
  const islands: MessageMarkdownHeavyIsland[] = [];
  const categoryCounts: MessageMarkdownHeavyIslandSummary["categoryCounts"] = {};
  let activeFence: {
    category: MessageMarkdownHeavyIslandCategory;
    startLine: number;
  } | null = null;
  let tableStartLine: number | null = null;
  let tableLineCount = 0;

  const flushTable = (endLine: number) => {
    if (tableStartLine !== null && tableLineCount >= TABLE_ROW_MINIMUM) {
      pushIsland(islands, categoryCounts, "table", tableStartLine, endLine);
    }
    tableStartLine = null;
    tableLineCount = 0;
  };

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const fenceMatch = line.match(/^\s*(```|~~~)\s*([\w-]+)?/);
    if (fenceMatch) {
      flushTable(lineNumber - 1);
      if (activeFence) {
        pushIsland(
          islands,
          categoryCounts,
          activeFence.category,
          activeFence.startLine,
          lineNumber,
        );
        activeFence = null;
      } else {
        activeFence = {
          category: classifyFenceLanguage(fenceMatch[2] ?? null),
          startLine: lineNumber,
        };
      }
      continue;
    }

    if (activeFence) {
      continue;
    }

    if (isMarkdownTableLine(line)) {
      tableStartLine ??= lineNumber;
      tableLineCount += 1;
      continue;
    }
    flushTable(lineNumber - 1);

    if (TOOL_CALL_XML_PATTERN.test(line)) {
      pushIsland(islands, categoryCounts, "tool-call-xml", lineNumber, lineNumber);
    } else if (HTML_RAW_PATTERN.test(line)) {
      pushIsland(islands, categoryCounts, "html-raw", lineNumber, lineNumber);
    } else if (/\$\$|\\\(|\\\[/.test(line)) {
      pushIsland(islands, categoryCounts, "math", lineNumber, lineNumber);
    }
  }

  flushTable(lines.length);
  if (activeFence) {
    pushIsland(
      islands,
      categoryCounts,
      activeFence.category,
      activeFence.startLine,
      lines.length,
    );
  }

  return {
    totalSourceLines: source.length === 0 ? 0 : lines.length,
    totalHeavyIslands: islands.length,
    categoryCounts,
    islands,
  };
}
