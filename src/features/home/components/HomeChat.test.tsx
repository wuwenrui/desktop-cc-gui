// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
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
  selectedBranchName: "feature/ref-layout",
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
    expect(markup).toContain("home-chat-workspace-select-trigger");
    expect(markup).toContain('aria-label="Workspace"');
    expect(markup).toContain("Primary branch");
    expect(markup).toContain("(feature/ref-layout)");
    expect(markup).toContain("Composer node");
    expect(markup).toContain("home-chat-engine-mark");
    expect(markup).toContain("home-chat-workspace-summary");
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
        selectedBranchName="feature/hero-layout"
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
      /home-chat-workspace-select-label">desktop-cc-gui<\/span>/,
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

    expect(markup).not.toContain("home-chat-workspace-summary");
  });

  it("does not render an unknown branch placeholder when branch data is unavailable", () => {
    const markup = renderToStaticMarkup(
      <HomeChat
        {...baseProps}
        selectedBranchName={null}
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

    expect(markup).not.toContain("unknown");
    expect(markup).not.toContain("home-chat-workspace-branch");
  });

  it("keeps New Home creation-first without a runtime dashboard", () => {
    const markup = renderToStaticMarkup(<HomeChat {...baseProps} />);

    expect(markup).toContain("Composer node");
    expect(markup).not.toContain("Run cockpit");
    expect(markup).not.toContain("What the agents are doing");
    expect(markup).not.toContain("home-chat-run-card");
    expect(markup).not.toContain("home-chat-run-detail");
  });

  it("opens recent conversations from the lightweight recent list", () => {
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

    fireEvent.click(screen.getByText("Follow up"));

    expect(handleSelectThread).toHaveBeenCalledWith("ws-1", "thread-1");
  });
});
