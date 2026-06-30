// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getClientStoreSync, writeClientStoreData } from "../../../services/clientStorage";
import { appendClientErrorLog } from "../../../services/tauri";
import { useDebugLog } from "./useDebugLog";

vi.mock("../../../services/tauri", () => ({
  appendClientErrorLog: vi.fn().mockResolvedValue({
    filePath: "/Users/demo/.ccgui/error-log/2026-05-29.jsonl",
  }),
}));

describe("useDebugLog", () => {
  beforeEach(() => {
    writeClientStoreData("app", {});
    writeClientStoreData("diagnostics", {});
    vi.clearAllMocks();
  });

  it("mirrors thread continuity diagnostics into the thread session log store", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "entry-1",
        timestamp: 123,
        source: "client",
        label: "thread/list fallback",
        payload: {
          workspaceId: "ws-1",
          action: "thread-list-fallback",
          recoveryState: "degraded",
        },
      });
    });

    expect(getClientStoreSync("diagnostics", "diagnostics.threadSessionLog")).toEqual([
      {
        timestamp: 123,
        source: "client",
        label: "thread/list fallback",
        payload: {
          workspaceId: "ws-1",
          action: "thread-list-fallback",
          recoveryState: "degraded",
        },
      },
    ]);
  });

  it("persists sanitized core errors through the global client error log", () => {
    const { result } = renderHook(() => useDebugLog());

    act(() => {
      result.current.addDebugEntry({
        id: "entry-2",
        timestamp: Date.UTC(2026, 4, 29, 12, 0, 0),
        source: "error",
        label: "terminal write error",
        payload: {
          workspaceId: "ws-1",
          token: "secret-token",
          stderr: "very noisy terminal output",
        },
      });
    });

    expect(appendClientErrorLog).toHaveBeenCalledWith({
      schemaVersion: 1,
      timestamp: "2026-05-29T12:00:00.000Z",
      source: "error",
      label: "terminal write error",
      payload: {
        workspaceId: "ws-1",
        token: "[redacted]",
        stderr: { redactedText: true, length: 26 },
      },
    });
  });
});
