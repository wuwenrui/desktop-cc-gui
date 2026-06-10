// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import type { OpenCodeStatusSnapshot } from "../../opencode/types";
import { McpSection } from "./McpSection";

type SelectMockContextValue = {
  value: string | undefined;
  open: boolean;
  setOpen: (open: boolean) => void;
  onValueChange: ((value: string) => void) | undefined;
};

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const SelectContext = React.createContext<SelectMockContextValue | null>(null);

  const useSelectContext = () => {
    const context = React.useContext(SelectContext);
    if (!context) {
      throw new Error("Select mock components must be rendered inside Select");
    }
    return context;
  };

  function Select({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) {
    const [open, setOpen] = React.useState(false);

    return (
      <SelectContext.Provider value={{ value, open, setOpen, onValueChange }}>
        {children}
      </SelectContext.Provider>
    );
  }

  function SelectTrigger({
    children,
    onClick,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) {
    const context = useSelectContext();

    return (
      <button
        aria-expanded={context.open}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            context.setOpen(!context.open);
          }
        }}
        role="combobox"
        type="button"
        {...props}
      >
        {children}
      </button>
    );
  }

  function SelectValue() {
    const context = useSelectContext();
    return <span>{context.value}</span>;
  }

  function SelectContent({
    children,
    ...props
  }: HTMLAttributes<HTMLDivElement>) {
    const context = useSelectContext();
    if (!context.open) {
      return null;
    }

    return (
      <div role="listbox" {...props}>
        {children}
      </div>
    );
  }

  function SelectItem({
    value,
    children,
    onClick,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { value: string }) {
    const context = useSelectContext();

    return (
      <div
        aria-selected={context.value === value}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            context.onValueChange?.(value);
            context.setOpen(false);
          }
        }}
        role="option"
        {...props}
      >
        {children}
      </div>
    );
  }

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

vi.mock("../../../services/tauri", () => ({
  detectEngines: vi.fn(),
  getOpenCodeStatusSnapshot: vi.fn(),
  listGlobalMcpServers: vi.fn(),
  listMcpServerStatus: vi.fn(),
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: vi.fn(),
}));

import {
  detectEngines,
  getOpenCodeStatusSnapshot,
  listGlobalMcpServers,
  listMcpServerStatus,
} from "../../../services/tauri";
import { isWindowsPlatform } from "../../../utils/platform";

const workspace: WorkspaceInfo = {
  id: "ws-mcp",
  name: "Workspace MCP",
  path: "/tmp/ws-mcp",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("McpSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(isWindowsPlatform).mockReturnValue(false);
    vi.mocked(detectEngines).mockResolvedValue([
      {
        engineType: "claude",
        installed: true,
        version: "1.2.0",
        binPath: "/usr/local/bin/claude",
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: true,
          sessionContinuation: true,
        },
        models: [],
        error: null,
      },
      {
        engineType: "codex",
        installed: true,
        version: "2.0.0",
        binPath: "/usr/local/bin/codex",
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: true,
          sessionContinuation: true,
        },
        models: [],
        error: null,
      },
      {
        engineType: "gemini",
        installed: false,
        version: null,
        binPath: null,
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: false,
          sessionContinuation: true,
        },
        models: [],
        error: "not installed",
      },
      {
        engineType: "opencode",
        installed: true,
        version: "0.9.0",
        binPath: "/usr/local/bin/opencode",
        features: {
          streaming: true,
          reasoning: true,
          toolUse: true,
          imageInput: false,
          sessionContinuation: true,
        },
        models: [],
        error: null,
      },
    ]);
    vi.mocked(listGlobalMcpServers).mockResolvedValue([
      {
        name: "filesystem",
        enabled: true,
        transport: "stdio",
        command: "npx",
        url: null,
        argsCount: 2,
        source: "claude_json",
      },
      {
        name: "github",
        enabled: true,
        transport: "stdio",
        command: "uvx",
        url: null,
        argsCount: 3,
        source: "ccgui_config",
      },
    ]);
    vi.mocked(listMcpServerStatus).mockResolvedValue({
      result: {
        data: [
          {
            name: "github",
            authStatus: { status: "connected" },
            tools: {
              mcp__github__search_repos: {},
            },
            resources: [],
            resourceTemplates: [],
          },
        ],
      },
    });
    const openCodeSnapshot: OpenCodeStatusSnapshot = {
      providerHealth: {
        provider: "openrouter",
        connected: true,
        credentialCount: 1,
        matched: true,
        authenticatedProviders: ["openrouter"],
        error: null,
      },
      mcpEnabled: true,
      mcpServers: [
        {
          name: "browser",
          enabled: true,
          status: "ok",
          permissionHint: "network",
        },
      ],
      mcpRaw: "{\"browser\":true}",
      managedToggles: true,
      provider: "openrouter",
      sessionId: "session-1",
      model: "gpt-5",
      agent: "default",
      variant: "balanced",
      tokenUsage: 123,
      contextWindow: 200000,
    };
    vi.mocked(getOpenCodeStatusSnapshot).mockResolvedValue(openCodeSnapshot);
  });

  it("renders engine-specific rules and opens the engine select menu", async () => {
    const { unmount } = render(
      <McpSection activeWorkspace={workspace} activeEngine="codex" />,
    );

    await screen.findByText("By engine");
    await screen.findByText("search_repos");

    expect(screen.getByText("Detailed status and rules")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Select engine to inspect" })).toBeTruthy();
    expect(screen.getAllByText("Runtime rules").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Config-defined servers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("github").length).toBeGreaterThan(0);
    expect(screen.getByText("search_repos")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();

    fireEvent.click(screen.getByRole("combobox", { name: "Select engine to inspect" }));
    expect(await screen.findByRole("option", { name: "OpenCode" })).toBeTruthy();

    unmount();
  });

  it("keeps overview inventory aligned with the selected engine after switching", async () => {
    vi.mocked(getOpenCodeStatusSnapshot).mockResolvedValue({
      providerHealth: {
        provider: "openrouter",
        connected: true,
        credentialCount: 1,
        matched: true,
        authenticatedProviders: ["openrouter"],
        error: null,
      },
      mcpEnabled: true,
      mcpServers: [
        {
          name: "browser",
          enabled: true,
          status: "ok",
          permissionHint: "network",
        },
        {
          name: "docs",
          enabled: true,
          status: "ok",
          permissionHint: null,
        },
      ],
      mcpRaw: "{\"browser\":true,\"docs\":true}",
      managedToggles: true,
      provider: "openrouter",
      sessionId: "session-1",
      model: "gpt-5",
      agent: "default",
      variant: "balanced",
      tokenUsage: 123,
      contextWindow: 200000,
    });

    const { rerender } = render(
      <McpSection activeWorkspace={workspace} activeEngine="codex" />,
    );

    await screen.findByText("search_repos");

    const selectedOverviewCard = screen
      .getByText("Selected engine")
      .closest(".settings-mcp-overview-card");
    expect(selectedOverviewCard).toBeTruthy();
    expect(within(selectedOverviewCard as HTMLElement).getByText("Codex")).toBeTruthy();
    expect(screen.getAllByText("1 servers · 1 tools").length).toBeGreaterThan(0);

    rerender(<McpSection activeWorkspace={workspace} activeEngine="opencode" />);

    await waitFor(() => {
      expect(screen.getByText("Session overview")).toBeTruthy();
    });

    expect(screen.getAllByText("2 servers · 0 tools").length).toBeGreaterThan(0);
    const switchedOverviewCard = screen
      .getByText("Selected engine")
      .closest(".settings-mcp-overview-card");
    expect(switchedOverviewCard).toBeTruthy();
    expect(within(switchedOverviewCard as HTMLElement).getByText("OpenCode")).toBeTruthy();
    expect(screen.getByText("browser")).toBeTruthy();
    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.queryByText("search_repos")).toBeNull();
  });

  it("shows bridge-backed config servers for Gemini and strips runtime tool prefixes case-insensitively", async () => {
    vi.mocked(listMcpServerStatus).mockResolvedValue({
      result: {
        data: [
          {
            name: "GitHub",
            authStatus: { status: "connected" },
            tools: {
              mcp__github__search_repos: {},
            },
            resources: [],
            resourceTemplates: [],
          },
        ],
      },
    });

    const { rerender } = render(
      <McpSection activeWorkspace={workspace} activeEngine="codex" />,
    );

    await screen.findByText("search_repos");
    expect(screen.queryByText("mcp__github__search_repos")).toBeNull();

    rerender(<McpSection activeWorkspace={workspace} activeEngine="gemini" />);

    await waitFor(() => {
      expect(screen.queryByText("Loading…")).toBeNull();
    });

    const geminiOverviewCard = screen
      .getByText("Selected engine")
      .closest(".settings-mcp-overview-card");
    expect(geminiOverviewCard).toBeTruthy();
    expect(within(geminiOverviewCard as HTMLElement).getByText("Gemini")).toBeTruthy();
    expect(screen.getAllByText("1 servers · 0 tools").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Config-defined servers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("github").length).toBeGreaterThan(0);
  });

  it("shows Windows-style config paths when backend paths are Windows-style", async () => {
    vi.mocked(isWindowsPlatform).mockReturnValue(false);

    render(
      <McpSection
        activeWorkspace={{ ...workspace, path: "C:\\workspace\\ws-mcp" }}
        activeEngine="codex"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Loading…")).toBeNull();
    });

    expect(
      screen.getAllByText("%USERPROFILE%\\.ccgui\\config.json · %USERPROFILE%\\.codex\\config.toml").length,
    ).toBeGreaterThan(0);
  });
});
