import type { ConversationItem } from "../../../types";
import { groupToolItems } from "../utils/groupToolItems";
import { buildTimelineProjectionRows } from "./messagesTimelineProjection";

export type HeavyHistoryFixtureVariant = "small" | "medium" | "heavy";

const VARIANT_SCALE: Record<HeavyHistoryFixtureVariant, number> = {
  small: 1,
  medium: 4,
  heavy: 10,
};

function buildTable(rowCount: number) {
  const rows = Array.from(
    { length: rowCount },
    (_unused, index) => `| file-${index}.ts | ${index} | ${index % 2 ? "updated" : "read"} |`,
  );
  return ["| file | lines | status |", "| --- | ---: | --- |", ...rows].join("\n");
}

function buildCodeFences(count: number) {
  return Array.from(
    { length: count },
    (_unused, index) => [
      "```ts",
      `export const value${index} = ${index};`,
      `export function render${index}() {`,
      "  return value0;",
      "}",
      "```",
    ].join("\n"),
  ).join("\n\n");
}

function createReadTool(index: number): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id: `tool-read-${index}`,
    kind: "tool",
    toolType: "Read",
    title: "Read",
    detail: `src/fixture/file-${index}.ts`,
    status: "completed",
    output: Array.from(
      { length: 80 },
      (_unused, lineIndex) => `${lineIndex + 1}: export const fixture${index}_${lineIndex} = true;`,
    ).join("\n"),
  };
}

export function createHeavyHistoryFixture(variant: HeavyHistoryFixtureVariant = "heavy") {
  const scale = VARIANT_SCALE[variant];
  const items: ConversationItem[] = [
    {
      id: "fixture-user-anchor",
      kind: "message",
      role: "user",
      text: "Please inspect the project and summarize the risky render paths.",
    },
    {
      id: "fixture-assistant-markdown",
      kind: "message",
      role: "assistant",
      isFinal: true,
      text: [
        "# Render audit",
        buildTable(12 * scale),
        buildCodeFences(2 * scale),
        "<tool_call name=\"read_file\"><path>src/fixture/secret.ts</path></tool_call>",
      ].join("\n\n"),
      images: variant === "heavy" ? ["data:image/png;base64,AAA"] : [],
    },
    ...Array.from({ length: 3 * scale }, (_unused, index) => createReadTool(index)),
    {
      id: "fixture-tool-diff",
      kind: "tool",
      toolType: "Edit",
      title: "Edit",
      detail: "src/fixture/large-diff.ts",
      status: "completed",
      output: "<tool_result>edited file</tool_result>",
      changes: Array.from({ length: scale }, (_unused, index) => ({
        path: `src/fixture/changed-${index}.ts`,
        kind: "modified",
        diff: [
          "diff --git a/file.ts b/file.ts",
          "@@ -1,3 +1,3 @@",
          "-old",
          "+new",
        ].join("\n"),
      })),
    },
    {
      id: "fixture-diff",
      kind: "diff",
      title: "Large diff",
      status: "completed",
      diff: Array.from(
        { length: 6 * scale },
        (_unused, index) => [
          `diff --git a/src/${index}.ts b/src/${index}.ts`,
          "@@ -1,2 +1,2 @@",
          "-const oldValue = false;",
          "+const newValue = true;",
        ].join("\n"),
      ).join("\n"),
    },
  ];

  const groupedEntries = groupToolItems(items);
  const rows = buildTimelineProjectionRows({
    activeUserInputAnchorItemId: "fixture-user-anchor",
    approvalVisible: false,
    claudeDockedReasoningItemIds: [],
    collapsedMiddleStepCount: 0,
    collapseLiveMiddleStepsEnabled: false,
    effectiveItemsCount: items.length,
    groupedEntries,
    hasVisibleUserInputRequest: false,
    hiddenClaudeReasoningOnly: false,
    isHistoryLoading: false,
    isThinking: false,
    shouldRenderUserInputAtTail: false,
  });

  return { items, groupedEntries, rows };
}
