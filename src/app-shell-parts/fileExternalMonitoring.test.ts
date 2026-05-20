import { describe, expect, it } from "vitest";

import { shouldEnableMainFileExternalChangeMonitoring } from "./fileExternalMonitoring";

describe("shouldEnableMainFileExternalChangeMonitoring", () => {
  it("keeps main file external monitoring disabled by default while a file is open", () => {
    expect(
      shouldEnableMainFileExternalChangeMonitoring({
        activeWorkspace: { id: "workspace-1" },
        activeEditorFilePath: "docs/readme.md",
        liveEditPreviewEnabled: false,
      }),
    ).toBe(false);
  });

  it("enables main file external monitoring only after live edit preview is enabled", () => {
    expect(
      shouldEnableMainFileExternalChangeMonitoring({
        activeWorkspace: { id: "workspace-1" },
        activeEditorFilePath: "docs/readme.md",
        liveEditPreviewEnabled: true,
      }),
    ).toBe(true);
  });

  it("requires both an active workspace and an active editor file", () => {
    expect(
      shouldEnableMainFileExternalChangeMonitoring({
        activeWorkspace: null,
        activeEditorFilePath: "docs/readme.md",
        liveEditPreviewEnabled: true,
      }),
    ).toBe(false);
    expect(
      shouldEnableMainFileExternalChangeMonitoring({
        activeWorkspace: { id: "workspace-1" },
        activeEditorFilePath: null,
        liveEditPreviewEnabled: true,
      }),
    ).toBe(false);
  });
});

