// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppShellWorkspaceHomeState } from "./useAppShellWorkspaceHomeState";

const recordStartupMilestoneMock = vi.hoisted(() => vi.fn());
const recordStartupPerfMarkerMock = vi.hoisted(() => vi.fn());

vi.mock("../features/startup-orchestration/utils/startupTrace", () => ({
  recordStartupMilestone: recordStartupMilestoneMock,
}));

vi.mock("../services/perfBaseline/startupMarkers", () => ({
  recordStartupPerfMarker: recordStartupPerfMarkerMock,
}));

function createParams(overrides: Partial<Parameters<typeof useAppShellWorkspaceHomeState>[0]> = {}) {
  return {
    activeWorkspaceId: null,
    appSettingsLoading: false,
    groupedWorkspaces: [],
    hasLoaded: true,
    workspaces: [],
    ...overrides,
  };
}

describe("useAppShellWorkspaceHomeState", () => {
  beforeEach(() => {
    recordStartupMilestoneMock.mockReset();
    recordStartupPerfMarkerMock.mockReset();
  });

  it("records input-ready and first-interactive once after workspace home is loaded", () => {
    const view = renderHook((params) => useAppShellWorkspaceHomeState(params), {
      initialProps: createParams({ appSettingsLoading: true, hasLoaded: false }),
    });

    expect(recordStartupMilestoneMock).not.toHaveBeenCalled();
    expect(recordStartupPerfMarkerMock).not.toHaveBeenCalled();

    view.rerender(createParams({ appSettingsLoading: false, hasLoaded: true }));
    view.rerender(createParams({ appSettingsLoading: false, hasLoaded: true }));

    expect(recordStartupMilestoneMock).toHaveBeenCalledTimes(1);
    expect(recordStartupMilestoneMock).toHaveBeenCalledWith("input-ready");
    expect(recordStartupPerfMarkerMock).toHaveBeenCalledTimes(1);
    expect(recordStartupPerfMarkerMock).toHaveBeenCalledWith("first-interactive");
  });
});
