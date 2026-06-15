import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  getThreadSelectDiffCleanupAction,
  shouldCollapseRightPanelOnThreadSelect,
  shouldPreserveEditorOnThreadSelect,
} from "./threadEditorPreservation";

const currentDir = dirname(fileURLToPath(import.meta.url));

const layoutNodesDomainNames = [
  "workspace",
  "runtime",
  "chrome",
  "editor",
  "git",
  "composer",
  "panels",
] as const;

function getPropertyNameText(
  name: ts.PropertyName,
  sourceFile: ts.SourceFile,
): string {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }

  return name.getText(sourceFile);
}

function getUseLayoutNodesGroupKeys(): Map<string, string[]> {
  const filePath = join(currentDir, "useAppShellLayoutNodesSection.tsx");
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let result: Map<string, string[]> | null = null;

  const visit = (node: ts.Node): void => {
    if (
      result ||
      !ts.isCallExpression(node) ||
      node.expression.getText(sourceFile) !== "useLayoutNodes"
    ) {
      ts.forEachChild(node, visit);
      return;
    }

    const [argument] = node.arguments;
    if (!argument || !ts.isObjectLiteralExpression(argument)) {
      throw new Error("useLayoutNodes must receive an object literal.");
    }

    const groups = new Map<string, string[]>();
    for (const property of argument.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !ts.isObjectLiteralExpression(property.initializer)
      ) {
        continue;
      }

      const groupName = getPropertyNameText(property.name, sourceFile);
      const keys: string[] = [];
      for (const groupProperty of property.initializer.properties) {
        if (ts.isShorthandPropertyAssignment(groupProperty)) {
          keys.push(groupProperty.name.text);
          continue;
        }

        if (
          ts.isPropertyAssignment(groupProperty) ||
          ts.isMethodDeclaration(groupProperty)
        ) {
          keys.push(getPropertyNameText(groupProperty.name, sourceFile));
        }
      }

      groups.set(groupName, keys);
    }

    result = groups;
  };

  visit(sourceFile);

  if (!result) {
    throw new Error("useLayoutNodes call was not found.");
  }

  return result;
}

describe("shouldPreserveEditorOnThreadSelect", () => {
  it("preserves desktop editor when selecting another thread in the same workspace", () => {
    expect(
      shouldPreserveEditorOnThreadSelect({
        isCompact: false,
        centerMode: "editor",
        activeWorkspaceId: "workspace-1",
        targetWorkspaceId: "workspace-1",
        activeEditorFilePath: "src/App.tsx",
      }),
    ).toBe(true);
  });

  it("falls back to chat outside the same desktop editor workspace", () => {
    const base = {
      isCompact: false,
      centerMode: "editor" as const,
      activeWorkspaceId: "workspace-1",
      targetWorkspaceId: "workspace-1",
      activeEditorFilePath: "src/App.tsx",
    };

    expect(
      shouldPreserveEditorOnThreadSelect({
        ...base,
        targetWorkspaceId: "workspace-2",
      }),
    ).toBe(false);
    expect(
      shouldPreserveEditorOnThreadSelect({
        ...base,
        centerMode: "chat",
      }),
    ).toBe(false);
    expect(
      shouldPreserveEditorOnThreadSelect({
        ...base,
        activeEditorFilePath: null,
      }),
    ).toBe(false);
    expect(
      shouldPreserveEditorOnThreadSelect({
        ...base,
        isCompact: true,
      }),
    ).toBe(false);
  });
});

describe("getThreadSelectDiffCleanupAction", () => {
  it("does not exit diff view when thread selection preserves the editor split", () => {
    expect(getThreadSelectDiffCleanupAction(true)).toBe("clear-selected-diff");
  });

  it("keeps the existing full diff exit behavior when editor split is not preserved", () => {
    expect(getThreadSelectDiffCleanupAction(false)).toBe("exit-diff-view");
  });
});

describe("shouldCollapseRightPanelOnThreadSelect", () => {
  it("keeps right-side surfaces stable while preserving the editor", () => {
    expect(
      shouldCollapseRightPanelOnThreadSelect({
        preserveEditor: true,
        requestedCollapse: true,
      }),
    ).toBe(false);
  });

  it("honors requested collapse when editor preservation is not active", () => {
    expect(
      shouldCollapseRightPanelOnThreadSelect({
        preserveEditor: false,
        requestedCollapse: true,
      }),
    ).toBe(true);
  });
});

describe("useAppShellLayoutNodesSection adapter contract", () => {
  it("passes grouped domain bags into useLayoutNodes instead of a flat option list", () => {
    const groups = getUseLayoutNodesGroupKeys();
    const duplicateKeys: string[] = [];
    const seenKeys = new Set<string>();

    for (const keys of groups.values()) {
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        if (seenKeys.has(key)) {
          duplicateKeys.push(key);
          continue;
        }

        seenKeys.add(key);
      }
    }

    expect([...groups.keys()]).toEqual([...layoutNodesDomainNames]);
    expect(duplicateKeys).toEqual([]);
    expect(groups.get("workspace")).toContain("workspaces");
    expect(groups.get("runtime")).toContain("activeItems");
    expect(groups.get("composer")).toContain("onSend");
  });

  it("forwards Project Map toggle state into useLayoutNodes despite ts-nocheck", () => {
    const source = readFileSync(
      join(currentDir, "useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    const layoutNodesOptions = source.slice(
      source.indexOf("} = useLayoutNodes({"),
      source.indexOf(
        "  const runSelectedPath",
        source.indexOf("} = useLayoutNodes({"),
      ),
    );

    expect(layoutNodesOptions).toContain("centerMode,");
    expect(layoutNodesOptions).toContain("setCenterMode,");
    expect(layoutNodesOptions).toContain("editorSplitCompanion,");
    expect(layoutNodesOptions).toContain("setEditorSplitCompanion,");
  });

  it("collapses the left conversation sidebar before opening Project Map", () => {
    const source = readFileSync(
      join(currentDir, "useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    const projectMapHandler = source.slice(
      source.indexOf("onOpenProjectMap: () => {"),
      source.indexOf(
        "gitDiffViewStyle,",
        source.indexOf("onOpenProjectMap: () => {"),
      ),
    );

    expect(projectMapHandler).toContain("closeSettings();");
    expect(projectMapHandler).toContain("collapseSidebar();");
    expect(projectMapHandler.indexOf("collapseSidebar();")).toBeLessThan(
      projectMapHandler.indexOf('setCenterMode("projectMap");'),
    );
  });

  it("routes message-tail fork through message anchored fork with provider options", () => {
    const source = readFileSync(
      join(currentDir, "useAppShellLayoutNodesSection.tsx"),
      "utf8",
    );
    const forkHandler = source.slice(
      source.indexOf("onForkFromMessage: async (messageId, options) => {"),
      source.indexOf(
        "canStop: canInterrupt,",
        source.indexOf("onForkFromMessage: async (messageId, options) => {"),
      ),
    );

    expect(forkHandler).toContain("forkSessionFromMessageForWorkspace");
    expect(forkHandler).toContain("messageId");
    expect(forkHandler).toContain('mode: "messages-only"');
    expect(forkHandler).toContain(
      "providerProfileId: options?.providerProfileId ?? null",
    );
    expect(forkHandler).toContain(
      "providerProfile: options?.providerProfile ?? null",
    );
    expect(forkHandler).toContain(
      'throw new Error("Fork did not return a child conversation.")',
    );
    expect(forkHandler).toContain('typeof updateThreadParent === "function"');
    expect(forkHandler).not.toContain('await startFork("/fork");');
    expect(forkHandler).not.toContain(
      "forkClaudeSessionFromMessageForWorkspace",
    );
  });
});
