// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown fenced block rendering", () => {
  it("renders fenced markdown blocks as rich markdown cards", async () => {
    const value = [
      "```markdown",
      "> [!TIP]",
      "> **Spring Boot Demo**",
      ">",
      "> - `mvn test` 已通过",
      "```",
    ].join("\n");

    const { container } = render(
      <Markdown value={value} className="markdown" codeBlockStyle="message" />,
    );

    await waitFor(() => {
      expect(container.querySelector(".markdown-codeblock-markdown")).toBeTruthy();
    });
    expect(container.querySelector(".markdown-codeblock-language")?.textContent).toBe("MARKDOWN");
    expect(container.querySelector("blockquote.markdown-alert-tip")).toBeTruthy();
    expect(container.querySelector(".markdown-alert-label-tip")?.textContent).toBe("TIP");
    expect(
      container.querySelector(".markdown-codeblock-markdown-content strong")?.textContent,
    ).toBe("Spring Boot Demo");
    expect(
      container.querySelector(".markdown-codeblock-markdown-content code")?.textContent,
    ).toBe("mvn test");
    expect(container.textContent).not.toContain("[!TIP]");
  });

  it("preserves file link actions inside rendered markdown code blocks", async () => {
    const onOpenFileLink = vi.fn();
    const value = [
      "```markdown",
      "[spec.md](/Users/test/project/openspec/spec.md#L12)",
      "```",
    ].join("\n");

    render(
      <Markdown
        value={value}
        className="markdown"
        codeBlockStyle="message"
        onOpenFileLink={onOpenFileLink}
      />,
    );

    fireEvent.click(await screen.findByRole("link", { name: "spec.md" }));

    expect(onOpenFileLink).toHaveBeenCalledWith(
      "/Users/test/project/openspec/spec.md#L12",
    );
  });

  it("keeps nested markdown fences as literal code examples", async () => {
    const value = [
      "示例：",
      "",
      "1. 以下内容应该保留为源码：",
      "",
      "   ```markdown",
      "   # Demo Title",
      "   - item",
      "   ```",
    ].join("\n");

    const { container } = render(
      <Markdown value={value} className="markdown" codeBlockStyle="message" />,
    );

    await waitFor(() => {
      expect(container.querySelector(".markdown-codeblock")).toBeTruthy();
    });
    expect(container.querySelector(".markdown-codeblock-markdown")).toBeNull();
    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).toContain("# Demo Title");
  });

  it("renders multiline code blocks with per-line selection wrappers", async () => {
    const value = [
      "```text",
      "first line",
      "second line",
      "```",
    ].join("\n");

    const { container } = render(
      <Markdown value={value} className="markdown" codeBlockStyle="message" />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".markdown-codeblock-line")).toHaveLength(2);
    });
    const lines = container.querySelectorAll(".markdown-codeblock-line");
    expect(lines).toHaveLength(2);
    expect(lines[0]?.textContent).toBe("first line");
    expect(lines[1]?.textContent).toBe("second line");
  });

  it("defers heavy code blocks without changing rendered canonical value", async () => {
    const onRenderedValueChange = vi.fn();
    const value = [
      "```ts",
      ...Array.from({ length: 44 }, (_, index) => `const heavyValue${index} = ${index};`),
      "```",
    ].join("\n");

    const { container } = render(
      <Markdown
        value={value}
        className="markdown message"
        codeBlockStyle="message"
        onRenderedValueChange={onRenderedValueChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Heavy Markdown detail deferred")).toBeTruthy();
    });
    expect(container.textContent).not.toContain("heavyValue43");
    expect(onRenderedValueChange).toHaveBeenCalledWith(value);

    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));

    await waitFor(() => {
      expect(container.textContent).toContain("heavyValue43");
    });
  });

  it("defers large markdown tables until explicitly expanded", async () => {
    const value = [
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 14 }, (_, index) => `| row-${index} | value | value |`),
    ].join("\n");

    const { container } = render(
      <Markdown
        value={value}
        className="markdown message"
        codeBlockStyle="message"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Heavy Markdown detail deferred")).toBeTruthy();
    });
    expect(container.textContent).not.toContain("row-13");

    fireEvent.click(screen.getByRole("button", { name: "Show detail" }));

    await waitFor(() => {
      expect(container.textContent).toContain("row-13");
    });
  });
});
