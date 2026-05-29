import { describe, expect, it } from "vitest";
import {
  buildClientErrorLogEntry,
  shouldPersistClientErrorLogEntry,
} from "./clientErrorLog";
import type { DebugEntry } from "../../../types";

function debugEntry(partial: Partial<DebugEntry>): DebugEntry {
  return {
    id: "entry-1",
    timestamp: Date.UTC(2026, 4, 29, 12, 0, 0),
    source: "client",
    label: "client info",
    ...partial,
  };
}

describe("clientErrorLog", () => {
  it("persists core errors and stuck-turn settlement diagnostics only", () => {
    expect(
      shouldPersistClientErrorLogEntry(
        debugEntry({ source: "error", label: "terminal close error" }),
      ),
    ).toBe(true);
    expect(
      shouldPersistClientErrorLogEntry(
        debugEntry({
          label: "thread/session:turn-settlement:rejected",
        }),
      ),
    ).toBe(true);
    expect(
      shouldPersistClientErrorLogEntry(
        debugEntry({
          label:
            "thread/session:turn-diagnostic:terminal-settlement-busy-residue",
        }),
      ),
    ).toBe(true);
    expect(
      shouldPersistClientErrorLogEntry(
        debugEntry({
          label:
            "thread/session:turn-diagnostic:three-evidence-reconciliation-query-failed",
        }),
      ),
    ).toBe(true);
    expect(
      shouldPersistClientErrorLogEntry(
        debugEntry({
          label:
            "thread/session:turn-diagnostic:three-evidence-reconciliation-query-resolved",
          payload: {
            status: "runtime-ended",
            decisionAction: "cleanup-residue",
          },
        }),
      ),
    ).toBe(true);
    expect(
      shouldPersistClientErrorLogEntry(
        debugEntry({
          label:
            "thread/session:turn-diagnostic:three-evidence-reconciliation-query-resolved",
          payload: {
            status: "running",
            decisionAction: "keep-running",
          },
        }),
      ),
    ).toBe(false);
    expect(
      shouldPersistClientErrorLogEntry(
        debugEntry({
          label: "thread/session:turn-diagnostic:three-evidence-dry-run",
          payload: { dryRunDecision: "wouldCleanupResidue" },
        }),
      ),
    ).toBe(true);
    expect(
      shouldPersistClientErrorLogEntry(
        debugEntry({
          label: "thread/session:turn-diagnostic:three-evidence-dry-run",
          payload: { dryRunDecision: "wouldSettle" },
        }),
      ),
    ).toBe(false);
    expect(
      shouldPersistClientErrorLogEntry(
        debugEntry({ label: "thread/session:turn-diagnostic:first-token-delay" }),
      ),
    ).toBe(false);
  });

  it("redacts secrets and summarizes large text fields", () => {
    const persisted = buildClientErrorLogEntry(
      debugEntry({
        source: "stderr",
        label: "thread/session:turn-diagnostic:terminal-settlement-rejected",
        payload: {
          workspaceId: "ws-1",
          apiKey: "sk-demo",
          prompt: "hello user",
          nested: {
            stdout: "tool output",
            reason: "busy",
          },
        },
      }),
    );

    expect(persisted.timestamp).toBe("2026-05-29T12:00:00.000Z");
    expect(persisted.payload).toEqual({
      workspaceId: "ws-1",
      apiKey: "[redacted]",
      prompt: { redactedText: true, length: 10 },
      nested: {
        stdout: { redactedText: true, length: 11 },
        reason: "busy",
      },
    });
  });
});
