import { beforeEach, describe, expect, it, vi } from "vitest";

const clientStorageMocks = vi.hoisted(() => ({
  getClientStoreSync: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));

vi.mock("../../../services/clientStorage", () => ({
  getClientStoreSync: clientStorageMocks.getClientStoreSync,
  writeClientStoreValue: clientStorageMocks.writeClientStoreValue,
}));

import {
  buildClearedThreadAliases,
  buildUpdatedThreadAliases,
  collectCanonicalActiveThreadRebindings,
  loadThreadAliases,
  resolveCanonicalThreadAlias,
  saveThreadAliases,
} from "./threadStorage";

describe("threadStorage aliases", () => {
  beforeEach(() => {
    clientStorageMocks.getClientStoreSync.mockReset();
    clientStorageMocks.writeClientStoreValue.mockReset();
  });

  it("loads only valid persisted thread aliases", () => {
    clientStorageMocks.getClientStoreSync.mockReturnValueOnce({
      "thread-stale": "thread-recovered",
      " ": "thread-blank",
      "thread-loop": "thread-loop",
      "thread-empty": "   ",
      "claude:session-old": "claude:session-new",
    });

    expect(loadThreadAliases()).toEqual({
      "thread-stale": "thread-recovered",
    });
  });

  it("ignores corrupted persisted alias payloads and removes cyclic chains", () => {
    clientStorageMocks.getClientStoreSync
      .mockReturnValueOnce(["thread-a", "thread-b"])
      .mockReturnValueOnce({
        "thread-a": "thread-b",
        "thread-b": "thread-a",
        "thread-c": 123,
      });

    expect(loadThreadAliases()).toEqual({});
    expect(loadThreadAliases()).toEqual({});
  });

  it("collapses alias chains onto the latest canonical thread id", () => {
    const aliases = buildUpdatedThreadAliases(
      {
        "thread-old": "thread-stale",
        "thread-stale": "thread-current",
      },
      "thread-current",
      "thread-next",
    );

    expect(aliases).toEqual({
      "thread-old": "thread-next",
      "thread-stale": "thread-next",
      "thread-current": "thread-next",
    });
    expect(resolveCanonicalThreadAlias(aliases, "thread-old")).toBe("thread-next");
  });

  it("does not alias finalized native session ids", () => {
    expect(
      buildUpdatedThreadAliases(
        {
          "claude:session-a": "claude:session-b",
          "opencode:session-a": "opencode:session-b",
          "gemini:session-a": "gemini:session-b",
        },
        "claude:session-current",
        "claude:session-next",
      ),
    ).toEqual({});
    expect(
      buildUpdatedThreadAliases(
        {},
        "claude-pending-123",
        "claude:session-next",
      ),
    ).toEqual({
      "claude-pending-123": "claude:session-next",
    });
  });

  it("persists normalized alias maps", () => {
    saveThreadAliases({
      "thread-a": "thread-b",
      "thread-b": "thread-b",
      "thread-c": "thread-d",
      "thread-d": "thread-e",
      "claude:session-old": "claude:session-new",
    });

    expect(clientStorageMocks.writeClientStoreValue).toHaveBeenCalledWith(
      "threads",
      "threadAliases",
      {
        "thread-a": "thread-b",
        "thread-c": "thread-e",
        "thread-d": "thread-e",
      },
    );
  });

  it("clears one persisted alias without deleting related canonical targets", () => {
    const aliases = buildClearedThreadAliases(
      {
        "thread-stale": "thread-recovered",
        "thread-old": "thread-recovered",
      },
      "thread-stale",
    );

    expect(aliases).toEqual({
      "thread-old": "thread-recovered",
    });
  });

  it("collects active thread map rebindings before lifecycle consumers use stale ids", () => {
    const aliases = buildUpdatedThreadAliases(
      {
        "codex:old": "codex:middle",
        "codex:middle": "codex:current",
      },
      "codex:current",
      "codex:latest",
    );

    expect(
      collectCanonicalActiveThreadRebindings(
        {
          "ws-codex": " codex:old ",
          "ws-current": "codex:latest",
          "ws-empty": null,
        },
        (threadId) => resolveCanonicalThreadAlias(aliases, threadId),
      ),
    ).toEqual([
      {
        workspaceId: "ws-codex",
        threadId: "codex:old",
        canonicalThreadId: "codex:latest",
      },
    ]);
  });
});
