/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SessionCasebar,
  SessionEvidenceBoard,
  SessionFilesBoard,
} from "./SessionCasebar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "fanbox.casebar.viewChat": "对话",
        "fanbox.casebar.viewFiles": "文件",
        "fanbox.casebar.viewEvidence": "证据",
        "fanbox.casebar.filesEmpty": "还没有文件活动",
        "fanbox.casebar.evidenceEmpty": "还没有证据",
        "fanbox.casebar.latestReply": "最近回复摘要",
        "fanbox.evidence.readsLabel": "次引用",
        "fanbox.evidence.editsLabel": "次改动",
        "fanbox.summary.cited": "引用文件",
        "fanbox.summary.changed": "改动热区",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("SessionCasebar", () => {
  it("renders title and three views with active state", () => {
    render(
      <SessionCasebar title="股权转让协议审查" view="chat" onViewChange={vi.fn()} />,
    );
    expect(screen.getByText("股权转让协议审查")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "对话" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "文件" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: "证据" })).toBeTruthy();
  });

  it("fires onViewChange when switching", () => {
    const onChange = vi.fn();
    render(<SessionCasebar title="t" view="chat" onViewChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "文件" }));
    expect(onChange).toHaveBeenCalledWith("files");
    fireEvent.click(screen.getByRole("tab", { name: "证据" }));
    expect(onChange).toHaveBeenCalledWith("evidence");
  });
});

describe("SessionFilesBoard", () => {
  it("renders file cards ordered with edit counts and hot marks", () => {
    render(
      <SessionFilesBoard
        activities={[
          { path: "/case/风险清单.md", reads: 1, edits: 8 },
          { path: "/case/股权转让协议.docx", reads: 5, edits: 0 },
        ]}
      />,
    );
    expect(screen.getByText("风险清单.md")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("股权转让协议.docx")).toBeTruthy();
    expect(screen.getByText(/5 次引用/)).toBeTruthy();
  });

  it("renders empty state when no activity", () => {
    render(<SessionFilesBoard activities={[]} />);
    expect(screen.getByText("还没有文件活动")).toBeTruthy();
  });
});

describe("SessionEvidenceBoard", () => {
  it("renders the latest reply digest", () => {
    render(
      <SessionEvidenceBoard
        latest={{
          citedFiles: ["/case/合同.docx"],
          changedFiles: [{ path: "/case/清单.md", edits: 3 }],
          totalEdits: 3,
        }}
      />,
    );
    expect(screen.getByText("最近回复摘要")).toBeTruthy();
    expect(screen.getByText(/合同\.docx/)).toBeTruthy();
    expect(screen.getByText(/清单\.md ×3/)).toBeTruthy();
  });

  it("renders empty state without fabricating data", () => {
    render(<SessionEvidenceBoard latest={null} />);
    expect(screen.getByText("还没有证据")).toBeTruthy();
  });
});
