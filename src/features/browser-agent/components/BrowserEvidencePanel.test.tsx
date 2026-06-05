// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrowserEvidencePanel } from "./BrowserEvidencePanel";
import type { TaskRunBrowserEvidenceRef } from "../../tasks/types";

function makeTaskRunEvidence(state: TaskRunBrowserEvidenceRef["state"]): TaskRunBrowserEvidenceRef {
  return {
    attachmentId: `attachment-${state}`,
    browserSessionId: "session-1",
    snapshotId: "snapshot-1",
    url: "http://localhost:5173/settings",
    title: "Settings",
    capturedAt: 1000,
    state,
    summary: "Settings page evidence",
    diagnostics: state === "available" ? [] : [`Browser evidence is ${state}`],
    redactedKinds: [],
    codeCandidates: [
      {
        filePath: "src/pages/settings.tsx",
        reason: "route_match",
        confidence: "medium",
        matchedText: "/settings",
        explanation: "Route match.",
        openAction: {
          kind: "open_file",
          filePath: "src/pages/settings.tsx",
        },
      },
    ],
  };
}

describe("BrowserEvidencePanel", () => {
  it.each(["available", "stale", "degraded", "expired"] as const)(
    "renders task run browser evidence state %s",
    (state) => {
      render(<BrowserEvidencePanel taskRunEvidence={makeTaskRunEvidence(state)} />);

      expect(screen.getByText("Browser evidence")).toBeTruthy();
      expect(screen.getByText(state)).toBeTruthy();
      expect(screen.getByText(/src\/pages\/settings.tsx/)).toBeTruthy();
    },
  );
});
