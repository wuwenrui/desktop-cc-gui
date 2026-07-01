// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeChat } from "./HomeChat";

const translations: Record<string, string> = {
  "home.newConversation": "New Conversation",
  "homeChat.minimalTitle": "Create anything",
  "homeChat.workspaceSelectLabel": "Workspace",
  "workspace.homeBranchLabelMain": "Primary branch",
  "workspace.homeBranchLabelWorktree": "Worktree",
  "homeChat.recentConversations": "Recent conversations",
  "homeChat.loadingRecentAgents": "Loading recent work",
  "workspace.unknownBranch": "unknown",
};

function translate(key: string, params?: string | Record<string, string | number>) {
  const template = translations[key] ?? key;
  if (!params || typeof params === "string") {
    return template;
  }

  return Object.entries(params).reduce(
    (acc, [paramKey, value]) => acc.replace(new RegExp(`{{${paramKey}}}`, "g"), String(value)),
    template,
  );
}

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: translate,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const baseProps = {
  latestAgentRuns: [],
  isLoadingLatestAgents: false,
  onSelectThread: vi.fn(),
  onSelectWorkspace: vi.fn(),
  onAddWorkspace: vi.fn(),
  composerNode: <div>Composer node</div>,
  selectedEngine: "claude" as const,
  selectedWorkspaceId: "ws-1",
  branchControl: {
    branchName: "feature/ref-layout",
    branches: [{ name: "feature/ref-layout", lastCommit: 1 }],
    onCheckout: vi.fn(),
    onCreate: vi.fn(),
  },
  workspaces: [
    { id: "ws-1", name: "desktop-cc-gui", path: "/Users/demo/Desktop/desktop-cc-gui", kind: "main" as const },
    { id: "ws-2", name: "workfree", path: "/Users/demo/Desktop/workfree", kind: "worktree" as const, worktree: { branch: "feature/workfree" } },
  ],
};

describe("HomeChat", () => {
  it("renders the compact hero, workspace selector, and composer host", () => {
    const markup = renderToStaticMarkup(<HomeChat {...baseProps} />);

    expect(markup).toContain("Create anything");
    expect(markup).toContain("desktop-cc-gui");
    expect(markup).toContain("home-chat-workspace-select");
    expect(markup).toContain("composer-branch-badge-trigger");
    expect(markup).toContain('aria-label="Workspace"');
    expect(markup).toContain("composer-branch-badge");
    expect(markup).toContain("feature/ref-layout");
    expect(markup).toContain("Composer node");
    expect(markup).toContain("home-chat-engine-mark");
    expect(markup).toContain("home-chat-composer-meta");
  });

  it("keeps the composer mounted inside the dedicated host container", () => {
    const markup = renderToStaticMarkup(<HomeChat {...baseProps} />);

    expect(markup).toContain("home-chat-composer-host");
    expect(markup).toContain("Composer node");
  });

  it("shows the workspace name in the trigger instead of the full path", () => {
    const markup = renderToStaticMarkup(
      <HomeChat
        {...baseProps}
        selectedWorkspaceId="80ad34fc-f38d-4023-8bb5-3073b0f3e001"
        workspaces={[
          {
            id: "80ad34fc-f38d-4023-8bb5-3073b0f3e001",
            name: "desktop-cc-gui",
            path: "/Users/demo/Desktop/desktop-cc-gui",
            kind: "main",
          },
        ]}
      />,
    );

    expect(markup).toMatch(
      /composer-branch-badge-name">desktop-cc-gui<\/span>/,
    );
    expect(markup).not.toContain("/Users/demo/Desktop/desktop-cc-gui");
  });

  it("hides the workspace summary when no workspace options are available", () => {
    const markup = renderToStaticMarkup(
      <HomeChat
        {...baseProps}
        selectedWorkspaceId={null}
        workspaces={[]}
      />,
    );

    expect(markup).not.toContain("home-chat-composer-meta");
  });

  it("does not render a branch badge when branch data is unavailable", () => {
    const markup = renderToStaticMarkup(
      <HomeChat
        {...baseProps}
        branchControl={null}
        workspaces={[
          {
            id: "ws-1",
            name: "desktop-cc-gui",
            path: "/Users/demo/Desktop/desktop-cc-gui",
            kind: "main",
          },
        ]}
      />,
    );

    // 工作区选择器现已复用 composer-branch-badge 视觉，分支胶囊的独有标识是 git-branch 图标
    expect(markup).not.toContain("lucide-git-branch");
  });

  it("keeps New Home creation-first without a runtime dashboard", () => {
    const markup = renderToStaticMarkup(<HomeChat {...baseProps} />);

    expect(markup).toContain("Composer node");
    expect(markup).not.toContain("Run cockpit");
    expect(markup).not.toContain("What the agents are doing");
    expect(markup).not.toContain("home-chat-run-card");
    expect(markup).not.toContain("home-chat-run-detail");
  });

  it("does not render recent conversations on the home page", () => {
    const handleSelectThread = vi.fn();

    render(
      <HomeChat
        {...baseProps}
        onSelectThread={handleSelectThread}
        latestAgentRuns={[{
          workspaceId: "ws-1",
          threadId: "thread-1",
          projectName: "desktop-cc-gui",
          message: "Follow up",
          timestamp: 1,
          isProcessing: false,
        }]}
      />,
    );

    expect(screen.queryByText("Follow up")).toBeNull();
    expect(screen.queryByText("Recent conversations")).toBeNull();
    expect(handleSelectThread).not.toHaveBeenCalled();
  });
});


// Workspace picker virtualization was removed when the picker migrated to the
// shadcn Popover + Command combobox; cmdk renders the (rarely large) project
// list directly, so there is no virtualization threshold left to assert.
