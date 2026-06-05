import type {
  BrowserCodeCandidate,
  BrowserContextSnapshot,
  BrowserElementLandmark,
} from "../types";

const MAX_CANDIDATES = 12;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type BrowserCodeCandidateInput = {
  snapshot: BrowserContextSnapshot;
  workspacePath?: string | null;
  workspaceFiles?: string[];
};

function isLocalSnapshot(snapshot: BrowserContextSnapshot): boolean {
  try {
    const url = new URL(snapshot.source.normalizedUrl);
    return LOCAL_HOSTS.has(url.hostname) || url.hostname.startsWith("127.");
  } catch {
    return false;
  }
}

function routeSegments(pathname: string): string[] {
  return pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !/^\d+$/.test(segment));
}

function candidateId(filePath: string, reason: BrowserCodeCandidate["reason"]): string {
  return `${reason}:${filePath}`;
}

function buildCandidate(input: {
  filePath: string;
  reason: BrowserCodeCandidate["reason"];
  confidence: BrowserCodeCandidate["confidence"];
  matchedText?: string | null;
  explanation: string;
}): BrowserCodeCandidate {
  const openable = input.filePath !== "src/**" && !input.filePath.includes("*");
  return {
    candidateId: candidateId(input.filePath, input.reason),
    filePath: input.filePath,
    symbolName: null,
    reason: input.reason,
    confidence: input.confidence,
    matchedText: input.matchedText ?? null,
    sourceEvidence: input.matchedText ? [input.matchedText] : [],
    explanation: input.explanation,
    openAction: openable
      ? {
          kind: "open_file",
          filePath: input.filePath,
        }
      : null,
  };
}

function routeCandidatePaths(pathname: string): string[] {
  const segments = routeSegments(pathname);
  if (segments.length === 0) {
    return ["src/App.tsx", "src/main.tsx", "src/routes/index.tsx"];
  }
  const route = segments.join("/");
  const leaf = segments[segments.length - 1] ?? route;
  return [
    `src/pages/${route}.tsx`,
    `src/pages/${route}/index.tsx`,
    `src/routes/${route}.tsx`,
    `src/routes/${route}/index.tsx`,
    `src/app/${route}/page.tsx`,
    `src/features/${leaf}/components/${leaf}.tsx`,
  ];
}

function matchWorkspaceFiles(candidates: string[], workspaceFiles: string[]): string[] {
  if (workspaceFiles.length === 0) {
    return candidates;
  }
  const normalizedFiles = new Set(workspaceFiles.map((file) => file.replace(/\\/g, "/")));
  return candidates.filter((candidate) => normalizedFiles.has(candidate));
}

function fileNameCandidates(pathname: string, workspaceFiles: string[]): BrowserCodeCandidate[] {
  if (workspaceFiles.length === 0) {
    return [];
  }
  const segments = routeSegments(pathname);
  const leaf = segments[segments.length - 1]?.toLowerCase();
  if (!leaf) {
    return [];
  }
  return workspaceFiles
    .map((file) => file.replace(/\\/g, "/"))
    .filter((file) => file.toLowerCase().includes(leaf))
    .slice(0, 4)
    .map((filePath) => buildCandidate({
      filePath,
      reason: "file_name_match",
      confidence: "medium",
      matchedText: leaf,
      explanation: "Workspace file name matched the Browser Dock route leaf.",
    }));
}

function visibleTextNeedles(snapshot: BrowserContextSnapshot): string[] {
  const primaryText = snapshot.page.primaryContent?.text ?? snapshot.page.visibleText;
  return [primaryText, ...(snapshot.page.readableBlocks ?? []).map((block) => block.text)]
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => value.length >= 4)
    .map((value) => value.slice(0, 96))
    .slice(0, 4);
}

function headingNeedles(snapshot: BrowserContextSnapshot): string[] {
  return snapshot.page.headings
    .map((heading) => heading.text.replace(/\s+/g, " ").trim())
    .filter((value) => value.length >= 4)
    .slice(0, 4);
}

function landmarkCandidates(landmarks: BrowserElementLandmark[]): BrowserCodeCandidate[] {
  return landmarks
    .filter((landmark) => landmark.role === "button" || landmark.role === "form" || landmark.role === "input")
    .slice(0, 4)
    .map((landmark) => buildCandidate({
      filePath: "src/**",
      reason: landmark.role === "button"
        ? "button_label_match"
        : landmark.role === "form"
          ? "form_label_match"
          : "aria_label_match",
      confidence: "low",
      matchedText: landmark.label,
      explanation: "Interactive landmark text matched visible Browser Dock evidence.",
    }));
}

function scoreCandidates(candidates: BrowserCodeCandidate[]): BrowserCodeCandidate[] {
  return candidates.map((candidate) => {
    if (candidate.confidence !== "low") {
      return candidate;
    }
    return {
      ...candidate,
      explanation: `${candidate.explanation} Low confidence means this is a clue, not a definitive match.`,
    };
  });
}

export function buildBrowserCodeCandidates(
  input: BrowserCodeCandidateInput,
): BrowserCodeCandidate[] {
  const { snapshot, workspaceFiles = [] } = input;
  if (!isLocalSnapshot(snapshot)) {
    return [];
  }

  let pathname = "/";
  try {
    pathname = new URL(snapshot.source.normalizedUrl).pathname || "/";
  } catch {
    pathname = "/";
  }

  const routeMatches = matchWorkspaceFiles(routeCandidatePaths(pathname), workspaceFiles).map(
    (filePath) => buildCandidate({
      filePath,
      reason: "route_match",
      confidence: workspaceFiles.length > 0 ? "medium" as const : "low" as const,
      matchedText: pathname,
      explanation: "Workspace-local URL route matched a likely frontend route file.",
    }),
  );
  const fileNameMatches = fileNameCandidates(pathname, workspaceFiles);

  const visibleTextMatches = visibleTextNeedles(snapshot).map((needle) => buildCandidate({
    filePath: "src/**",
    reason: "visible_text_match",
    confidence: "low",
    matchedText: needle,
    explanation: "Visible page text can help locate the responsible component but is not definitive.",
  }));
  const headingMatches = headingNeedles(snapshot).map((needle) => buildCandidate({
    filePath: "src/**",
    reason: "heading_match",
    confidence: "low",
    matchedText: needle,
    explanation: "Visible heading text can help locate the responsible component but is not definitive.",
  }));

  const byId = new Map<string, BrowserCodeCandidate>();
  for (const candidate of [
    ...routeMatches,
    ...fileNameMatches,
    ...visibleTextMatches,
    ...headingMatches,
    ...landmarkCandidates(snapshot.page.elementLandmarks),
  ]) {
    if (!byId.has(candidate.candidateId)) {
      byId.set(candidate.candidateId, candidate);
    }
  }
  return scoreCandidates(Array.from(byId.values())).slice(0, MAX_CANDIDATES);
}
