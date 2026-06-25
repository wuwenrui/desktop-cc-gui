import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readComponentSource(fileName: string): string {
  return readFileSync(join(currentDir, fileName), "utf8");
}

describe("Markdown lazy runtime boundary", () => {
  it("keeps full parser imports out of the Markdown shell", () => {
    const shellSource = readComponentSource("Markdown.tsx");

    expect(shellSource).not.toMatch(/^import .*["']react-markdown["'];?$/m);
    expect(shellSource).not.toMatch(/^import .*["']remark-[^"']+["'];?$/m);
    expect(shellSource).not.toMatch(/^import .*["']rehype-[^"']+["'];?$/m);
    expect(shellSource).toContain('import("./FullMarkdownRuntime")');
  });

  it("keeps file-preview fast HTML body renderer out of live message Markdown", () => {
    const shellSource = readComponentSource("Markdown.tsx");

    expect(shellSource).not.toContain("FileMarkdownFastPreview");
    expect(shellSource).not.toContain("FileMarkdownPreviewFast");
    expect(shellSource).not.toContain("dangerouslySetInnerHTML={{ __html: result.html }}");
  });

  it("keeps the full parser stack isolated in FullMarkdownRuntime", () => {
    const runtimeSource = readComponentSource("FullMarkdownRuntime.tsx");

    expect(runtimeSource).toContain('from "react-markdown"');
    expect(runtimeSource).toContain('from "remark-gfm"');
    expect(runtimeSource).toContain('from "rehype-sanitize"');
  });
});
