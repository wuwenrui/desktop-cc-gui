import { describe, expect, it } from "vitest";
import Braces from "lucide-react/dist/esm/icons/braces";
import Code from "lucide-react/dist/esm/icons/code";
import FileCode from "lucide-react/dist/esm/icons/file-code";
import Terminal from "lucide-react/dist/esm/icons/terminal";
import { getCodeBlockLanguageIcon } from "./codeBlockLanguageIcon";

describe("getCodeBlockLanguageIcon", () => {
  it("maps known buckets to their icon", () => {
    expect(getCodeBlockLanguageIcon("json")).toBe(Braces);
    expect(getCodeBlockLanguageIcon("bash")).toBe(Terminal);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(getCodeBlockLanguageIcon("  JSON ")).toBe(Braces);
  });

  it("falls back to a generic file-code icon for unknown languages", () => {
    expect(getCodeBlockLanguageIcon("brainfuck")).toBe(FileCode);
  });

  it("uses a plain code icon when no language tag is present", () => {
    expect(getCodeBlockLanguageIcon(null)).toBe(Code);
  });
});
