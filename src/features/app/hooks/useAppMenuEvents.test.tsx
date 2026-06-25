// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { EventCallback } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import type { MutableRefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppMenuEvents } from "./useAppMenuEvents";

function ref<T>(current: T): MutableRefObject<T> {
  return { current };
}

function makeParams(overrides: Record<string, unknown> = {}) {
  const workspace = {
    id: "ws-1",
    name: "Workspace",
    path: "/tmp/ws-1",
    connected: true,
    settings: { sidebarCollapsed: false },
  };

  return {
    activeWorkspaceRef: ref(workspace),
    baseWorkspaceRef: ref(workspace),
    onAddWorkspace: vi.fn(),
    onNewWindow: vi.fn(),
    onAddAgent: vi.fn(),
    onAddWorktreeAgent: vi.fn(),
    onAddCloneAgent: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenWeChatBridgeSettings: vi.fn(),
    onStartWeChatBridge: vi.fn(),
    onCycleAgent: vi.fn(),
    onCycleWorkspace: vi.fn(),
    onToggleDebug: vi.fn(),
    onToggleTerminal: vi.fn(),
    onToggleGlobalSearch: vi.fn(),
    sidebarCollapsed: false,
    rightPanelCollapsed: false,
    rightPanelAvailable: true,
    onExpandSidebar: vi.fn(),
    onCollapseSidebar: vi.fn(),
    onExpandRightPanel: vi.fn(),
    onCollapseRightPanel: vi.fn(),
    ...overrides,
  };
}

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

describe("useAppMenuEvents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("opens the WeChat connection settings panel from the app menu", async () => {
    const listeners = new Map<string, EventCallback<unknown>>();
    const unlisten = vi.fn();
    vi.mocked(listen).mockImplementation((event, handler) => {
      listeners.set(String(event), handler as EventCallback<unknown>);
      return Promise.resolve(unlisten);
    });
    const onOpenWeChatBridgeSettings = vi.fn();

    renderHook(() =>
      useAppMenuEvents(makeParams({ onOpenWeChatBridgeSettings }) as any),
    );

    await waitFor(() => {
      expect(listeners.has("menu-open-wechat-bridge-settings")).toBe(true);
    });

    act(() => {
      listeners.get("menu-open-wechat-bridge-settings")?.({
        event: "menu-open-wechat-bridge-settings",
        id: 1,
        payload: undefined,
      });
    });

    expect(onOpenWeChatBridgeSettings).toHaveBeenCalledTimes(1);
  });

  it("starts the WeChat connection from the app menu", async () => {
    const listeners = new Map<string, EventCallback<unknown>>();
    const unlisten = vi.fn();
    vi.mocked(listen).mockImplementation((event, handler) => {
      listeners.set(String(event), handler as EventCallback<unknown>);
      return Promise.resolve(unlisten);
    });
    const onStartWeChatBridge = vi.fn();

    renderHook(() =>
      useAppMenuEvents(makeParams({ onStartWeChatBridge }) as any),
    );

    await waitFor(() => {
      expect(listeners.has("menu-start-wechat-bridge")).toBe(true);
    });

    act(() => {
      listeners.get("menu-start-wechat-bridge")?.({
        event: "menu-start-wechat-bridge",
        id: 1,
        payload: undefined,
      });
    });

    expect(onStartWeChatBridge).toHaveBeenCalledTimes(1);
  });
});
