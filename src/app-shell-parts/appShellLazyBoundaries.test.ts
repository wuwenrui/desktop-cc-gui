import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(currentDir, "..");

const releaseNotesControllerPath = join(
  srcDir,
  "features/update/hooks/useReleaseNotes.ts",
);

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

describe("AppShell lazy feature boundaries", () => {
  it("keeps release notes changelog data out of startup static imports", () => {
    const source = readSource(releaseNotesControllerPath);

    expect(source).not.toContain(`from "../../../../CHANGELOG.md?raw"`);
    expect(source).toContain(`import("../../../../CHANGELOG.md?raw")`);
  });
});
