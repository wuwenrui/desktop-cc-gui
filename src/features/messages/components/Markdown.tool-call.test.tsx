// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

const lightweightInvokeValue =
  "<invoke name=\"read\"><parameter name=\"file\">AGENTS.md</parameter></invoke>";

describe("Markdown tool-call fallback", () => {
  it("renders residual function_calls XML as a tool-call card", () => {
    const value = [
      "我会查找文件：",
      "",
      "<function_calls><invoke name=\"find\"><parameter name=\"path\">/Users/test/project</parameter></invoke></function_calls>",
    ].join("\n");

    const { container } = render(
      <Markdown value={value} className="markdown" codeBlockStyle="message" />,
    );

    expect(screen.getByRole("group", { name: "messages.toolCallCard.title" })).toBeTruthy();
    expect(screen.getByText("find")).toBeTruthy();
    expect(screen.getByText("/Users/test/project")).toBeTruthy();
    expect(container.textContent).not.toContain("<function_calls>");
  });

  it("keeps protected markdown regions literal while converting only real XML blocks", async () => {
    const value = [
      "# Heading",
      "",
      "- item",
      "",
      "```xml",
      "<function_calls><invoke name=\"example\"></invoke></function_calls>",
      "```",
      "",
      "Inline math $a^2+b^2=c^2$.",
      "",
      "<antml:function_calls><antml:invoke name=\"grep\"><antml:parameter name=\"pattern\">TODO</antml:parameter></antml:invoke></antml:function_calls>",
    ].join("\n");

    const { container } = render(
      <Markdown value={value} className="markdown" codeBlockStyle="message" />,
    );

    expect(container.querySelector("h1")?.textContent).toBe("Heading");
    expect(container.querySelector("li")?.textContent).toBe("item");
    expect(container.querySelector("code")?.textContent).toContain("<function_calls>");
    expect(screen.getByText("grep")).toBeTruthy();
    expect(screen.getByText("TODO")).toBeTruthy();
  });

  it("renders incomplete streaming XML as a live card and converges without losing expansion", () => {
    const initialValue =
      "prefix <function_calls><invoke name=\"bash\"><parameter name=\"command\">npm test";
    const completedValue = `${initialValue}</parameter></invoke></function_calls>`;

    const { rerender } = render(
      <Markdown
        value={initialValue}
        className="markdown"
        codeBlockStyle="message"
        streamingThrottleMs={0}
      />,
    );

    expect(screen.getByText("messages.toolCallCard.streaming")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "messages.toolCallCard.expand" }));
    expect(screen.getByText("messages.toolCallCard.rawPayload")).toBeTruthy();

    rerender(
      <Markdown
        value={completedValue}
        className="markdown"
        codeBlockStyle="message"
        streamingThrottleMs={0}
      />,
    );

    expect(screen.queryByText("messages.toolCallCard.streaming")).toBeNull();
    expect(screen.getByText("messages.toolCallCard.rawPayload")).toBeTruthy();
    expect(screen.getAllByText("npm test").length).toBeGreaterThanOrEqual(1);
  });

  it("keeps expansion when streaming key gains a parsed tool name later", () => {
    const initialValue = "prefix <function_calls>";
    const nextValue = `${initialValue}<invoke name="bash"><parameter name="command">npm test</parameter></invoke></function_calls>`;

    const { rerender } = render(
      <Markdown
        value={initialValue}
        className="markdown"
        codeBlockStyle="message"
        streamingThrottleMs={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "messages.toolCallCard.expand" }));
    expect(screen.getByText("messages.toolCallCard.rawPayload")).toBeTruthy();

    rerender(
      <Markdown
        value={nextValue}
        className="markdown"
        codeBlockStyle="message"
        streamingThrottleMs={0}
      />,
    );

    expect(screen.getByText("messages.toolCallCard.rawPayload")).toBeTruthy();
    expect(screen.getByText("bash")).toBeTruthy();
  });

  it("applies the same fallback in lightweight mode", () => {
    render(
      <Markdown
        value={lightweightInvokeValue}
        className="markdown"
        liveRenderMode="lightweight"
      />,
    );

    expect(screen.getByRole("group", { name: "messages.toolCallCard.title" })).toBeTruthy();
    expect(screen.getByText("read")).toBeTruthy();
    expect(screen.getByText("AGENTS.md")).toBeTruthy();
  });

  it("keeps streaming XML literal when it follows an unclosed inline code delimiter", () => {
    const value = "Document `<function_calls><invoke name=\"example\">";

    const { container } = render(
      <Markdown
        value={value}
        className="markdown"
        codeBlockStyle="message"
        streamingThrottleMs={0}
      />,
    );

    expect(screen.queryByRole("group", { name: "messages.toolCallCard.title" })).toBeNull();
    expect(container.textContent ?? "").toContain("<function_calls>");
    expect(container.textContent ?? "").toContain("<invoke name=\"example\">");
  });

  it("keeps full markdown rendering for stable content with non-tool unclosed inline code", async () => {
    const value = [
      "Document `unfinished inline code",
      "",
      "| A | B |",
      "| - | - |",
      "| 1 | 2 |",
    ].join("\n");

    const { container } = render(
      <Markdown
        value={value}
        className="markdown"
        codeBlockStyle="message"
      />,
    );

    await waitFor(() => {
      expect(container.querySelector("table")).toBeTruthy();
    });
    expect(screen.queryByRole("group", { name: "messages.toolCallCard.title" })).toBeNull();
  });
});
