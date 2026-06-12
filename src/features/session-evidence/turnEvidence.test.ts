import { describe, expect, it } from "vitest";
import {
  deriveSessionEvidence,
  deriveTurnSourceSummary,
  deriveUserReferences,
  fileBasename,
  hasSourceSignal,
  pickEvidenceMessages,
} from "./turnEvidence";

function invoke(tool: string, params: Record<string, string>, complete = true): string {
  const body = Object.entries(params)
    .map(([k, v]) => `<parameter name="${k}">${v}</parameter>`)
    .join("");
  const open = `<invoke name="${tool}">${body}`;
  return complete ? `${open}</invoke>` : open;
}

describe("deriveTurnSourceSummary", () => {
  it("should classify reads as citations and edits as changes with counts", () => {
    const text = [
      "我先看下文件。",
      invoke("Read", { file_path: "/case/合同.docx" }),
      invoke("Read", { file_path: "/case/纪要.md" }),
      invoke("Edit", { file_path: "/case/风险清单.md", old_string: "a", new_string: "b" }),
      invoke("Edit", { file_path: "/case/风险清单.md", old_string: "c", new_string: "d" }),
      invoke("Write", { file_path: "/case/客户说明.md", content: "x" }),
      "完成。",
    ].join("\n");

    const s = deriveTurnSourceSummary(text);
    expect(s.citedFiles).toEqual(["/case/合同.docx", "/case/纪要.md"]);
    expect(s.changedFiles).toEqual([
      { path: "/case/风险清单.md", edits: 2 },
      { path: "/case/客户说明.md", edits: 1 },
    ]);
    expect(s.totalEdits).toBe(3);
    expect(hasSourceSignal(s)).toBe(true);
  });

  it("should dedupe repeated reads of the same file", () => {
    const text =
      invoke("Read", { file_path: "/a.md" }) + invoke("Read", { file_path: "/a.md" });
    expect(deriveTurnSourceSummary(text).citedFiles).toEqual(["/a.md"]);
  });

  it("should skip incomplete (streaming) tool calls", () => {
    const text = invoke("Edit", { file_path: "/a.md" }, false);
    const s = deriveTurnSourceSummary(text);
    expect(s.changedFiles).toEqual([]);
    expect(hasSourceSignal(s)).toBe(false);
  });

  it("should ignore Bash/Grep/Glob and tool calls without paths", () => {
    const text = [
      invoke("Bash", { command: "ls" }),
      invoke("Grep", { pattern: "x", path: "/repo" }),
      invoke("Glob", { pattern: "**/*.md" }),
    ].join("");
    expect(hasSourceSignal(deriveTurnSourceSummary(text))).toBe(false);
  });

  it("should use notebook_path for NotebookEdit", () => {
    const s = deriveTurnSourceSummary(
      invoke("NotebookEdit", { notebook_path: "/n.ipynb", new_source: "x" }),
    );
    expect(s.changedFiles).toEqual([{ path: "/n.ipynb", edits: 1 }]);
  });

  it("should return empty summary for plain prose", () => {
    const s = deriveTurnSourceSummary("纯文本回复，没有工具调用。");
    expect(s.citedFiles).toEqual([]);
    expect(s.changedFiles).toEqual([]);
    expect(hasSourceSignal(s)).toBe(false);
  });
});

describe("deriveSessionEvidence", () => {
  const asst = (text: string) => ({ role: "assistant" as const, text });
  const user = (text: string) => ({ role: "user" as const, text });

  it("should aggregate across messages and sort by edits desc", () => {
    const m1 = asst(
      invoke("Read", { file_path: "/合同.docx" }) +
        invoke("Edit", { file_path: "/清单.md" }),
    );
    const m2 = asst(
      invoke("Read", { file_path: "/合同.docx" }) +
        invoke("Edit", { file_path: "/清单.md" }) +
        invoke("Edit", { file_path: "/清单.md" }) +
        invoke("Write", { file_path: "/说明.md" }),
    );

    expect(deriveSessionEvidence([m1, m2])).toEqual([
      { path: "/清单.md", reads: 0, edits: 3 },
      { path: "/说明.md", reads: 0, edits: 1 },
      { path: "/合同.docx", reads: 2, edits: 0 },
    ]);
  });

  it("should count user @file references as citations", () => {
    const items = [
      user("@/case/方案原型.html 这个文件是干啥的？"),
      asst("这是一个静态原型文件。"),
    ];
    expect(deriveSessionEvidence(items)).toEqual([
      { path: "/case/方案原型.html", reads: 1, edits: 0 },
    ]);
  });

  it("should return empty list for sessions without signals", () => {
    expect(
      deriveSessionEvidence([user("你好"), asst("请稍等")]),
    ).toEqual([]);
  });
});

describe("deriveUserReferences", () => {
  it("should extract absolute file references from user text", () => {
    expect(
      deriveUserReferences("@/Users/a/docs/方案原型.html 这个文件是干啥的？"),
    ).toEqual(["/Users/a/docs/方案原型.html"]);
  });

  it("should return empty for plain text or text without @", () => {
    expect(deriveUserReferences("帮我审查协议")).toEqual([]);
  });
});

describe("pickEvidenceMessages", () => {
  it("should keep user/assistant text items and drop other kinds", () => {
    expect(
      pickEvidenceMessages([
        { id: "1", role: "user", text: "你好" },
        { id: "2", kind: "reasoning", summary: "s", content: "c" },
        { id: "3", role: "assistant", text: "回复" },
        null,
        { id: "4", role: "assistant", text: "" },
      ]),
    ).toEqual([
      { role: "user", text: "你好" },
      { role: "assistant", text: "回复" },
    ]);
  });
});

describe("fileBasename", () => {
  it("should strip directories and trailing slashes", () => {
    expect(fileBasename("/a/b/风险清单.md")).toBe("风险清单.md");
    expect(fileBasename("C:\\case\\合同.docx")).toBe("合同.docx");
    expect(fileBasename("plain.md")).toBe("plain.md");
  });
});
