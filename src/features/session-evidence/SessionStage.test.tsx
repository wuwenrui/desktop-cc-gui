/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionStage } from "./SessionStage";

function invoke(tool: string, params: Record<string, string>): string {
  const body = Object.entries(params)
    .map(([k, v]) => `<parameter name="${k}">${v}</parameter>`)
    .join("");
  return `<invoke name="${tool}">${body}</invoke>`;
}

const ITEMS = [
  { id: "1", role: "user", text: "帮我审查" },
  {
    id: "2",
    role: "assistant",
    text:
      "已完成。" +
      invoke("Read", { file_path: "/case/股权转让协议.docx" }) +
      invoke("Edit", { file_path: "/case/风险清单.md" }) +
      invoke("Edit", { file_path: "/case/风险清单.md" }),
  },
  { id: "3", kind: "reasoning", summary: "s", content: "c" },
];

describe("SessionStage", () => {
  it("passes children through without casebar when no session and no messages", () => {
    render(
      <SessionStage sessionKey={null} title="" items={[]}>
        <div>聊天内容</div>
      </SessionStage>,
    );
    expect(screen.getByText("聊天内容")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("renders casebar when messages exist even if thread id is missing", () => {
    render(
      <SessionStage sessionKey={null} title="workspace" items={ITEMS}>
        <div>聊天内容</div>
      </SessionStage>,
    );
    expect(screen.getByRole("tablist")).toBeTruthy();
  });

  it("renders casebar with title and keeps chat children mounted across views", () => {
    render(
      <SessionStage sessionKey="t1" title="股权转让协议审查" items={ITEMS}>
        <div data-testid="chat-body">聊天内容</div>
      </SessionStage>,
    );
    expect(screen.getByText("股权转让协议审查")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Files|文件|fanbox.casebar.viewFiles/ }));
    // children 仍挂载（display:none 保活），文件卡出现
    expect(screen.getByTestId("chat-body")).toBeTruthy();
    expect(screen.getByText("风险清单.md")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("股权转让协议.docx")).toBeTruthy();
  });

  it("files view renders the workspace tree zone when workspace data is provided", () => {
    const { container } = render(
      <SessionStage
        sessionKey="t1"
        title="t"
        items={ITEMS}
        workspaceFiles={["case/风险清单.md", "case/股权转让协议.docx"]}
        workspaceDirectories={["case"]}
      >
        <div>chat</div>
      </SessionStage>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Files|文件|fanbox.casebar.viewFiles/ }));
    // 双区：上区会话卡 + 下区工作区树；树中 /case/风险清单.md ×2 命中热度标记
    expect(container.querySelector(".session-file-card")).toBeTruthy();
    expect(container.querySelector(".session-ws-tree")).toBeTruthy();
    expect(container.querySelector(".session-ws-badge.is-edit")).toBeTruthy();
  });

  it("files view keeps the single-zone layout without workspace data", () => {
    const { container } = render(
      <SessionStage sessionKey="t1" title="t" items={ITEMS}>
        <div>chat</div>
      </SessionStage>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Files|文件|fanbox.casebar.viewFiles/ }));
    expect(container.querySelector(".session-file-card")).toBeTruthy();
    expect(container.querySelector(".session-ws-tree")).toBeNull();
    expect(container.querySelector(".session-board-section")).toBeNull();
  });

  it("evidence view shows the latest reply digest", () => {
    render(
      <SessionStage sessionKey="t1" title="t" items={ITEMS}>
        <div>chat</div>
      </SessionStage>,
    );
    fireEvent.click(
      screen.getByRole("tab", { name: /Evidence|证据|fanbox.casebar.viewEvidence/ }),
    );
    expect(screen.getByText(/风险清单\.md ×2/)).toBeTruthy();
  });

  it("resets to chat view when session changes", () => {
    const { rerender } = render(
      <SessionStage sessionKey="t1" title="t" items={ITEMS}>
        <div data-testid="chat-body">chat</div>
      </SessionStage>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Files|文件|fanbox.casebar.viewFiles/ }));
    expect(screen.getByTestId("chat-body").parentElement?.style.display).toBe("none");

    rerender(
      <SessionStage sessionKey="t2" title="t" items={[]}>
        <div data-testid="chat-body">chat</div>
      </SessionStage>,
    );
    expect(screen.getByTestId("chat-body").parentElement?.style.display).not.toBe("none");
  });
});
