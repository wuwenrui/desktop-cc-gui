// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { EditToolGroupBlock } from "./EditToolGroupBlock";

function createEditToolItem(
  id: string,
  detail: Record<string, unknown>,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "edit",
    title: "Tool: edit",
    detail: JSON.stringify(detail),
    status: "completed",
  };
}

describe("EditToolGroupBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders batch title, file list and aggregated diff", () => {
    render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-1", {
            file_path: "src/release.yml",
            old_string: "line1\nline2",
            new_string: "line1\nline2\nline3",
          }),
          createEditToolItem("tool-2", {
            file_path: "src/app.ts",
            old_string: "a\nb\nc",
            new_string: "a\nc",
          }),
        ]}
      />,
    );

    expect(screen.getByText("tools.batchEditFile")).toBeTruthy();
    expect(screen.getByText("(2)")).toBeTruthy();
    expect(screen.getByText("release.yml")).toBeTruthy();
    expect(screen.getByText("app.ts")).toBeTruthy();
    expect(screen.getAllByText("+1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-1").length).toBeGreaterThan(0);
  });

  it("supports nested input and camelCase edit fields", () => {
    render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-5", {
            input: {
              filePath: "src/release.yml",
              oldString: "foo",
              newString: "bar",
            },
          }),
          createEditToolItem("tool-6", {
            arguments: {
              targetFile: "src/app.ts",
              oldString: "line-1",
              newString: "line-2",
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText("release.yml")).toBeTruthy();
    expect(screen.getByText("app.ts")).toBeTruthy();
    expect(screen.getAllByText("+1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-1").length).toBeGreaterThan(0);
  });

  it("expands an individual grouped row to reveal its diff", () => {
    const view = render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-expand", {
            file_path: "src/App.tsx",
            old_string: "line-a\nline-b",
            new_string: "line-a\nline-c",
          }),
        ]}
      />,
    );

    // 折叠态：分组内的行还没展开 diff
    expect(view.container.querySelector(".tool-change-inline-diff")).toBeNull();

    // markers[0] = 分组头，最后一个 marker = 文件行；点击文件行展开
    const markers = view.container.querySelectorAll('[data-slot="marker"]');
    fireEvent.click(markers[markers.length - 1]!);

    expect(view.container.querySelector(".tool-change-inline-diff")).toBeTruthy();
    expect(screen.getByText("line-b")).toBeTruthy();
    expect(screen.getByText("line-c")).toBeTruthy();
  });

  it("returns null when all entries miss file path", () => {
    const { container } = render(
      <EditToolGroupBlock
        items={[
          createEditToolItem("tool-4", {
            old_string: "a",
            new_string: "b",
          }),
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
