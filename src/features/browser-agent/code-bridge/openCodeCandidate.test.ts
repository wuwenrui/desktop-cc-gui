import { describe, expect, it, vi } from "vitest";
import {
  openBrowserCodeCandidateWithExistingNavigator,
  resolveBrowserCodeCandidateOpenTarget,
} from "./openCodeCandidate";
import type { BrowserCodeCandidate } from "../types";

const candidate: BrowserCodeCandidate = {
  candidateId: "route_match:src/pages/settings.tsx",
  filePath: "src/pages/settings.tsx",
  reason: "route_match",
  confidence: "medium",
  matchedText: "/settings",
  sourceEvidence: ["/settings"],
  explanation: "Route matched.",
  openAction: {
    kind: "open_file",
    filePath: "src/pages/settings.tsx",
  },
};

describe("open browser code candidate", () => {
  it("delegates to existing file navigation target", () => {
    expect(resolveBrowserCodeCandidateOpenTarget(candidate)).toEqual({
      kind: "existing_file_navigation",
      filePath: "src/pages/settings.tsx",
      source: "candidate_open_action",
    });
  });

  it("does not open wildcard hint candidates", () => {
    const openFile = vi.fn();
    const opened = openBrowserCodeCandidateWithExistingNavigator(
      { ...candidate, filePath: "src/**", openAction: null },
      openFile,
    );

    expect(opened).toBe(false);
    expect(openFile).not.toHaveBeenCalled();
  });
});
