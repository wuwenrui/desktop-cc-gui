import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import {
  APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS,
  adaptAppShellLegacyFlatContext,
  defineAppShellDomainContexts,
  findOverlappingAppShellDomainKeys,
  flattenAppShellDomainContexts,
  flattenSelectedAppShellDomainContexts,
  listAppShellDomainContextNames,
  reuseStableAppShellDomainContexts,
  type AppShellDomainContexts,
} from "./appShellDomainContexts";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSourceFile(relativePath: string): string {
  return readFileSync(join(currentDir, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function createDomainContexts(): AppShellDomainContexts {
  return {
    runtimeThreadContext: { activeThreadId: "thread-1" },
    workspaceNavigationContext: { activeWorkspaceId: "workspace-1" },
    composerContext: { activeDraft: "hello" },
    layoutContext: { centerMode: "chat" },
    fileEditorContext: { activeEditorFilePath: "src/app-shell.tsx" },
    settingsContext: { appSettings: { theme: "system" } },
    runtimeContext: { runtimeRunState: { runtimeConsoleVisible: false } },
    modelSelectionContext: { effectiveSelectedModelId: "model-1" },
    collaborationModeContext: { selectedCollaborationModeId: "code" },
  };
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  return null;
}

function extractExplicitAppShellDomainContextKeysByDomain(
  appShellSource: string,
): Record<string, string[]> {
  const sourceFile = ts.createSourceFile(
    "app-shell.tsx",
    appShellSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const explicitKeysByDomain: Record<string, string[]> = {};

  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === "rawAppShellDomainContexts"
    ) {
      const callExpression = node.initializer;
      expect(callExpression && ts.isCallExpression(callExpression)).toBe(true);
      const contextsArgument = (callExpression as ts.CallExpression)
        .arguments[0];
      expect(
        contextsArgument && ts.isObjectLiteralExpression(contextsArgument),
      ).toBe(true);

      for (const domainProperty of (
        contextsArgument as ts.ObjectLiteralExpression
      ).properties) {
        if (!ts.isPropertyAssignment(domainProperty)) {
          continue;
        }
        const domainName = getPropertyNameText(domainProperty.name);
        if (!domainName) {
          continue;
        }
        const domainValue = domainProperty.initializer;
        if (!ts.isObjectLiteralExpression(domainValue)) {
          continue;
        }
        explicitKeysByDomain[domainName] = [];
        for (const contextProperty of domainValue.properties) {
          if (
            !ts.isPropertyAssignment(contextProperty) &&
            !ts.isShorthandPropertyAssignment(contextProperty)
          ) {
            continue;
          }
          const key = getPropertyNameText(contextProperty.name);
          if (key) {
            explicitKeysByDomain[domainName].push(key);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return explicitKeysByDomain;
}

function compareDomainContextKeysWithOwnedKeys(
  explicitContextKeys: Iterable<string>,
  ownedContextKeys: Iterable<string>,
) {
  const explicitKeySet = new Set(explicitContextKeys);
  const ownedKeySet = new Set(ownedContextKeys);
  return {
    missingOwnerKeys: [...explicitKeySet]
      .filter((key) => !ownedKeySet.has(key))
      .sort(),
    staleOwnerKeys: [...ownedKeySet]
      .filter((key) => !explicitKeySet.has(key))
      .sort(),
  };
}

function findDuplicateRawContextKeys(
  explicitKeysByDomain: Record<string, string[]>,
) {
  const duplicateKeys: string[] = [];
  const firstOwnerByKey = new Map<string, string>();

  for (const [domainName, explicitKeys] of Object.entries(
    explicitKeysByDomain,
  )) {
    const keysInDomain = new Set<string>();
    for (const key of explicitKeys) {
      if (keysInDomain.has(key)) {
        duplicateKeys.push(`${domainName}.${key}`);
        continue;
      }
      keysInDomain.add(key);

      const firstOwner = firstOwnerByKey.get(key);
      if (firstOwner && firstOwner !== domainName) {
        duplicateKeys.push(`${firstOwner}/${domainName}.${key}`);
        continue;
      }
      firstOwnerByKey.set(key, domainName);
    }
  }

  return duplicateKeys.sort();
}

describe("appShellDomainContexts", () => {
  it("defines the nine app shell domain contexts in migration order", () => {
    expect(listAppShellDomainContextNames()).toEqual([
      "runtimeThreadContext",
      "workspaceNavigationContext",
      "composerContext",
      "layoutContext",
      "fileEditorContext",
      "settingsContext",
      "runtimeContext",
      "modelSelectionContext",
      "collaborationModeContext",
    ]);
  });

  it("keeps representative domain input ownership disjoint", () => {
    expect(findOverlappingAppShellDomainKeys()).toEqual([]);
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.runtimeThreadContext).toContain(
      "runtimeThreadBoundary",
    );
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.settingsContext).toContain(
      "sidebarCollapsed",
    );
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.settingsContext).toContain(
      "threadItemsByThread",
    );
    expect(
      APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.workspaceNavigationContext,
    ).toContain(
      "activeEditorFilePath",
    );
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.runtimeContext).toEqual([
      "runtimeRunState",
    ]);
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.modelSelectionContext).toContain(
      "effectiveSelectedModelId",
    );
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.collaborationModeContext).toContain(
      "selectedCollaborationModeId",
    );
  });

  it("covers every explicit app-shell domain context key in the ownership map", () => {
    const appShellSource = readSourceFile("../app-shell.tsx");
    const explicitKeysByDomain =
      extractExplicitAppShellDomainContextKeysByDomain(appShellSource);
    const missingOwnerKeysByDomain: Record<string, string[]> = {};
    const staleOwnerKeysByDomain: Record<string, string[]> = {};

    expect(findDuplicateRawContextKeys(explicitKeysByDomain)).toEqual([]);

    for (const domainName of listAppShellDomainContextNames()) {
      const { missingOwnerKeys, staleOwnerKeys } =
        compareDomainContextKeysWithOwnedKeys(
          explicitKeysByDomain[domainName] ?? [],
          APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS[domainName],
        );
      if (missingOwnerKeys.length > 0) {
        missingOwnerKeysByDomain[domainName] = missingOwnerKeys;
      }
      if (staleOwnerKeys.length > 0) {
        staleOwnerKeysByDomain[domainName] = staleOwnerKeys;
      }
    }

    expect(missingOwnerKeysByDomain).toEqual({});
    expect(staleOwnerKeysByDomain).toEqual({});
  });

  it("reports drift when a raw app-shell key has no owner", () => {
    const comparison = compareDomainContextKeysWithOwnedKeys(
      ["activeWorkspaceId", "newUnownedRuntimeKey"],
      ["activeWorkspaceId"],
    );

    expect(comparison.missingOwnerKeys).toEqual(["newUnownedRuntimeKey"]);
    expect(comparison.staleOwnerKeys).toEqual([]);
  });

  it("reports drift when a raw app-shell key appears in multiple domains", () => {
    expect(
      findDuplicateRawContextKeys({
        workspaceNavigationContext: ["activeWorkspaceId", "sharedKey"],
        collaborationModeContext: ["selectedCollaborationModeId", "sharedKey"],
      }),
    ).toEqual(["workspaceNavigationContext/collaborationModeContext.sharedKey"]);
  });

  it("preserves domain object references instead of cloning them", () => {
    const contexts = createDomainContexts();
    const definedContexts = defineAppShellDomainContexts(contexts);

    expect(definedContexts.runtimeThreadContext).toBe(
      contexts.runtimeThreadContext,
    );
    expect(definedContexts.workspaceNavigationContext).toBe(
      contexts.workspaceNavigationContext,
    );
    expect(definedContexts.composerContext).toBe(contexts.composerContext);
    expect(definedContexts.layoutContext).toBe(contexts.layoutContext);
    expect(definedContexts.fileEditorContext).toBe(contexts.fileEditorContext);
    expect(definedContexts.settingsContext).toBe(contexts.settingsContext);
    expect(definedContexts.runtimeContext).toBe(contexts.runtimeContext);
    expect(definedContexts.modelSelectionContext).toBe(
      contexts.modelSelectionContext,
    );
    expect(definedContexts.collaborationModeContext).toBe(
      contexts.collaborationModeContext,
    );
  });

  it("flattens domains for legacy consumers without mutating source domains", () => {
    const contexts = createDomainContexts();
    const flattenedContext = flattenAppShellDomainContexts(contexts);

    expect(flattenedContext).toMatchObject({
      activeThreadId: "thread-1",
      activeWorkspaceId: "workspace-1",
      activeDraft: "hello",
      centerMode: "chat",
      activeEditorFilePath: "src/app-shell.tsx",
      appSettings: { theme: "system" },
      runtimeRunState: { runtimeConsoleVisible: false },
      effectiveSelectedModelId: "model-1",
    });
    expect(flattenedContext).not.toBe(contexts.runtimeThreadContext);
    expect(contexts.runtimeThreadContext).toEqual({
      activeThreadId: "thread-1",
    });
  });

  it("flattens only selected domains for section hook adapters", () => {
    const contexts = createDomainContexts();

    const selectedContext = flattenSelectedAppShellDomainContexts(contexts, [
      "composerContext",
      "settingsContext",
    ]);

    expect(selectedContext).toEqual({
      activeDraft: "hello",
      appSettings: { theme: "system" },
    });
    expect(selectedContext).not.toHaveProperty("activeThreadId");
    expect(selectedContext).not.toHaveProperty("activeEditorFilePath");
  });

  it("adapts legacy flat contexts through one named migration boundary", () => {
    type RequiredLegacyBoundary = { activeDraft: string };
    const adaptedContext =
      adaptAppShellLegacyFlatContext<RequiredLegacyBoundary>({
        activeDraft: "hello",
      });

    expect(adaptedContext.activeDraft).toBe("hello");
  });

  it("reuses all nine domain references when shallow values are stable", () => {
    const appSettings = { theme: "system" };
    const runtimeRunState = { runtimeConsoleVisible: false };
    const modelSelection = { effectiveSelectedModelId: "model-1" };
    const collaborationMode = { selectedCollaborationModeId: "code" };
    const previousContexts: AppShellDomainContexts = {
      runtimeThreadContext: { activeThreadId: "thread-1" },
      workspaceNavigationContext: { activeWorkspaceId: "workspace-1" },
      composerContext: { activeDraft: "hello" },
      layoutContext: { centerMode: "chat" },
      fileEditorContext: { activeEditorFilePath: "src/app-shell.tsx" },
      settingsContext: { appSettings },
      runtimeContext: { runtimeRunState },
      modelSelectionContext: modelSelection,
      collaborationModeContext: collaborationMode,
    };
    const nextContexts: AppShellDomainContexts = {
      runtimeThreadContext: { activeThreadId: "thread-1" },
      workspaceNavigationContext: { activeWorkspaceId: "workspace-1" },
      composerContext: { activeDraft: "hello" },
      layoutContext: { centerMode: "chat" },
      fileEditorContext: { activeEditorFilePath: "src/app-shell.tsx" },
      settingsContext: { appSettings },
      runtimeContext: { runtimeRunState },
      modelSelectionContext: modelSelection,
      collaborationModeContext: collaborationMode,
    };

    const stableContexts = reuseStableAppShellDomainContexts(
      previousContexts,
      nextContexts,
    );

    for (const domainName of listAppShellDomainContextNames()) {
      expect(stableContexts[domainName]).toBe(previousContexts[domainName]);
    }
  });

  it("replaces only the changed domain reference", () => {
    const previousContexts = createDomainContexts();
    const nextContexts: AppShellDomainContexts = {
      ...previousContexts,
      composerContext: { activeDraft: "updated" },
    };

    const stableContexts = reuseStableAppShellDomainContexts(
      previousContexts,
      nextContexts,
    );

    expect(stableContexts.runtimeThreadContext).toBe(
      previousContexts.runtimeThreadContext,
    );
    expect(stableContexts.workspaceNavigationContext).toBe(
      previousContexts.workspaceNavigationContext,
    );
    expect(stableContexts.composerContext).toBe(nextContexts.composerContext);
    expect(stableContexts.layoutContext).toBe(previousContexts.layoutContext);
    expect(stableContexts.fileEditorContext).toBe(
      previousContexts.fileEditorContext,
    );
    expect(stableContexts.settingsContext).toBe(
      previousContexts.settingsContext,
    );
    expect(stableContexts.runtimeContext).toBe(previousContexts.runtimeContext);
    expect(stableContexts.modelSelectionContext).toBe(
      previousContexts.modelSelectionContext,
    );
    expect(stableContexts.collaborationModeContext).toBe(
      previousContexts.collaborationModeContext,
    );
  });

  it("keeps runtime updates isolated from file editor context", () => {
    const previousContexts = createDomainContexts();
    const nextContexts: AppShellDomainContexts = {
      ...previousContexts,
      runtimeContext: {
        runtimeRunState: { runtimeConsoleVisible: true },
      },
    };

    const stableContexts = reuseStableAppShellDomainContexts(
      previousContexts,
      nextContexts,
    );

    expect(stableContexts.fileEditorContext).toBe(
      previousContexts.fileEditorContext,
    );
    expect(stableContexts.runtimeContext).toBe(nextContexts.runtimeContext);
  });

  it("keeps file editor updates isolated from runtime context", () => {
    const previousContexts = createDomainContexts();
    const nextContexts: AppShellDomainContexts = {
      ...previousContexts,
      fileEditorContext: { activeEditorFilePath: "src/next.tsx" },
    };

    const stableContexts = reuseStableAppShellDomainContexts(
      previousContexts,
      nextContexts,
    );

    expect(stableContexts.runtimeContext).toBe(previousContexts.runtimeContext);
    expect(stableContexts.fileEditorContext).toBe(nextContexts.fileEditorContext);
  });

  it("keeps model selection updates isolated from settings context", () => {
    const previousContexts = createDomainContexts();
    const nextContexts: AppShellDomainContexts = {
      ...previousContexts,
      modelSelectionContext: { effectiveSelectedModelId: "model-2" },
    };

    const stableContexts = reuseStableAppShellDomainContexts(
      previousContexts,
      nextContexts,
    );

    expect(stableContexts.settingsContext).toBe(previousContexts.settingsContext);
    expect(stableContexts.modelSelectionContext).toBe(
      nextContexts.modelSelectionContext,
    );
  });

  it("keeps collaboration mode updates isolated from settings context", () => {
    const previousContexts = createDomainContexts();
    const nextContexts: AppShellDomainContexts = {
      ...previousContexts,
      collaborationModeContext: { selectedCollaborationModeId: "plan" },
    };

    const stableContexts = reuseStableAppShellDomainContexts(
      previousContexts,
      nextContexts,
    );

    expect(stableContexts.settingsContext).toBe(previousContexts.settingsContext);
    expect(stableContexts.collaborationModeContext).toBe(
      nextContexts.collaborationModeContext,
    );
  });

  it("keeps runtimeRunState owned only by runtimeContext", () => {
    expect(findOverlappingAppShellDomainKeys()).toEqual([]);
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.runtimeContext).toEqual([
      "runtimeRunState",
    ]);
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.fileEditorContext).not.toContain(
      "runtimeRunState",
    );
  });

  it("wires app-shell production context through the nine domain objects", () => {
    const appShellSource = readSourceFile("../app-shell.tsx");
    const renderAppShellSource = readSourceFile("renderAppShell.tsx");
    const searchAndComposerSource = readSourceFile(
      "useAppShellSearchAndComposerSection.ts",
    );
    const sectionsSource = readSourceFile("useAppShellSections.ts");
    const layoutNodesSource = readSourceFile(
      "useAppShellLayoutNodesSection.tsx",
    );

    expect(appShellSource).not.toContain("const appShellContext = {");
    expect(appShellSource).not.toContain("const appShellContext =");
    expect(appShellSource).toContain(
      "const rawAppShellDomainContexts = defineAppShellDomainContexts({",
    );
    for (const domainName of listAppShellDomainContextNames()) {
      expect(appShellSource).toContain(`${domainName}: {`);
    }
    expect(appShellSource).toContain("reuseStableAppShellDomainContexts(");
    expect(appShellSource).toContain(
      "useEffect(() => {\n    appShellDomainContextsRef.current = appShellDomainContexts;",
    );
    expect(appShellSource).not.toContain(
      ";\n  appShellDomainContextsRef.current = appShellDomainContexts;\n\n  const searchAndComposerSection",
    );
    for (const source of [
      renderAppShellSource,
      searchAndComposerSource,
      sectionsSource,
      layoutNodesSource,
    ]) {
      expect(source).not.toContain("as unknown as");
      expect(source).not.toMatch(
        /flattenAppShellDomainContexts\(\s*(ctx|input)\.appShellDomainContexts\s*\)/,
      );
    }
    expect(renderAppShellSource).toContain(
      "flattenSelectedAppShellDomainContexts(",
    );
    expect(sectionsSource).toContain("flattenSelectedAppShellDomainContexts(");
    expect(layoutNodesSource).toContain(
      "flattenSelectedAppShellDomainContexts(",
    );
    expect(renderAppShellSource).toContain(
      "adaptAppShellLegacyFlatContext<RenderAppShellFlattenedContext>",
    );
    expect(searchAndComposerSource).toContain(
      "COMPOSER_SEARCH_BOUNDARY_FIELD_GROUPS",
    );
    expect(searchAndComposerSource).not.toContain(
      "adaptAppShellLegacyFlatContext<ComposerSearchShellBoundary>",
    );
    expect(sectionsSource).toContain(
      "adaptAppShellLegacyFlatContext<UseAppShellSectionsContext>",
    );
    expect(appShellSource).toMatch(
      /renderAppShell\(\{\s*appShellDomainContexts,\s*searchAndComposerSection,\s*sections,\s*layoutNodes,/,
    );
    expect(appShellSource).not.toContain(
      "renderAppShell({\n    ...appShellContext",
    );
    expect(appShellSource).toMatch(
      /useAppShellSearchAndComposerSection\(\{\s*activeDraft,\s*activeEditorFilePath,\s*activeWorkspace,\s*activeWorkspaceId,/,
    );
    expect(appShellSource).not.toMatch(
      /useAppShellSearchAndComposerSection\(\{\s*workspaceNavigationContext:/,
    );
    expect(appShellSource).not.toContain(
      "useAppShellSearchAndComposerSection(appShellContext)",
    );
    expect(appShellSource).toMatch(
      /useAppShellSections\(\{\s*appShellDomainContexts,\s*searchAndComposerSection,\s*\}\)/,
    );
    expect(appShellSource).not.toContain(
      "useAppShellSections({\n    ...appShellContext",
    );
    expect(appShellSource).toMatch(
      /useAppShellLayoutNodesSection\(\{\s*appShellDomainContexts,\s*searchAndComposerSection,\s*sections,\s*isPullRequestComposer,\s*isPullRequestComposerFromSections:\s*sections\.isPullRequestComposer,/,
    );
    expect(appShellSource).not.toContain(
      "useAppShellLayoutNodesSection({\n    ...appShellContext",
    );
  });
});
