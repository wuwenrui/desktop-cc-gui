import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("mac bundle path uses tauri productName instead of hardcoded ccgui.app", () => {
  const script = `
    import("./scripts/build-platform.mjs").then((module) => {
      const path = module.buildPlatformInternals.getMacBundlePath("arm64", {
        productName: "LawyerCopilot",
      });
      console.log(path);
    });
  `;

  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /LawyerCopilot\.app/);
  assert.doesNotMatch(result.stdout, /ccgui\.app/);
});
