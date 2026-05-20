import { normalizeOutsideMarkdownCode } from "../../utils/markdownCodeRegions";

export type KatexModule = typeof import("katex")["default"];
export type RehypeKatexPlugin = typeof import("rehype-katex")["default"];

export type LatexRenderEntry =
  | { kind: "label"; text: string }
  | { kind: "formula"; source: string };

export type MarkdownMathNormalizationResult = {
  value: string;
  lineMap: number[];
};

let cachedKatex: KatexModule | null = null;
let cachedRehypeKatex: RehypeKatexPlugin | null = null;
let katexCssLoaded = false;
let katexLoadingPromise: Promise<void> | null = null;

export function getCachedKatex() {
  return cachedKatex;
}

export function getCachedRehypeKatex() {
  return cachedRehypeKatex;
}

export function areKatexAssetsReady() {
  return cachedKatex !== null && cachedRehypeKatex !== null && katexCssLoaded;
}

export function isKatexRenderReady() {
  return cachedKatex !== null && katexCssLoaded;
}

export function loadKatexAssets(): Promise<void> {
  if (areKatexAssetsReady()) {
    return Promise.resolve();
  }
  if (katexLoadingPromise) {
    return katexLoadingPromise;
  }
  katexLoadingPromise = Promise.all([
    import("katex").then((m) => {
      cachedKatex = m.default;
    }),
    import("rehype-katex").then((m) => {
      cachedRehypeKatex = m.default;
    }),
    import("katex/dist/katex.min.css").then(() => {
      katexCssLoaded = true;
    }),
  ]).then(() => undefined);
  return katexLoadingPromise;
}

export function prewarmKatexAssets(): Promise<void> {
  return loadKatexAssets();
}

const INLINE_DOLLAR_MATH = /(^|[^\\$])\$[^\n$]+?\$/;
const BLOCK_DOLLAR_MATH = /\$\$[\s\S]+?\$\$/;
const LATEX_PAREN_MATH = /\\\(|\\\[/;
const LATEX_CODE_FENCE = /```\s*(?:latex|tex|math)\b/i;
const INLINE_MATH_TRAILING_PUNCTUATION = new Set([
  "，",
  "。",
  "！",
  "？",
  "；",
  "：",
  ",",
  ".",
  ";",
  ":",
  "!",
  "?",
]);

export function detectMathContent(value: string | undefined | null): boolean {
  if (!value) return false;
  if (LATEX_CODE_FENCE.test(value)) return true;
  if (BLOCK_DOLLAR_MATH.test(value)) return true;
  if (INLINE_DOLLAR_MATH.test(value)) return true;
  if (LATEX_PAREN_MATH.test(value)) return true;
  return false;
}

function startsWithMarkdownBlockSyntax(value: string) {
  const trimmed = value.trimStart();
  return (
    /^[-*+]\s/.test(trimmed) ||
    /^\d+\.(?:\s|$|(?!\d)\S)/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^#{1,6}\s/.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^\|/.test(trimmed)
  );
}

function looksLikeInlineLatexExpression(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return (
    /\\[A-Za-z]+/.test(trimmed) ||
    /[_^]/.test(trimmed)
  );
}

function isCjkCharacter(value: string) {
  return /[\u3400-\u9fff]/u.test(value);
}

function hasSafeInlineLatexWrapperBoundary(source: string, startIndex: number) {
  if (startIndex <= 0) {
    return true;
  }
  const previousChar = source[startIndex - 1] ?? "";
  return (
    /\s/.test(previousChar) ||
    /[([{"'“‘`<、，。！？；：,:;!?]/u.test(previousChar) ||
    isCjkCharacter(previousChar)
  );
}

function hasSafeDisplayLatexWrapperBoundary(source: string, endIndex: number) {
  if (endIndex >= source.length - 1) {
    return true;
  }
  const nextChar = source[endIndex + 1] ?? "";
  return (
    /\s/.test(nextChar) ||
    /[)\]}>"'”’`>、，。！？；：,:;!?]/u.test(nextChar) ||
    isCjkCharacter(nextChar)
  );
}

function stripLeadingMarkdownLinePrefix(value: string) {
  return value.replace(/^((?:[-*+]|>\s*|\d+\.)\s*)+/, "").trim();
}

function isInlineMathWrapperInProseContext(source: string, startIndex: number, endIndex: number) {
  const lineStart = source.lastIndexOf("\n", startIndex - 1) + 1;
  const lineEndCandidate = source.indexOf("\n", endIndex + 1);
  const lineEnd = lineEndCandidate >= 0 ? lineEndCandidate : source.length;
  const before = source.slice(lineStart, startIndex);
  const after = source.slice(endIndex + 1, lineEnd);
  const hasMeaningfulBefore = stripLeadingMarkdownLinePrefix(before).length > 0;
  const hasMeaningfulAfter = after.trim().length > 0;
  return hasMeaningfulBefore || hasMeaningfulAfter;
}

function looksLikeStandaloneLatexFormulaLine(value: string) {
  const trimmed = value.trim();
  if (!trimmed || startsWithMarkdownBlockSyntax(trimmed)) {
    return false;
  }
  if (/[\u3400-\u9fff]/u.test(trimmed)) {
    return false;
  }
  const hasLatexCommand = /\\[A-Za-z]+/.test(trimmed);
  const hasEquationOperator = /[=<>]/.test(trimmed);
  const hasMathStructure = /[_^{}()+\-*/]/.test(trimmed);
  if (!(hasLatexCommand || hasEquationOperator) || !hasMathStructure) {
    return false;
  }
  const plainWordTokens = trimmed
    .replace(/\\[A-Za-z]+/g, " ")
    .replace(/[{}_^=<>+\-*/()[\],.;:]/g, " ")
    .match(/[A-Za-z]{3,}/g);
  return (plainWordTokens?.length ?? 0) === 0;
}

function isUnescapedCharacter(value: string, index: number) {
  let backslashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 0;
}

export function extractSingleDollarInlineMath(
  value: string,
  options?: { allowTrailingPunctuation?: boolean },
) {
  if (!value.startsWith("$") || value.startsWith("$$")) {
    return null;
  }
  let candidate = value;
  if (options?.allowTrailingPunctuation) {
    const trailingChar = candidate[candidate.length - 1] ?? "";
    if (INLINE_MATH_TRAILING_PUNCTUATION.has(trailingChar)) {
      candidate = candidate.slice(0, -1);
    }
  }
  if (!candidate.endsWith("$") || candidate.length < 2) {
    return null;
  }
  const closingIndex = candidate.length - 1;
  if (!isUnescapedCharacter(candidate, closingIndex)) {
    return null;
  }
  return candidate.slice(1, closingIndex);
}

function extractSingleLineDisplayMathExpression(value: string) {
  if (!value.startsWith("$$") || !value.endsWith("$$") || value.length < 4) {
    return null;
  }
  const closingStart = value.length - 2;
  if (!isUnescapedCharacter(value, closingStart)) {
    return null;
  }
  const expression = value.slice(2, closingStart).trim();
  return expression || null;
}

function hasUnescapedDollar(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "$") {
      continue;
    }
    if (isUnescapedCharacter(value, index)) {
      return true;
    }
  }
  return false;
}

function normalizeMalformedDisplayMathSegments(value: string) {
  if (!value.includes("$$")) {
    return value;
  }
  let changed = false;
  const normalized = value.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner: string) => {
    const expression = inner.trim();
    if (!expression) {
      return match;
    }
    if (!/[\u3400-\u9fff]/u.test(expression) || !hasUnescapedDollar(expression)) {
      return match;
    }
    changed = true;
    return expression;
  });
  return changed ? normalized : value;
}

function normalizeInlineDisplayMathSegments(value: string) {
  if (!value.includes("$$")) {
    return value;
  }
  let changed = false;
  const normalized = value.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (match, inner: string, offset: number, source: string) => {
      const expression = inner.trim();
      if (!expression || /[\r\n]/.test(inner)) {
        return match;
      }
      const endIndex = offset + match.length - 1;
      if (!isInlineMathWrapperInProseContext(source, offset, endIndex)) {
        return match;
      }
      changed = true;
      return `$${expression}$`;
    },
  );
  return changed ? normalized : value;
}

function normalizeLeadingLatexBeforeCjkProse(value: string) {
  return normalizeLeadingLatexBeforeCjkProseWithLineMap(value).value;
}

function normalizeLeadingLatexBeforeCjkProseWithLineMap(value: string): MarkdownMathNormalizationResult {
  const lines = value.split(/\r?\n/);
  let inDisplayMathBlock = false;
  let inMarkdownCodeFence = false;
  let changed = false;
  const valueLines: string[] = [];
  const lineMap: number[] = [];

  const pushLine = (line: string, sourceLine: number) => {
    valueLines.push(line);
    lineMap.push(sourceLine);
  };

  lines.forEach((line, index) => {
    const sourceLine = index + 1;
    const trimmed = line.trim();
    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
    if (/^\s*(```|~~~)/.test(line)) {
      inMarkdownCodeFence = !inMarkdownCodeFence;
      pushLine(line, sourceLine);
      return;
    }
    if (inMarkdownCodeFence) {
      pushLine(line, sourceLine);
      return;
    }
    if (trimmed === "$$") {
      inDisplayMathBlock = !inDisplayMathBlock;
      pushLine(line, sourceLine);
      return;
    }
    if (!trimmed || inDisplayMathBlock) {
      pushLine(line, sourceLine);
      return;
    }
    if (startsWithMarkdownBlockSyntax(trimmed)) {
      pushLine(line, sourceLine);
      return;
    }
    if (!/\\[A-Za-z]/.test(trimmed)) {
      pushLine(line, sourceLine);
      return;
    }
    const cjkMatch = trimmed.match(/[\u3400-\u9fff]/u);
    const cjkIndex = cjkMatch?.index ?? -1;
    if (cjkIndex <= 0) {
      pushLine(line, sourceLine);
      return;
    }
    const mathCandidateRaw = trimmed.slice(0, cjkIndex).trimEnd();
    const mathCandidate = mathCandidateRaw
      .replace(/[，,；;：:.!?！？。]+$/u, "")
      .trimEnd();
    const proseRemainder = trimmed.slice(mathCandidateRaw.length).trimStart();
    if (!mathCandidate || !proseRemainder) {
      pushLine(line, sourceLine);
      return;
    }
    if (
      !looksLikeStandaloneLatexFormulaLine(mathCandidate) &&
      !looksLikeInlineLatexExpression(mathCandidate) &&
      !/[=<>]/.test(mathCandidate)
    ) {
      pushLine(line, sourceLine);
      return;
    }
    changed = true;
    pushLine(`${leadingWhitespace}$$`, sourceLine);
    pushLine(`${leadingWhitespace}${mathCandidate}`, sourceLine);
    pushLine(`${leadingWhitespace}$$`, sourceLine);
    pushLine(`${leadingWhitespace}${proseRemainder}`, sourceLine);
  });

  return {
    value: changed ? valueLines.join("\n") : value,
    lineMap: changed ? lineMap : lines.map((_line, index) => index + 1),
  };
}

function looksLikeExplicitInlineMathLine(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return (
    extractSingleDollarInlineMath(trimmed, { allowTrailingPunctuation: true }) !== null ||
    /^\\+\([\s\S]*?\\+\)[，。！？；：,.;:!?]?$/.test(trimmed)
  );
}

function normalizeStandaloneMathDisplayLines(value: string) {
  return normalizeStandaloneMathDisplayLinesWithLineMap(value).value;
}

function normalizeStandaloneMathDisplayLinesWithLineMap(value: string): MarkdownMathNormalizationResult {
  if (!value.includes("\n")) {
    return { value, lineMap: [1] };
  }
  const lines = value.split(/\r?\n/);
  let inDisplayMathBlock = false;
  let inMarkdownCodeFence = false;
  let changed = false;
  const valueLines: string[] = [];
  const lineMap: number[] = [];

  const pushLine = (line: string, sourceLine: number) => {
    valueLines.push(line);
    lineMap.push(sourceLine);
  };

  lines.forEach((line, index) => {
    const sourceLine = index + 1;
    const trimmed = line.trim();
    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
    if (/^\s*(```|~~~)/.test(line)) {
      inMarkdownCodeFence = !inMarkdownCodeFence;
      pushLine(line, sourceLine);
      return;
    }
    if (inMarkdownCodeFence) {
      pushLine(line, sourceLine);
      return;
    }
    if (trimmed === "$$") {
      inDisplayMathBlock = !inDisplayMathBlock;
      pushLine(line, sourceLine);
      return;
    }
    if (!trimmed) {
      pushLine(line, sourceLine);
      return;
    }
    if (inDisplayMathBlock) {
      pushLine(line, sourceLine);
      return;
    }

    const expression = extractSingleLineDisplayMathExpression(trimmed);
    if (expression) {
      changed = true;
      pushLine(`${leadingWhitespace}$$`, sourceLine);
      pushLine(`${leadingWhitespace}${expression}`, sourceLine);
      pushLine(`${leadingWhitespace}$$`, sourceLine);
      return;
    }

    if (looksLikeExplicitInlineMathLine(trimmed)) {
      pushLine(line, sourceLine);
      return;
    }

    if (!looksLikeStandaloneLatexFormulaLine(trimmed)) {
      pushLine(line, sourceLine);
      return;
    }
    changed = true;
    pushLine(`${leadingWhitespace}$$`, sourceLine);
    pushLine(`${leadingWhitespace}${trimmed}`, sourceLine);
    pushLine(`${leadingWhitespace}$$`, sourceLine);
  });

  return {
    value: changed ? valueLines.join("\n") : value,
    lineMap: changed ? lineMap : lines.map((_line, index) => index + 1),
  };
}

function normalizeCommonMathDelimiters(value: string) {
  let changed = false;
  let normalized = value.replace(
    /(\\+)\(\s*([^\n]*?)\s*(\\+)\)/g,
    (
      match,
      _openSlashes: string,
      inner: string,
      _closeSlashes: string,
      offset: number,
      source: string,
    ) => {
      if (!looksLikeInlineLatexExpression(inner)) {
        return match;
      }
      if (!hasSafeInlineLatexWrapperBoundary(source, offset)) {
        return match;
      }
      changed = true;
      return `$${inner.trim()}$`;
    },
  );

  normalized = normalized.replace(
    /(\\+)\[\s*([\s\S]*?)\s*(\\+)\]/g,
    (
      match,
      _openSlashes: string,
      inner: string,
      _closeSlashes: string,
      offset: number,
      source: string,
    ) => {
      const expression = inner.trim();
      if (!looksLikeInlineLatexExpression(expression)) {
        return match;
      }
      if (!hasSafeInlineLatexWrapperBoundary(source, offset)) {
        return match;
      }
      const endIndex = offset + match.length - 1;
      if (!hasSafeDisplayLatexWrapperBoundary(source, endIndex)) {
        return match;
      }
      changed = true;
      if (isInlineMathWrapperInProseContext(source, offset, endIndex)) {
        return `$${expression}$`;
      }
      return `$$\n${expression}\n$$`;
    },
  );

  normalized = normalized.replace(
    /[（(]\s*(\\[A-Za-z][^()\n（）]*?)\s*[）)]/g,
    (match, inner: string, offset: number, source: string) => {
      if (!looksLikeInlineLatexExpression(inner)) {
        return match;
      }
      if (!hasSafeInlineLatexWrapperBoundary(source, offset)) {
        return match;
      }
      changed = true;
      return `$${inner.trim()}$`;
    },
  );

  return changed ? normalized : value;
}

export function normalizeMarkdownMathForMessage(value: string) {
  return normalizeOutsideMarkdownCode(
    value,
    (text) => normalizeStandaloneMathDisplayLines(
      normalizeLeadingLatexBeforeCjkProse(
        normalizeMalformedDisplayMathSegments(
          normalizeInlineDisplayMathSegments(
            normalizeCommonMathDelimiters(text),
          ),
        ),
      ),
    ),
  );
}

export function normalizeMarkdownMathForFilePreview(value: string): MarkdownMathNormalizationResult {
  const normalized = normalizeOutsideMarkdownCode(
    value,
    (text) => normalizeMalformedDisplayMathSegments(
      normalizeInlineDisplayMathSegments(
        normalizeCommonMathDelimiters(text),
      ),
    ),
  );
  const leadingResult = normalizeLeadingLatexBeforeCjkProseWithLineMap(normalized);
  const displayResult = normalizeStandaloneMathDisplayLinesWithLineMap(leadingResult.value);
  return {
    value: displayResult.value,
    lineMap: displayResult.lineMap.map((line) => leadingResult.lineMap[line - 1] ?? line),
  };
}

export function buildLatexRenderEntries(value: string): LatexRenderEntry[] {
  const lines = value.split(/\r?\n/);
  const entries: LatexRenderEntry[] = [];
  let formulaBuffer: string[] = [];

  const flushFormula = () => {
    const source = formulaBuffer.join("\n").trim();
    formulaBuffer = [];
    if (!source) {
      return;
    }
    entries.push({ kind: "formula", source });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushFormula();
      continue;
    }
    if (trimmed.startsWith("%")) {
      flushFormula();
      const label = trimmed.replace(/^%\s*/, "").trim();
      if (label) {
        entries.push({ kind: "label", text: label });
      }
      continue;
    }
    formulaBuffer.push(line);
  }
  flushFormula();

  if (entries.length > 0) {
    return entries;
  }
  const fallbackSource = value.trim();
  return fallbackSource ? [{ kind: "formula", source: fallbackSource }] : [];
}

export function unwrapLatexDelimiters(source: string) {
  const trimmed = source.trim();
  if (!trimmed) {
    return trimmed;
  }
  const displayBlockMatch = trimmed.match(/^\$\$\s*([\s\S]*?)\s*\$\$$/);
  if (displayBlockMatch) {
    const inner = (displayBlockMatch[1] ?? "").trim();
    if (inner) {
      return inner;
    }
  }
  const displayParenMatch = trimmed.match(/^\\\[\s*([\s\S]*?)\s*\\\]$/);
  if (displayParenMatch) {
    const inner = (displayParenMatch[1] ?? "").trim();
    if (inner) {
      return inner;
    }
  }
  const inlineDollarWrapped = extractSingleDollarInlineMath(trimmed);
  if (inlineDollarWrapped) {
    const inner = inlineDollarWrapped.trim();
    if (inner) {
      return inner;
    }
  }
  const inlineParenMatch = trimmed.match(/^\\\(\s*([\s\S]*?)\s*\\\)$/);
  if (inlineParenMatch) {
    const inner = (inlineParenMatch[1] ?? "").trim();
    if (inner) {
      return inner;
    }
  }
  return trimmed;
}

export function renderLatexFormula(source: string) {
  if (!cachedKatex) return null;
  try {
    const renderedHtml = cachedKatex.renderToString(unwrapLatexDelimiters(source), {
      displayMode: true,
      throwOnError: false,
      strict: "ignore",
      trust: false,
    });
    return renderedHtml.includes("katex-error") ? null : renderedHtml;
  } catch {
    return null;
  }
}
