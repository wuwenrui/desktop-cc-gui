// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { HomeChat } from "./HomeChat";

const translations: Record<string, string> = {
  "home.newConversation": "New Conversation",
  "homeChat.minimalTitle": "Create anything",
  "homeChat.addWorkspaceAction": "Add new project",
  "homeChat.workspaceNoMatch": "No projects found",
  "homeChat.workspaceSearchPlaceholder": "Search projects",
  "homeChat.workspaceSelectLabel": "Workspace",
  "workspace.homeBranchLabelMain": "Primary branch",
  "workspace.homeBranchLabelWorktree": "Worktree",
  "workspace.unknownBranch": "unknown",
};

function translate(key: string, params?: string | Record<string, string>) {
  const template = translations[key] ?? key;
  if (!params || typeof params === "string") {
    return template;
  }

  return Object.entries(params).reduce(
    (acc, [paramKey, value]) => acc.replace(new RegExp(`{{${paramKey}}}`, "g"), value),
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

afterEach(() => {
  cleanup();
});

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
    { id: "ws-2", name: "idea-claude-code-gui", path: "/Users/demo/Desktop/idea-claude-code-gui", kind: "worktree" as const, worktree: { branch: "feature/idea" } },
  ],
};

describe("HomeChat interactions", () => {
  it("opens a searchable workspace menu and filters entries", () => {
    render(<HomeChat {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));

    const searchInput = screen.getByPlaceholderText("Search projects");
    expect(searchInput).toBeTruthy();
    expect(screen.getByRole("option", { name: /desktop-cc-gui/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /idea-claude-code-gui/i })).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: "idea" } });

    expect(screen.queryByRole("option", { name: /desktop-cc-gui/i })).toBeNull();
    expect(screen.getByRole("option", { name: /idea-claude-code-gui/i })).toBeTruthy();
  });

  it("selects a filtered workspace from the menu", () => {
    const onSelectWorkspace = vi.fn();

    render(<HomeChat {...baseProps} onSelectWorkspace={onSelectWorkspace} />);

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.change(screen.getByPlaceholderText("Search projects"), {
      target: { value: "idea" },
    });
    fireEvent.click(screen.getByRole("option", { name: /idea-claude-code-gui/i }));

    expect(onSelectWorkspace).toHaveBeenCalledWith("ws-2");
    expect(screen.queryByPlaceholderText("Search projects")).toBeNull();
  });

  it("shows the add project action and triggers it", () => {
    const onAddWorkspace = vi.fn();

    render(<HomeChat {...baseProps} onAddWorkspace={onAddWorkspace} />);

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.click(screen.getByRole("option", { name: "Add new project" }));

    expect(onAddWorkspace).toHaveBeenCalledTimes(1);
    expect(screen.queryByPlaceholderText("Search projects")).toBeNull();
  });

  it("shows an empty state when the workspace search has no match", () => {
    render(<HomeChat {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.change(screen.getByPlaceholderText("Search projects"), {
      target: { value: "missing" },
    });

    expect(screen.getByText("No projects found")).toBeTruthy();
  });
});
