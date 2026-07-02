import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const messagesShellCss = readFileSync(
  fileURLToPath(new URL("./messages.part1-shell.css", import.meta.url)),
  "utf8",
);
const messagesHistoryStickyCss = readFileSync(
  fileURLToPath(new URL("./messages.history-sticky.css", import.meta.url)),
  "utf8",
);
const messagesLayoutCss = readFileSync(
  fileURLToPath(new URL("./messages.part1.css", import.meta.url)),
  "utf8",
);
const messagesMarkdownCss = readFileSync(
  fileURLToPath(new URL("./messages.part2.css", import.meta.url)),
  "utf8",
);
const mainCss = readFileSync(
  fileURLToPath(new URL("./main.css", import.meta.url)),
  "utf8",
);
const sessionCasebarCss = readFileSync(
  fileURLToPath(
    new URL("../features/session-evidence/session-casebar.css", import.meta.url),
  ),
  "utf8",
);

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("messages overflow guard", () => {
  it("keeps the message scroll container from drifting horizontally", () => {
    expect(getCssRuleBlock(messagesShellCss, ".messages")).toContain("overflow-x: clip;");
    expect(getCssRuleBlock(messagesShellCss, ".messages-full")).toContain("min-width: 0;");
    expect(getCssRuleBlock(messagesShellCss, ".messages-full")).toContain("box-sizing: border-box;");
  });

  it("aligns the sticky user header with the readable message canvas", () => {
    expect(getCssRuleBlock(messagesHistoryStickyCss, ".messages-history-sticky-header-content"))
      .toContain("max-width: min(750px, 100%);");
  });

  it("clips horizontal overflow at the chat layout boundary", () => {
    expect(getCssRuleBlock(mainCss, ".content")).toContain("overflow-x: hidden;");
    expect(getCssRuleBlock(mainCss, ".content-layer")).toContain("overflow-x: hidden;");
    expect(getCssRuleBlock(mainCss, ".workspace-chat-stack")).toContain("overflow-x: hidden;");
  });

  it("allows message rows and user context stacks to shrink within the canvas", () => {
    expect(getCssRuleBlock(messagesLayoutCss, ".message")).toContain("width: 100%;");
    expect(getCssRuleBlock(messagesLayoutCss, ".message")).toContain("min-width: 0;");
    expect(getCssRuleBlock(messagesLayoutCss, ".message-user-layout")).toContain("min-width: 0;");
    expect(getCssRuleBlock(messagesLayoutCss, ".message-context-stack.is-user")).toContain(
      "max-width: 100%;",
    );
  });

  it("lets the conditional session stage wrappers shrink with the viewport", () => {
    expect(getCssRuleBlock(sessionCasebarCss, ".session-stage")).toContain("min-width: 0;");
    expect(getCssRuleBlock(sessionCasebarCss, ".session-stage")).toContain("overflow-x: hidden;");
    expect(getCssRuleBlock(sessionCasebarCss, ".session-stage-chat")).toContain("min-width: 0;");
    expect(getCssRuleBlock(sessionCasebarCss, ".session-stage-chat")).toContain(
      "overflow-x: hidden;",
    );
  });

  it("contains wide markdown and task output inside their own surfaces", () => {
    expect(getCssRuleBlock(messagesMarkdownCss, ".markdown")).toContain("max-width: 100%;");
    expect(getCssRuleBlock(messagesMarkdownCss, ".markdown")).toContain(
      "overflow-wrap: anywhere;",
    );
    expect(getCssRuleBlock(messagesMarkdownCss, ".message .markdown-codeblock")).toContain(
      "max-width: 100%;",
    );
    expect(getCssRuleBlock(messagesMarkdownCss, ".markdown table")).toContain(
      "box-sizing: border-box;",
    );
  });
});
