import { convertFileSrc } from "@tauri-apps/api/core";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";

type VisionFileKind = "image" | "pdf";

type CollectVisionFilePathsInput = {
  text: string;
  explicitPaths?: readonly string[];
  workspacePath?: string | null;
};

const IMAGE_FILE_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp",
]);
const PDF_FILE_EXTENSION = "pdf";
const VISION_FILE_EXTENSION_PATTERN =
  "(?:pdf|png|jpe?g|gif|webp|bmp|tiff?|avif|heic|heif)";
const FILE_REFERENCE_REGEX = /@file\s+`([^`\n]+)`/giu;
const BACKTICK_VISUAL_PATH_REGEX = new RegExp(
  "`([^`\\n]+\\." + VISION_FILE_EXTENSION_PATTERN + "(?:#[^`\\n\\s]+)?)`",
  "giu",
);
const FILE_URI_VISUAL_PATH_REGEX = new RegExp(
  "file://[^\\s`\"'<>，。；;、]+\\." +
    VISION_FILE_EXTENSION_PATTERN +
    "(?:#[^\\s`\"'<>，。；;、]+)?",
  "giu",
);
const POSIX_VISUAL_PATH_REGEX = new RegExp(
  "(^|[\\s(\"'：:，])((?:~/|/|\\./|\\.\\./)[^\\s`\"'<>，。；;、]+\\." +
    VISION_FILE_EXTENSION_PATTERN +
    "(?:#[^\\s`\"'<>，。；;、]+)?)",
  "giu",
);
const WINDOWS_VISUAL_PATH_REGEX = new RegExp(
  "(^|[\\s(\"'：:，])([A-Za-z]:[\\\\/][^\\s`\"'<>，。；;、]+\\." +
    VISION_FILE_EXTENSION_PATTERN +
    "(?:#[^\\s`\"'<>，。；;、]+)?)",
  "giu",
);
const TRAILING_PUNCTUATION_REGEX = /[),.，。；;、]+$/u;
const PDF_VISION_RENDER_SCALE = 1.5;

function stripLineFragment(filePath: string): string {
  return filePath.replace(/#L\d+(?:-L\d+)?$/iu, "");
}

function normalizeFileUri(filePath: string): string {
  if (!filePath.toLowerCase().startsWith("file://")) {
    return filePath;
  }
  try {
    const url = new URL(filePath);
    const decodedPath = decodeURIComponent(url.pathname);
    return /^\/[A-Za-z]:/.test(decodedPath)
      ? decodedPath.slice(1)
      : decodedPath;
  } catch {
    return filePath;
  }
}

function normalizeVisionFilePath(filePath: string): string {
  return stripLineFragment(normalizeFileUri(filePath.trim()))
    .replace(TRAILING_PUNCTUATION_REGEX, "")
    .trim();
}

function fileExtension(filePath: string): string {
  const normalized = normalizeVisionFilePath(filePath);
  const fragmentIndex = normalized.indexOf("#");
  const queryIndex = normalized.indexOf("?");
  const endIndex = [fragmentIndex, queryIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const pathWithoutSuffix =
    endIndex === undefined ? normalized : normalized.slice(0, endIndex);
  const fileName = pathWithoutSuffix.replace(/\\/g, "/").split("/").pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : "";
}

function visionFileKind(filePath: string): VisionFileKind | null {
  const extension = fileExtension(filePath);
  if (extension === PDF_FILE_EXTENSION) {
    return "pdf";
  }
  if (IMAGE_FILE_EXTENSIONS.has(extension)) {
    return "image";
  }
  return null;
}

export function isVisionFilePath(filePath: string): boolean {
  return visionFileKind(filePath) !== null;
}

function isAbsoluteHostPath(filePath: string): boolean {
  return (
    filePath.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(filePath) ||
    filePath.startsWith("\\\\")
  );
}

function resolveFilePath(filePath: string, workspacePath?: string | null): string {
  const normalized = normalizeVisionFilePath(filePath);
  if (!normalized || isAbsoluteHostPath(normalized) || normalized.startsWith("~")) {
    return normalized;
  }
  const basePath = workspacePath?.trim();
  if (!basePath) {
    return normalized;
  }
  const separator = basePath.includes("\\") && !basePath.includes("/") ? "\\" : "/";
  return `${basePath.replace(/[\\/]+$/u, "")}${separator}${normalized.replace(/^\.?[\\/]/u, "")}`;
}

function extractPathMatches(
  text: string,
  regex: RegExp,
  pathGroupIndex: number,
): string[] {
  return Array.from(text.matchAll(regex), (match) => match[pathGroupIndex] ?? "");
}

function extractVisionFilePathsFromText(text: string): string[] {
  return [
    ...extractPathMatches(text, FILE_REFERENCE_REGEX, 1),
    ...extractPathMatches(text, BACKTICK_VISUAL_PATH_REGEX, 1),
    ...Array.from(text.matchAll(FILE_URI_VISUAL_PATH_REGEX), (match) => match[0]),
    ...extractPathMatches(text, POSIX_VISUAL_PATH_REGEX, 2),
    ...extractPathMatches(text, WINDOWS_VISUAL_PATH_REGEX, 2),
  ];
}

export function collectVisionFilePaths({
  text,
  explicitPaths = [],
  workspacePath = null,
}: CollectVisionFilePathsInput): string[] {
  const seen = new Set<string>();
  const visualPaths: string[] = [];
  for (const candidate of [
    ...extractVisionFilePathsFromText(text),
    ...explicitPaths,
  ]) {
    const resolvedPath = resolveFilePath(candidate, workspacePath);
    if (!resolvedPath || !isVisionFilePath(resolvedPath)) {
      continue;
    }
    const dedupeKey = resolvedPath.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    visualPaths.push(resolvedPath);
  }
  return visualPaths;
}

async function renderPdfPageToPngDataUrl(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
): Promise<string> {
  const page = await pdfDocument.getPage(pageNumber);
  try {
    const viewport = page.getViewport({ scale: PDF_VISION_RENDER_SCALE });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context unavailable.");
    }
    const devicePixelRatio =
      typeof window !== "undefined" && window.devicePixelRatio
        ? window.devicePixelRatio
        : 1;
    canvas.width = Math.floor(viewport.width * devicePixelRatio);
    canvas.height = Math.floor(viewport.height * devicePixelRatio);
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const renderTask: RenderTask = page.render({
      canvas,
      canvasContext: context,
      viewport,
    });
    await renderTask.promise;
    return canvas.toDataURL("image/png");
  } finally {
    page.cleanup();
  }
}

async function renderPdfToImageInputs(filePath: string): Promise<string[]> {
  const [{ getDocument }, { ensurePdfPreviewWorker }] = await Promise.all([
    import("pdfjs-dist"),
    import("../files/utils/pdfPreviewRuntime"),
  ]);
  ensurePdfPreviewWorker();
  let loadingTask: PDFDocumentLoadingTask | null = null;
  let pdfDocument: PDFDocumentProxy | null = null;
  try {
    loadingTask = getDocument(convertFileSrc(filePath));
    pdfDocument = await loadingTask.promise;
    const images: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      images.push(await renderPdfPageToPngDataUrl(pdfDocument, pageNumber));
    }
    return images;
  } finally {
    if (pdfDocument) {
      await pdfDocument.destroy();
    } else {
      await loadingTask?.destroy();
    }
  }
}

export async function collectVisionImageInputs(
  input: CollectVisionFilePathsInput,
): Promise<string[]> {
  const images: string[] = [];
  for (const filePath of collectVisionFilePaths(input)) {
    const kind = visionFileKind(filePath);
    if (kind === "image") {
      images.push(filePath);
    } else if (kind === "pdf") {
      images.push(...(await renderPdfToImageInputs(filePath)));
    }
  }
  return Array.from(new Set(images));
}
