import { describe, expect, it, vi } from "vitest";
import {
  addForkThreadNamePrefix,
  createSessionLifecycleThreadStarter,
  extractProviderBindingFromStartedThread,
  extractThreadId,
  providerBindingFromSelectedProfile,
  resolveClaudeForkThreadName,
} from "./sessionLifecycleController";

vi.mock("../../../services/globalRuntimeNotices", () => ({
  pushGlobalRuntimeNotice: vi.fn(),
}));

describe("sessionLifecycleController", () => {
  it("extracts thread ids from supported response shapes", () => {
    expect(extractThreadId({ result: { thread: { id: "codex:1" } } })).toBe("codex:1");
    expect(extractThreadId({ thread_id: 42 })).toBe("42");
    expect(extractThreadId(null)).toBe("");
  });

  it("keeps provider binding from response before fallback", () => {
    expect(
      extractProviderBindingFromStartedThread(
        {
          thread: {
            provider_profile_id: "profile-a",
            provider_profile_name: "Profile A",
          },
        },
        { providerProfileId: "fallback" },
      ),
    ).toMatchObject({
      providerProfileId: "profile-a",
      providerProfileName: "Profile A",
    });
  });

  it("builds provider binding from selected profile", () => {
    expect(
      providerBindingFromSelectedProfile({
        id: "profile-a",
        name: "Profile A",
        source: "managed",
      }),
    ).toMatchObject({
      providerProfileId: "profile-a",
      providerProfileName: "Profile A",
      providerProfileSource: "managed",
      providerAvailability: "available",
    });
  });

  it("builds disk provider display metadata from disk profile id fallback", () => {
    expect(
      providerBindingFromSelectedProfile(null, "__disk__"),
    ).toMatchObject({
      providerProfileId: "__disk__",
      providerProfileName: "codex-tui/default-config",
      providerProfileSource: "disk",
      providerAvailability: "available",
    });
  });

  it("prefixes Claude fork names without duplicating the prefix", () => {
    expect(addForkThreadNamePrefix("Release plan")).toBe("fork-Release plan");
    expect(addForkThreadNamePrefix("fork-Release plan")).toBe("fork-Release plan");
    expect(addForkThreadNamePrefix("")).toBe("fork-Claude Session");
  });

  it("resolves Claude fork names from sidebar summary or first user message", () => {
    expect(
      resolveClaudeForkThreadName({
        workspaceId: "ws",
        parentThreadId: "thread-1",
        threadsByWorkspace: { ws: [{ id: "thread-1", name: "Summary title" }] as any },
        itemsByThread: {},
      }),
    ).toBe("fork-Summary title");

    expect(
      resolveClaudeForkThreadName({
        workspaceId: "ws",
        parentThreadId: "thread-1",
        threadsByWorkspace: { ws: [] },
        itemsByThread: {
          "thread-1": [
            {
              id: "m1",
              kind: "message",
              role: "user",
              text: "Explain the release pipeline",
            },
          ] as any,
        },
      }),
    ).toBe("fork-Explain th");
  });

  it("creates a lifecycle starter without message runtime side effects", () => {
    const dispatch = vi.fn();
    const loadedThreadsRef = { current: {} };
    const starter = createSessionLifecycleThreadStarter({
      dispatch,
      loadedThreadsRef,
      workspaceId: "ws",
      folderId: "folder",
      shouldActivate: true,
      selectedProviderBinding: { providerProfileId: "profile-a" },
    });

    expect(starter({ thread: { id: "codex:1" } })).toBe("codex:1");
    expect(loadedThreadsRef.current).toEqual({ "codex:1": true });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "ensureThread" }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "setActiveThreadId" }));
  });
});
