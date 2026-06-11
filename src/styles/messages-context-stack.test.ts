import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const messagesPart1Css = readFileSync(
  fileURLToPath(new URL("./messages.part1.css", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");

function getCssRuleBlock(css: string, selector: string): string {
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("messages context stack layout", () => {
  it("keeps user context cards and the user bubble on the same right-aligned column", () => {
    const userBubbleRule = getCssRuleBlock(messagesPart1Css, ".message.user .bubble");
    const userStackRule = getCssRuleBlock(messagesPart1Css, ".message-context-stack.is-user");
    const stackedBubbleRule = getCssRuleBlock(
      messagesPart1Css,
      ".message-context-stack.is-user > .bubble",
    );

    expect(userBubbleRule).toContain(
      "max-width: var(--message-user-bubble-max-width, 85%);",
    );
    expect(userStackRule).toContain(
      "width: var(--message-user-bubble-max-width, 85%);",
    );
    expect(userStackRule).toContain("max-width: none;");
    expect(userStackRule).toContain("margin-left: auto;");
    expect(userStackRule).toContain("justify-items: end;");
    expect(stackedBubbleRule).toContain("max-width: 100%;");
  });

  it("bounds appended user context cards inside the shared user column", () => {
    const contextCardRule = getCssRuleBlock(
      messagesPart1Css,
      [
        ".message-context-stack.is-user > .memory-context-summary-card,",
        ".message-context-stack.is-user > .browser-context-summary-card,",
        ".message-context-stack.is-user > .intent-canvas-context-summary-card,",
        ".message-context-stack.is-user > .note-card-context-summary-card,",
        ".message-context-stack.is-user > .message-code-annotation-context",
      ].join("\n"),
    );

    expect(contextCardRule).toContain("max-width: 100%;");
    expect(contextCardRule).toContain("min-width: 0;");
    expect(contextCardRule).toContain("box-sizing: border-box;");
  });
});
