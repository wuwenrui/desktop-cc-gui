import { afterEach, describe, expect, it } from "vitest";
import {
  getListenerOwnerDiagnostics,
  registerListenerOwner,
  resetListenerOwnerRegistryForTests,
} from "./listenerOwners";

describe("listenerOwners", () => {
  afterEach(() => {
    resetListenerOwnerRegistryForTests();
  });

  it("records migrated listener owners and marks cleanup inactive", () => {
    const cleanup = registerListenerOwner({
      id: "workspace-focus",
      owner: "workspace",
      surfaceId: "useWorkspaceRefreshOnFocus",
    });

    expect(getListenerOwnerDiagnostics()).toMatchObject({
      activeCount: 1,
      inactiveCount: 0,
      evidenceClass: "proxy",
    });

    cleanup();
    expect(getListenerOwnerDiagnostics()).toMatchObject({
      activeCount: 0,
      inactiveCount: 1,
    });
  });
});
