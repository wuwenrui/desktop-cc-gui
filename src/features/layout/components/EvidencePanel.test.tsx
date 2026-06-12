// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EvidencePanel } from "./EvidencePanel";

function invoke(tool: string, params: Record<string, string>): string {
  const body = Object.entries(params)
    .map(([key, value]) => `<parameter name="${key}">${value}</parameter>`)
    .join("");
  return `<invoke name="${tool}">${body}</invoke>`;
}

describe("EvidencePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("aggregates cited sources and change hotspots across messages", () => {
    const items = [
      {
        role: "assistant",
        text:
          invoke("Read", { file_path: "/case/合同.docx" }) +
          invoke("Edit", { file_path: "/case/风险清单.md", old_string: "a", new_string: "b" }),
      },
      {
        role: "assistant",
        text:
          invoke("Read", { file_path: "/case/合同.docx" }) +
          invoke("Edit", { file_path: "/case/风险清单.md", old_string: "c", new_string: "d" }),
      },
    ];

    const view = render(<EvidencePanel items={items} />);

    expect(screen.getByText("fanbox.evidence.title")).toBeTruthy();
    expect(screen.getByText("fanbox.evidence.citedTitle")).toBeTruthy();
    expect(screen.getByText("fanbox.evidence.hotTitle")).toBeTruthy();
    // 路径展示用 basename，全路径在 title
    expect(screen.getByText("合同.docx").closest("li")?.getAttribute("title")).toBe(
      "/case/合同.docx",
    );
    expect(screen.getByText("风险清单.md")).toBeTruthy();
    // 聚合次数：2 次引用 / 2 次改动
    expect(screen.getByText(/2\s+fanbox\.evidence\.readsLabel/)).toBeTruthy();
    expect(screen.getByText(/2\s+fanbox\.evidence\.editsLabel/)).toBeTruthy();
    // 改动热区卡带橙色左条样式钩子
    expect(view.container.querySelector(".fanbox-e-card.is-hot")).toBeTruthy();
    expect(view.container.querySelector(".fanbox-e-card.is-ref")).toBeTruthy();
    expect(screen.queryByText("fanbox.evidence.empty")).toBeNull();
  });

  it("renders only the cited card when there are no edits", () => {
    const view = render(
      <EvidencePanel items={[{ role: "assistant", text: invoke("Read", { file_path: "/a.md" }) }]} />,
    );
    expect(view.container.querySelector(".fanbox-e-card.is-ref")).toBeTruthy();
    expect(view.container.querySelector(".fanbox-e-card.is-hot")).toBeNull();
  });

  it("renders the empty state when no tool-call signals exist", () => {
    render(<EvidencePanel items={[{ role: "assistant", text: "纯文本回复，没有工具调用。" }]} />);
    expect(screen.getByText("fanbox.evidence.empty")).toBeTruthy();
    expect(screen.queryByText("fanbox.evidence.citedTitle")).toBeNull();
    expect(screen.queryByText("fanbox.evidence.hotTitle")).toBeNull();
  });

  it("renders the empty state for an empty session", () => {
    render(<EvidencePanel items={[]} />);
    expect(screen.getByText("fanbox.evidence.empty")).toBeTruthy();
  });

  it("counts user @file references as cited sources", () => {
    const view = render(
      <EvidencePanel
        items={[
          { role: "user", text: "@/case/方案原型.html 这个文件是干啥的？" },
          { role: "assistant", text: "这是一个静态原型。" },
        ]}
      />,
    );
    expect(view.container.querySelector(".fanbox-e-card.is-ref")).toBeTruthy();
    expect(screen.getByText("方案原型.html")).toBeTruthy();
    expect(screen.queryByText("fanbox.evidence.empty")).toBeNull();
  });
});
