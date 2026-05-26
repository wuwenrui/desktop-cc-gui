// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ThreadSummary } from "../../../types";
import { useThreadRows } from "./useThreadRows";

const getPinTimestamp = () => null;

describe("useThreadRows", () => {
  it("keeps a recent child session visible by sorting roots by subtree activity", () => {
    const parent: ThreadSummary = {
      id: "claude:parent",
      name: "Older parent",
      updatedAt: 100,
      engineSource: "claude",
    };
    const child: ThreadSummary = {
      id: "claude:child",
      name: "Recent child",
      parentThreadId: "claude:parent",
      updatedAt: 1_000,
      engineSource: "claude",
    };
    const unrelated: ThreadSummary = {
      id: "codex:unrelated",
      name: "Middle unrelated",
      updatedAt: 500,
      engineSource: "codex",
    };

    const { result } = renderHook(() => useThreadRows({}));
    const rows = result.current.getThreadRows(
      [parent, child, unrelated],
      false,
      "ws-1",
      getPinTimestamp,
      1,
    );

    expect(rows.totalRoots).toBe(2);
    expect(rows.hasMoreRoots).toBe(true);
    expect(rows.unpinnedRows.map((row) => [row.thread.id, row.depth])).toEqual([
      ["claude:parent", 0],
      ["claude:child", 1],
    ]);
  });
});
