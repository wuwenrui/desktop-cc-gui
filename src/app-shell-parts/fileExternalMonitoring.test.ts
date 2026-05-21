import { describe, expect, it } from "vitest";

import { shouldEnableMainFileExternalChangeMonitoring } from "./fileExternalMonitoring";

describe("shouldEnableMainFileExternalChangeMonitoring", () => {
  it("enables main file external change awareness while a file is open", () => {
    expect(
      shouldEnableMainFileExternalChangeMonitoring({
        activeWorkspace: { id: "workspace-1" },
        activeEditorFilePath: "docs/readme.md",
      }),
    ).toBe(true);
  });

  it("requires both an active workspace and an active editor file", () => {
    expect(
      shouldEnableMainFileExternalChangeMonitoring({
        activeWorkspace: null,
        activeEditorFilePath: "docs/readme.md",
      }),
    ).toBe(false);
    expect(
      shouldEnableMainFileExternalChangeMonitoring({
        activeWorkspace: { id: "workspace-1" },
        activeEditorFilePath: null,
      }),
    ).toBe(false);
  });
});
