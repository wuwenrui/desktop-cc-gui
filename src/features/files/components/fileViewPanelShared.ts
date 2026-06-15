import type { IntentCanvasCodeSelectionAnchor } from "../../intent-canvas/types";
import type {
  CodeAnnotationLineRange,
  CodeAnnotationSelection,
} from "../../code-annotations/types";
import type { GitLineMarkers } from "../utils/gitLineMarkers";
import { readDocumentThemeAppearance } from "../../theme/utils/themeAppearance";
import { parseShortcut } from "../../../utils/shortcuts";
import { normalizeFsPath } from "../../../utils/workspacePaths";
export const EDITOR_LINE_RANGE_SYNC_DELAY_MS = 90;

export function formatEditorLineRangeKey(
  range: { startLine: number; endLine: number } | null,
) {
  return range ? `${range.startLine}-${range.endLine}` : "none";
}

export function isSameEditorLineRange(
  left: { startLine: number; endLine: number } | null,
  right: { startLine: number; endLine: number } | null,
) {
  return formatEditorLineRangeKey(left) === formatEditorLineRangeKey(right);
}

export const EXTERNAL_CHANGE_POLL_INTERVAL_MS = 2_000;
export type EditorTheme = "light" | "dark";

const CODE_MIRROR_KEY_LABELS: Record<string, string> = {
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  arrowup: "ArrowUp",
  enter: "Enter",
  escape: "Escape",
  space: "Space",
  tab: "Tab",
};

export function toCodeMirrorShortcut(value: string | null | undefined): string | null {
  const parsed = parseShortcut(value);
  if (!parsed) {
    return null;
  }
  const modifiers: string[] = [];
  if (parsed.meta && !parsed.ctrl) {
    modifiers.push("Mod");
  } else {
    if (parsed.meta) {
      modifiers.push("Meta");
    }
    if (parsed.ctrl) {
      modifiers.push("Ctrl");
    }
  }
  if (parsed.alt) {
    modifiers.push("Alt");
  }
  if (parsed.shift) {
    modifiers.push("Shift");
  }
  const keyLabel =
    CODE_MIRROR_KEY_LABELS[parsed.key] ??
    (parsed.key.length === 1 ? parsed.key : parsed.key);
  return [...modifiers, keyLabel].join("-");
}

export function resolveEditorTheme(): EditorTheme {
  return readDocumentThemeAppearance();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function resolveAbsolutePath(workspacePath: string, relativePath: string) {
  const normalizedBase = normalizeFsPath(workspacePath).trim();
  const normalizedRelativePath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalizedBase) {
    return normalizedRelativePath;
  }
  if (!normalizedRelativePath) {
    return normalizedBase;
  }
  if (normalizedBase === "/" || /^[a-zA-Z]:\/$/.test(normalizedBase)) {
    return `${normalizedBase}${normalizedRelativePath}`;
  }
  return `${normalizedBase.replace(/\/+$/, "")}/${normalizedRelativePath}`;
}

export function hasGitLineMarkers(markers: GitLineMarkers | null | undefined) {
  if (!markers) {
    return false;
  }
  return markers.added.length > 0 || markers.modified.length > 0;
}

function getDeclarationLineText(content: string, lineNumber: number): string {
  if (!Number.isFinite(lineNumber) || lineNumber < 1) {
    return "";
  }
  return content.split(/\r?\n/)[lineNumber - 1] ?? "";
}

function stripInlineComment(line: string): string {
  return line.replace(/\s+\/\/.*$/, "").trim();
}

function countBraceDelta(line: string): number {
  let delta = 0;
  for (const char of line) {
    if (char === "{") {
      delta += 1;
    } else if (char === "}") {
      delta -= 1;
    }
  }
  return delta;
}

function resolveDeclarationBlockEndLine(content: string, declarationLine: number): number {
  const lines = content.split(/\r?\n/);
  if (declarationLine < 1 || declarationLine > lines.length) {
    return declarationLine;
  }
  let braceDepth = 0;
  let hasOpenedBlock = false;
  for (let index = declarationLine - 1; index < lines.length; index += 1) {
    const delta = countBraceDelta(stripInlineComment(lines[index] ?? ""));
    if (delta > 0) {
      hasOpenedBlock = true;
    }
    braceDepth += delta;
    if (hasOpenedBlock && braceDepth <= 0) {
      return index + 1;
    }
    if (!hasOpenedBlock && index - declarationLine > 8) {
      return declarationLine;
    }
  }
  return declarationLine;
}

function extractLastIdentifier(value: string): string | null {
  const matches = value.match(/[A-Za-z_$][\w$]*/g);
  return matches ? matches[matches.length - 1] : null;
}

const CODE_REFERENCE_TOKEN_LIMIT = 80;
const CODE_DECLARATION_LOOKBACK_LINES = 160;
const CODE_REFERENCE_STOP_WORDS = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "return",
  "throw",
  "new",
  "this",
  "super",
  "class",
  "interface",
  "enum",
  "record",
  "public",
  "private",
  "protected",
  "static",
  "final",
  "void",
  "boolean",
  "byte",
  "short",
  "int",
  "long",
  "float",
  "double",
  "char",
  "true",
  "false",
  "null",
]);

function stripQuotedSegments(line: string): string {
  return line
    .replace(/"(?:\\.|[^"\\])*"/g, " ")
    .replace(/'(?:\\.|[^'\\])*'/g, " ");
}

function pushCodeReferenceToken(tokens: Set<string>, value: string | null | undefined) {
  const token = value?.trim();
  if (!token || CODE_REFERENCE_STOP_WORDS.has(token) || /^\d+$/.test(token)) {
    return;
  }
  tokens.add(token);
  if (token.includes(".") || token.includes("::")) {
    token
      .split(/\.|::/)
      .map((part) => part.trim())
      .filter((part) => part.length > 1 && !CODE_REFERENCE_STOP_WORDS.has(part))
      .forEach((part) => tokens.add(part));
  }
}

function extractCodeReferenceTokens(input: {
  content: string;
  startLine: number;
  endLine: number;
  symbolName: string;
}): string[] {
  const lines = input.content.split(/\r?\n/);
  const tokens = new Set<string>([input.symbolName]);
  const selectedLines = lines.slice(
    Math.max(0, input.startLine - 1),
    Math.max(input.startLine, input.endLine),
  );

  selectedLines.forEach((line) => {
    const normalizedLine = stripQuotedSegments(stripInlineComment(line));
    for (const match of normalizedLine.matchAll(/\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*(?:\(|\b)/g)) {
      pushCodeReferenceToken(tokens, match[1]);
    }
    for (const match of normalizedLine.matchAll(/\b([A-Za-z_$][\w$]*)::([A-Za-z_$][\w$]*)\b/g)) {
      pushCodeReferenceToken(tokens, `${match[1]}::${match[2]}`);
    }
    for (const match of normalizedLine.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      pushCodeReferenceToken(tokens, match[1]);
    }
    for (const match of normalizedLine.matchAll(/\b([A-Z][A-Za-z_$][\w$]*)\b/g)) {
      pushCodeReferenceToken(tokens, match[1]);
    }
  });

  return Array.from(tokens).slice(0, CODE_REFERENCE_TOKEN_LIMIT);
}

function parseDeclarationLine(line: string): Pick<IntentCanvasCodeSelectionAnchor, "symbolKind" | "symbolName"> | null {
  const normalizedLine = stripInlineComment(line);
  if (
    !normalizedLine ||
    /^(?:\/\/|\/\*|\*|#|@|import\b|package\b|return\b|throw\b|if\b|for\b|while\b|switch\b|case\b|else\b|try\b|catch\b|finally\b)/.test(normalizedLine)
  ) {
    return null;
  }

  const classLike = normalizedLine.match(/\b(class|interface|enum|record|struct|trait)\s+([A-Za-z_$][\w$]*)/);
  if (classLike) {
    return {
      symbolKind: classLike[1] as IntentCanvasCodeSelectionAnchor["symbolKind"],
      symbolName: classLike[2],
    };
  }

  const typeAlias = normalizedLine.match(/^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\b/);
  if (typeAlias) {
    return {
      symbolKind: "type",
      symbolName: typeAlias[1],
    };
  }

  const namedFunction = normalizedLine.match(/\b(?:function|func|def|fn)\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (namedFunction) {
    return {
      symbolKind: "function",
      symbolName: namedFunction[1],
    };
  }

  const methodLike = normalizedLine.match(
    /^(?!(?:new|return|throw)\b)(?:(?:public|private|protected|static|final|abstract|async|override|open|suspend|inline|export)\s+)*(?:[A-Za-z_$][\w$<>[\].?,]+\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?:[:\w\s<>[\].?,]*)(?:\{|=>|;|$)/,
  );
  if (methodLike && !normalizedLine.includes(`.${methodLike[1]}(`)) {
    const methodNameIndex = normalizedLine.indexOf(methodLike[1]);
    const methodPrefix = normalizedLine.slice(0, methodNameIndex).trim();
    const methodTail = normalizedLine.slice(normalizedLine.indexOf(")", methodNameIndex) + 1);
    if (!methodPrefix && !/[{:=>]/.test(methodTail)) {
      return null;
    }
    return {
      symbolKind: "method",
      symbolName: methodLike[1],
    };
  }

  const propertyLike = normalizedLine.match(
    /^(?:(?:public|private|protected|static|final|readonly|volatile|lateinit|transient|export|declare)\s+)+(.+?)(?:[=;]|$)/,
  );
  const propertyName = propertyLike ? extractLastIdentifier(propertyLike[1]) : null;
  return propertyName
    ? {
        symbolKind: "property",
        symbolName: propertyName,
      }
    : null;
}

export function resolveDeclarationCodeSelectionAnchor(input: {
  filePath: string;
  content: string;
  lineRange: CodeAnnotationLineRange | null;
}): IntentCanvasCodeSelectionAnchor | null {
  if (!input.filePath || !input.lineRange) {
    return null;
  }
  const activeLine = input.lineRange.startLine;
  const createAnchorFromDeclarationLine = (declarationLine: number) => {
    const declaration = parseDeclarationLine(getDeclarationLineText(input.content, declarationLine));
    if (!declaration) {
      return null;
    }
    const endLine = Math.max(
      declarationLine,
      resolveDeclarationBlockEndLine(input.content, declarationLine),
    );
    if (activeLine < declarationLine || activeLine > endLine) {
      return null;
    }
    return {
      source: "active-editor-selection" as const,
      filePath: input.filePath,
      startLine: declarationLine,
      endLine,
      declarationLine,
      symbolName: declaration.symbolName,
      referenceTokens: extractCodeReferenceTokens({
        content: input.content,
        startLine: declarationLine,
        endLine,
        symbolName: declaration.symbolName,
      }),
      symbolKind: declaration.symbolKind,
    };
  };

  const directAnchor = createAnchorFromDeclarationLine(activeLine);
  if (directAnchor) {
    return directAnchor;
  }
  const minimumDeclarationLine = Math.max(1, activeLine - CODE_DECLARATION_LOOKBACK_LINES);
  for (let declarationLine = activeLine - 1; declarationLine >= minimumDeclarationLine; declarationLine -= 1) {
    const enclosingAnchor = createAnchorFromDeclarationLine(declarationLine);
    if (enclosingAnchor) {
      return enclosingAnchor;
    }
  }
  return null;
}

export type FileAnnotationDraftState = {
  lineRange: CodeAnnotationLineRange;
  source: "file-preview-mode" | "file-edit-mode";
  body: string;
};

type EditorAnnotationWidgetTarget =
  | {
      kind: "marker";
      annotation: CodeAnnotationSelection;
      targetLine: number;
      side: 1;
      order: number;
    }
  | {
      kind: "draft";
      draft: FileAnnotationDraftState;
      targetLine: number;
      side: 2;
      order: number;
    };

export function resolveEditorAnnotationWidgetOrder({
  annotations,
  draft,
  maxLine,
}: {
  annotations: CodeAnnotationSelection[];
  draft: FileAnnotationDraftState | null;
  maxLine: number;
}): EditorAnnotationWidgetTarget[] {
  const widgetTargets: EditorAnnotationWidgetTarget[] = annotations.map(
    (annotation, index) => ({
      kind: "marker",
      annotation,
      targetLine: Math.min(Math.max(annotation.lineRange.endLine, 1), maxLine),
      side: 1,
      order: index,
    }),
  );
  if (draft?.source === "file-edit-mode") {
    widgetTargets.push({
      kind: "draft",
      draft,
      targetLine: Math.min(Math.max(draft.lineRange.endLine, 1), maxLine),
      side: 2,
      order: widgetTargets.length,
    });
  }
  return widgetTargets.sort(
    (left, right) =>
      left.targetLine - right.targetLine ||
      left.side - right.side ||
      left.order - right.order,
  );
}

export type AnnotationWidgetCallbacks = {
  onDraftCancel: () => void;
  onDraftConfirm: (bodyOverride?: string) => void;
  onRemoveAnnotation?: (annotationId: string) => void;
};
