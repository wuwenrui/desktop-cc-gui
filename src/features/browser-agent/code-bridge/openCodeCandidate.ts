import type { BrowserCodeCandidate } from "../types";

export type BrowserCodeCandidateOpenTarget = {
  kind: "existing_file_navigation";
  filePath: string;
  source: "candidate_open_action";
};

export function resolveBrowserCodeCandidateOpenTarget(
  candidate: BrowserCodeCandidate,
): BrowserCodeCandidateOpenTarget | null {
  const filePath = candidate.openAction?.filePath?.trim() || candidate.filePath.trim();
  if (!filePath || filePath.includes("*")) {
    return null;
  }
  return {
    kind: "existing_file_navigation",
    filePath,
    source: "candidate_open_action",
  };
}

export function openBrowserCodeCandidateWithExistingNavigator(
  candidate: BrowserCodeCandidate,
  openFile: (filePath: string) => void,
): boolean {
  const target = resolveBrowserCodeCandidateOpenTarget(candidate);
  if (!target) {
    return false;
  }
  openFile(target.filePath);
  return true;
}
