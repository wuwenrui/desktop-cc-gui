import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  };
}

describe("appShellDomainContexts", () => {
  it("defines the six app shell domain contexts in migration order", () => {
    expect(listAppShellDomainContextNames()).toEqual([
      "runtimeThreadContext",
      "workspaceNavigationContext",
      "composerContext",
      "layoutContext",
      "fileEditorContext",
      "settingsContext",
    ]);
  });

  it("keeps representative domain input ownership disjoint", () => {
    expect(findOverlappingAppShellDomainKeys()).toEqual([]);
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.runtimeThreadContext).toContain(
      "threadItemsByThread",
    );
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.layoutContext).toContain(
      "sidebarCollapsed",
    );
    expect(APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS.fileEditorContext).toContain(
      "activeEditorFilePath",
    );
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

  it("reuses all six domain references when shallow values are stable", () => {
    const appSettings = { theme: "system" };
    const previousContexts: AppShellDomainContexts = {
      runtimeThreadContext: { activeThreadId: "thread-1" },
      workspaceNavigationContext: { activeWorkspaceId: "workspace-1" },
      composerContext: { activeDraft: "hello" },
      layoutContext: { centerMode: "chat" },
      fileEditorContext: { activeEditorFilePath: "src/app-shell.tsx" },
      settingsContext: { appSettings },
    };
    const nextContexts: AppShellDomainContexts = {
      runtimeThreadContext: { activeThreadId: "thread-1" },
      workspaceNavigationContext: { activeWorkspaceId: "workspace-1" },
      composerContext: { activeDraft: "hello" },
      layoutContext: { centerMode: "chat" },
      fileEditorContext: { activeEditorFilePath: "src/app-shell.tsx" },
      settingsContext: { appSettings },
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
  });

  it("wires app-shell production context through the six domain objects", () => {
    const appShellSource = readSourceFile("../app-shell.tsx");
    const renderAppShellSource = readSourceFile("renderAppShell.tsx");
    const searchAndComposerSource = readSourceFile(
      "useAppShellSearchAndComposerSection.ts",
    );
    const sectionsSource = readSourceFile("useAppShellSections.ts");

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
    expect(renderAppShellSource).toMatch(
      /flattenAppShellDomainContexts\(\s*ctx\.appShellDomainContexts\s*\)/,
    );
    for (const source of [
      renderAppShellSource,
      searchAndComposerSource,
      sectionsSource,
    ]) {
      expect(source).not.toContain("as unknown as");
    }
    expect(renderAppShellSource).toContain(
      "adaptAppShellLegacyFlatContext<RenderAppShellFlattenedContext>",
    );
    expect(searchAndComposerSource).toContain(
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
      /useAppShellSearchAndComposerSection\(\{\s*workspaceNavigationContext:\s*appShellDomainContexts\.workspaceNavigationContext,\s*composerContext:\s*appShellDomainContexts\.composerContext,\s*layoutContext:\s*appShellDomainContexts\.layoutContext,\s*fileEditorContext:\s*appShellDomainContexts\.fileEditorContext,\s*settingsContext:\s*appShellDomainContexts\.settingsContext,\s*\}\)/,
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
