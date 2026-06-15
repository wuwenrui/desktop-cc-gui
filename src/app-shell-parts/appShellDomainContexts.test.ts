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

  it("keeps domain context helpers available while the fork still uses the legacy app-shell context", () => {
    const appShellSource = readSourceFile("../app-shell.tsx");

    expect(appShellSource).toContain("const appShellContext = {");
    expect(appShellSource).not.toContain(
      "const rawAppShellDomainContexts = defineAppShellDomainContexts({",
    );
    expect(appShellSource).toContain("renderAppShell({\n    ...appShellContext");
  });
});
