/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OPEN_INSPECTOR_EVENT, type OpenInspectorDetail } from "./inspectorBus";
import { TurnSourceSummary } from "./TurnSourceSummary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // 测试桩：带 count 的 key 渲染为 "key:count"，便于断言数量文案。
    t: (key: string, opts?: { count?: number }) =>
      opts && typeof opts.count === "number" ? `${key}:${opts.count}` : key,
  }),
}));

function invoke(tool: string, params: Record<string, string>): string {
  const body = Object.entries(params)
    .map(([k, v]) => `<parameter name="${k}">${v}</parameter>`)
    .join("");
  return `<invoke name="${tool}">${body}</invoke>`;
}

const cleanupListeners: Array<() => void> = [];

function listenInspectorEvents(): OpenInspectorDetail[] {
  const received: OpenInspectorDetail[] = [];
  const handler = (event: Event) => {
    received.push((event as CustomEvent<OpenInspectorDetail>).detail);
  };
  window.addEventListener(OPEN_INSPECTOR_EVENT, handler);
  cleanupListeners.push(() => window.removeEventListener(OPEN_INSPECTOR_EVENT, handler));
  return received;
}

describe("TurnSourceSummary", () => {
  afterEach(() => {
    while (cleanupListeners.length > 0) {
      cleanupListeners.pop()?.();
    }
    cleanup();
  });

  it("renders cited and changed counts when the text has tool-call signals", () => {
    const text = [
      invoke("Read", { file_path: "/case/合同.docx" }),
      invoke("Read", { file_path: "/case/纪要.md" }),
      invoke("Edit", { file_path: "/case/风险清单.md", old_string: "a", new_string: "b" }),
      invoke("Edit", { file_path: "/case/风险清单.md", old_string: "c", new_string: "d" }),
      invoke("Write", { file_path: "/case/客户说明.md", content: "x" }),
    ].join("\n");

    render(<TurnSourceSummary text={text} />);

    expect(screen.getByText("fanbox.summary.citedCount:2")).toBeTruthy();
    expect(screen.getByText("fanbox.summary.changedCount:3")).toBeTruthy();
    // 引用卡预览 basename，title 给全路径；改动卡展示 top 文件 basename。
    expect(screen.getByText("合同.docx、纪要.md")).toBeTruthy();
    expect(screen.getByText("风险清单.md")).toBeTruthy();
    const citedCard = screen.getByText("fanbox.summary.citedCount:2").closest("button");
    expect(citedCard?.getAttribute("title")).toBe("/case/合同.docx\n/case/纪要.md");
  });

  it("renders nothing for a plain text reply", () => {
    const { container } = render(
      <TurnSourceSummary text="纯文本回复，没有工具调用。" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders only the changed card when there are edits but no reads", () => {
    render(
      <TurnSourceSummary text={invoke("Write", { file_path: "/a.md", content: "x" })} />,
    );
    expect(screen.getByText("fanbox.summary.changedCount:1")).toBeTruthy();
    expect(screen.queryByText("fanbox.summary.cited")).toBeNull();
  });

  it("dispatches ccgui:fanbox-open-inspector with tab=evidence on cited card click", () => {
    const received = listenInspectorEvents();
    render(
      <TurnSourceSummary text={invoke("Read", { file_path: "/case/合同.docx" })} />,
    );

    fireEvent.click(screen.getByTitle("/case/合同.docx"));

    expect(received).toEqual([{ tab: "evidence" }]);
  });

  it("dispatches ccgui:fanbox-open-inspector with tab=changes on changed card click", () => {
    const received = listenInspectorEvents();
    render(
      <TurnSourceSummary
        text={invoke("Edit", { file_path: "/a.md", old_string: "a", new_string: "b" })}
      />,
    );

    fireEvent.click(screen.getByTitle("/a.md ×1"));

    expect(received).toEqual([{ tab: "changes" }]);
  });
});
