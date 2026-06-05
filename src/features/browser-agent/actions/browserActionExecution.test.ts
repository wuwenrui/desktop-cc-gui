import { describe, expect, it, vi } from "vitest";
import { buildBrowserActionPreview } from "./browserActionPreview";
import { confirmBrowserActionPreview } from "./browserActionExecution";

const basePreview = buildBrowserActionPreview({
  actionId: "action-1",
  browserSessionId: "session-1",
  action: "scroll",
  targetDescription: "Scroll down",
  reason: "Inspect lower content.",
  beforeSnapshotId: "snapshot-before",
  settings: {
    allowNavigationActions: true,
    allowElementActions: false,
    allowFormSubmitActions: false,
  },
  platformCapability: {
    navigationActions: "supported",
    elementActions: "unsupported",
    formSubmitActions: "unsupported",
  },
});

describe("confirmBrowserActionPreview", () => {
  it("cancels safe actions without executing when not confirmed", async () => {
    const execute = vi.fn();
    const result = await confirmBrowserActionPreview({
      preview: basePreview,
      confirmed: false,
      execute,
      now: 1000,
    });

    expect(result.outcome).toBe("canceled");
    expect(execute).not.toHaveBeenCalled();
  });

  it("executes confirmed safe actions through the provided backend bridge", async () => {
    const execute = vi.fn().mockResolvedValue({
      outcome: "completed",
      preview: basePreview,
      auditEntry: {
        actionId: "action-1",
        browserSessionId: "session-1",
        requestedAt: 1000,
        completedAt: 1100,
        action: "scroll",
        targetDescription: "Scroll down",
        outcome: "completed",
        diagnosticMessage: null,
        beforeSnapshotId: "snapshot-before",
        afterSnapshotId: "snapshot-after",
      },
    });

    const result = await confirmBrowserActionPreview({
      preview: basePreview,
      confirmed: true,
      execute,
    });

    expect(result.outcome).toBe("completed");
    expect(execute).toHaveBeenCalledWith(basePreview);
  });
});
