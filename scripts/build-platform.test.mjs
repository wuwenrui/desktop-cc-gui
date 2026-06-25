import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

test("mac release helpers include managed sidecars for packaging and signing", () => {
  const script = `
    import("./scripts/build-platform.mjs").then((module) => {
      console.log(JSON.stringify(module.buildPlatformInternals.getMacManagedExecutableNames()));
    });
  `;

  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    "cc-gui",
    "cc_gui_daemon",
    "wx_bridge",
    "weclaw",
  ]);
});

test("mac OpenSSL fixup signs managed sidecars", () => {
  const script = readFileSync("scripts/macos-fix-openssl.sh", "utf8");

  assert.match(script, /wx_bridge/);
  assert.match(script, /weclaw/);
});
