import { describe, expect, it } from "vitest";
import { parseToolCallBlocks } from "./toolCallBlocks";

describe("parseToolCallBlocks", () => {
  it("returns a single markdown block on plain text fast path", () => {
    expect(parseToolCallBlocks("plain markdown")).toEqual([
      { kind: "md", content: "plain markdown" },
    ]);
  });

  it("handles empty strings", () => {
    expect(parseToolCallBlocks("")).toEqual([{ kind: "md", content: "" }]);
  });

  it("parses a paired function_calls block", () => {
    const blocks = parseToolCallBlocks([
      "before",
      "<function_calls><invoke name=\"find\"><parameter name=\"path\">/tmp</parameter></invoke></function_calls>",
      "after",
    ].join("\n"));

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ kind: "md", content: "before\n" });
    expect(blocks[1]).toMatchObject({
      kind: "tool-call",
      tool: "find",
      complete: true,
      tagName: "function_calls",
      params: [{ name: "path", value: "/tmp" }],
    });
    expect(blocks[2]).toMatchObject({ kind: "md", content: "\nafter" });
  });

  it("parses antml-prefixed function_calls and parameters", () => {
    const blocks = parseToolCallBlocks(
      "<antml:function_calls><antml:invoke name=\"grep\"><antml:parameter name=\"pattern\">TODO</antml:parameter></antml:invoke></antml:function_calls>",
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: "tool-call",
      tool: "grep",
      complete: true,
      params: [{ name: "pattern", value: "TODO" }],
    });
  });

  it("parses a bare invoke block without a function_calls wrapper", () => {
    const blocks = parseToolCallBlocks(
      "<invoke name='read'><parameter name='file'>README.md</parameter></invoke>",
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: "tool-call",
      tool: "read",
      complete: true,
      tagName: "invoke",
      params: [{ name: "file", value: "README.md" }],
    });
  });

  it("emits an incomplete trailing tool-call block for streaming output", () => {
    const blocks = parseToolCallBlocks(
      "text <function_calls><invoke name=\"bash\"><parameter name=\"command\">npm test",
    );

    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({
      kind: "tool-call",
      tool: "bash",
      complete: false,
      tagName: "function_calls",
    });
  });

  it("does not promote literal XML inside fenced code blocks", () => {
    const value = [
      "```xml",
      "<function_calls><invoke name=\"find\"></invoke></function_calls>",
      "```",
    ].join("\n");

    expect(parseToolCallBlocks(value)).toEqual([{ kind: "md", content: value }]);
  });

  it("does not promote literal XML inside inline code spans", () => {
    const value = "Document `<function_calls>` as a literal tag.";

    expect(parseToolCallBlocks(value)).toEqual([{ kind: "md", content: value }]);
  });

  it("does not promote streaming XML after an unclosed inline code delimiter", () => {
    const value = "Document `<function_calls><invoke name=\"example\">";

    expect(parseToolCallBlocks(value)).toEqual([{ kind: "md", content: value }]);
  });

  it("parses multiple tool-call blocks in one message", () => {
    const blocks = parseToolCallBlocks([
      "<invoke name=\"first\"></invoke>",
      "middle",
      "<invoke name=\"second\"></invoke>",
    ].join("\n"));

    const toolBlocks = blocks.filter((block) => block.kind === "tool-call");
    expect(toolBlocks).toHaveLength(2);
    expect(toolBlocks[0]).toMatchObject({ tool: "first" });
    expect(toolBlocks[1]).toMatchObject({ tool: "second" });
  });

  it("keeps nested invoke content inside the outer function_calls block", () => {
    const blocks = parseToolCallBlocks(
      "<function_calls><invoke name=\"outer\"><parameter name=\"payload\"><invoke name=\"inner\"></invoke></parameter></invoke></function_calls>",
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: "tool-call",
      tool: "outer",
      params: [{ name: "payload", value: "<invoke name=\"inner\"></invoke>" }],
    });
  });
});
