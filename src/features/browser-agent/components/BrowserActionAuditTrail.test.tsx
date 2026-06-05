// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrowserActionAuditTrail } from "./BrowserActionAuditTrail";
import type { BrowserActionAuditEntry } from "../types";

function entry(outcome: BrowserActionAuditEntry["outcome"]): BrowserActionAuditEntry {
  return {
    actionId: `action-${outcome}`,
    browserSessionId: "session-1",
    requestedAt: 1000,
    completedAt: 1100,
    action: "scroll",
    targetDescription: "Scroll down",
    outcome,
    diagnosticMessage: outcome === "completed" ? null : `Action ${outcome}`,
    beforeSnapshotId: "snapshot-before",
    afterSnapshotId: outcome === "completed" ? "snapshot-after" : null,
    comparison: {
      beforeSnapshotId: "snapshot-before",
      afterSnapshotId: outcome === "completed" ? "snapshot-after" : null,
      state: outcome === "completed" ? "available" : "failed",
      diagnostics: outcome === "completed" ? [] : [`Action ${outcome}`],
    },
  };
}

describe("BrowserActionAuditTrail", () => {
  it("renders blocked completed and failed action outcomes", () => {
    render(<BrowserActionAuditTrail entries={[entry("blocked"), entry("completed"), entry("failed")]} />);

    expect(screen.getByText("Browser action audit")).toBeTruthy();
    expect(screen.getByText("blocked")).toBeTruthy();
    expect(screen.getByText("completed")).toBeTruthy();
    expect(screen.getByText("failed")).toBeTruthy();
    expect(screen.getByText(/before=snapshot-before; after=snapshot-after/)).toBeTruthy();
  });
});
