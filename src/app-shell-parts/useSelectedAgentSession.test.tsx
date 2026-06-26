// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSelectedAgentSession } from "./useSelectedAgentSession";

type Store = Record<string, unknown>;

const { appStore, getClientStoreSync, writeClientStoreValue } = vi.hoisted(() => {
  const appStore: Store = {};
  return {
    appStore,
    getClientStoreSync: vi.fn((store: string, key: string) => {
      if (store !== "app") {
        return undefined;
      }
      return appStore[key];
    }),
    writeClientStoreValue: vi.fn((store: string, key: string, value: unknown) => {
      if (store === "app") {
        appStore[key] = value;
      }
    }),
  };
});

vi.mock("../services/clientStorage", () => ({
  getClientStoreSync,
  writeClientStoreValue,
}));

vi.mock("../services/tauri", () => ({
  listAgentConfigs: vi.fn(async () => []),
}));

describe("useSelectedAgentSession", () => {
  beforeEach(() => {
    Object.keys(appStore).forEach((key) => delete appStore[key]);
    getClientStoreSync.mockClear();
    writeClientStoreValue.mockClear();
  });

  it("does not repeat the same pending-to-finalized selected agent migration", async () => {
    const resolveCanonicalThreadId = (threadId: string) =>
      threadId === "claude-pending-1" ? "claude:session-1" : threadId;
    appStore["composer.selectedAgentByThread.ws-a:claude-pending-1"] = {
      id: "backend",
      name: "Backend",
      prompt: "focus backend",
    };

    const { result, rerender } = renderHook(
      ({ activeThreadId }: { activeThreadId: string }) =>
        useSelectedAgentSession({
          activeWorkspaceId: "ws-a",
          activeThreadId,
          resolveCanonicalThreadId,
        }),
      {
        initialProps: { activeThreadId: "claude-pending-1" },
      },
    );

    await waitFor(() => {
      expect(result.current.selectedAgent?.id).toBe("backend");
    });
    writeClientStoreValue.mockClear();

    rerender({ activeThreadId: "claude:session-1" });

    await waitFor(() => {
      expect(result.current.selectedAgent?.id).toBe("backend");
    });
    expect(writeClientStoreValue).toHaveBeenCalledTimes(1);
    expect(writeClientStoreValue).toHaveBeenLastCalledWith(
      "app",
      "composer.selectedAgentByThread.ws-a:claude:session-1",
      expect.objectContaining({ id: "backend", name: "Backend" }),
    );

    rerender({ activeThreadId: "claude:session-1" });

    await waitFor(() => {
      expect(result.current.selectedAgent?.id).toBe("backend");
    });
    expect(writeClientStoreValue).toHaveBeenCalledTimes(1);
  });
});
