// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCodexUnifiedExecExternalStatus,
  readGlobalCodexAuthJson,
  readGlobalCodexConfigToml,
  restoreCodexUnifiedExecOfficialDefault,
  setCodexUnifiedExecOfficialOverride,
} from "../../../services/tauri";
import { fetchSiteModels } from "../../../services/tauri/vendors";
import type { AppSettings } from "../../../types";
import { VendorSettingsPanel } from "./VendorSettingsPanel";

const mockState = vi.hoisted(() => ({
  claudeManagement: {
    currentConfig: null,
    currentConfigLoading: false,
    providers: [] as unknown[],
    loading: false,
    loadProviders: vi.fn(),
    loadCurrentConfig: vi.fn(),
    handleSwitchProvider: vi.fn(),
    handleAddProvider: vi.fn(),
    handleEditProvider: vi.fn(),
    handleDeleteProvider: vi.fn(),
    providerDialog: { isOpen: false, provider: null },
    handleCloseProviderDialog: vi.fn(),
    handleSaveProvider: vi.fn(),
    deleteConfirm: { isOpen: false, provider: null },
    confirmDeleteProvider: vi.fn(),
    cancelDeleteProvider: vi.fn(),
  },
  codexManagement: {
    codexProviderError: null,
    codexProviders: [],
    codexLoading: false,
    handleAddCodexProvider: vi.fn(),
    handleEditCodexProvider: vi.fn(),
    handleDeleteCodexProvider: vi.fn(),
    handleSwitchCodexProvider: vi.fn(),
    codexProviderDialog: { isOpen: false, provider: null },
    handleCloseCodexProviderDialog: vi.fn(),
    handleSaveCodexProvider: vi.fn(),
    deleteCodexConfirm: { isOpen: false, provider: null },
    confirmDeleteCodexProvider: vi.fn(),
    cancelDeleteCodexProvider: vi.fn(),
  },
  claudeModels: {
    models: [] as Array<{ id: string; label: string; description?: string }>,
    updateModels: vi.fn(),
  },
  codexModels: {
    models: [] as Array<{ id: string; label: string; description?: string }>,
    updateModels: vi.fn(),
  },
}));

vi.mock("../hooks/useProviderManagement", () => ({
  useProviderManagement: vi.fn(() => mockState.claudeManagement),
}));

vi.mock("../hooks/useCodexProviderManagement", () => ({
  useCodexProviderManagement: vi.fn(() => mockState.codexManagement),
}));

vi.mock("../hooks/usePluginModels", () => ({
  usePluginModels: vi.fn((key: string) => {
    if (key === "codex-custom-models") {
      return mockState.codexModels;
    }
    return mockState.claudeModels;
  }),
}));

vi.mock("../modelManagerRequest", () => ({
  consumeVendorModelManagerRequest: vi.fn(() => null),
  VENDOR_MODEL_MANAGER_REQUEST_EVENT: "vendor-model-manager-request",
}));

vi.mock("../../../services/tauri/vendors", () => ({
  fetchSiteModels: vi.fn(),
  updateClaudeProvider: vi.fn().mockResolvedValue(undefined),
  switchClaudeProvider: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./ProviderList", () => ({
  ProviderList: () => <div data-testid="provider-list-stub" />,
}));

vi.mock("./CodexProviderList", () => ({
  CodexProviderList: () => <div data-testid="codex-provider-list-stub" />,
}));

vi.mock("./ProviderDialog", () => ({
  ProviderDialog: () => null,
}));

vi.mock("./CodexProviderDialog", () => ({
  CodexProviderDialog: () => null,
}));

vi.mock("./DeleteConfirmDialog", () => ({
  DeleteConfirmDialog: () => null,
}));

vi.mock("./CustomModelDialog", () => ({
  CustomModelDialog: () => null,
}));

vi.mock("./CurrentClaudeConfigCard", () => ({
  CurrentClaudeConfigCard: () => (
    <div data-testid="current-claude-config-stub" />
  ),
}));

vi.mock("./CurrentCodexGlobalConfigCard", () => ({
  CurrentCodexGlobalConfigCard: () => (
    <div data-testid="current-codex-config-stub" />
  ),
}));

vi.mock("../../../services/tauri", async () => {
  const actual = await vi.importActual<
    typeof import("../../../services/tauri")
  >("../../../services/tauri");
  return {
    ...actual,
    readGlobalCodexConfigToml: vi.fn(),
    readGlobalCodexAuthJson: vi.fn(),
    getCodexUnifiedExecExternalStatus: vi.fn(),
    restoreCodexUnifiedExecOfficialDefault: vi.fn(),
    setCodexUnifiedExecOfficialOverride: vi.fn(),
  };
});

const readGlobalCodexConfigTomlMock = vi.mocked(readGlobalCodexConfigToml);
const readGlobalCodexAuthJsonMock = vi.mocked(readGlobalCodexAuthJson);
const getCodexUnifiedExecExternalStatusMock = vi.mocked(
  getCodexUnifiedExecExternalStatus,
);
const restoreCodexUnifiedExecOfficialDefaultMock = vi.mocked(
  restoreCodexUnifiedExecOfficialDefault,
);
const setCodexUnifiedExecOfficialOverrideMock = vi.mocked(
  setCodexUnifiedExecOfficialOverride,
);
const fetchSiteModelsMock = vi.mocked(fetchSiteModels);

function renderPanel(
  options: {
    appSettings?: Partial<AppSettings>;
    handleReloadCodexRuntimeConfig?: () => Promise<void>;
    codexReloadStatus?: "idle" | "reloading" | "applied" | "failed";
    codexReloadMessage?: string | null;
    onUpdateAppSettings?: (next: AppSettings) => Promise<void>;
  } = {},
) {
  const handleReloadCodexRuntimeConfig =
    options.handleReloadCodexRuntimeConfig ??
    vi.fn().mockResolvedValue(undefined);
  const appSettings = {
    showSidebarProviderLabels: false,
    ...options.appSettings,
  } as AppSettings;
  const onUpdateAppSettings =
    options.onUpdateAppSettings ?? vi.fn().mockResolvedValue(undefined);

  render(
    <VendorSettingsPanel
      appSettings={appSettings}
      codexReloadStatus={options.codexReloadStatus ?? "idle"}
      codexReloadMessage={options.codexReloadMessage ?? null}
      handleReloadCodexRuntimeConfig={handleReloadCodexRuntimeConfig}
      onUpdateAppSettings={onUpdateAppSettings}
    />,
  );

  return {
    handleReloadCodexRuntimeConfig,
    onUpdateAppSettings,
  };
}

async function openCodexTab() {
  fireEvent.click(screen.getByText("Codex"));
  await waitFor(() => {
    expect(getCodexUnifiedExecExternalStatusMock).toHaveBeenCalled();
  });
  return (await screen.findByText("Background terminal")).closest(
    ".vendor-codex-runtime-card",
  ) as HTMLElement;
}

beforeEach(() => {
  readGlobalCodexConfigTomlMock.mockResolvedValue({
    exists: true,
    content: "[features]\n",
    truncated: false,
  });
  readGlobalCodexAuthJsonMock.mockResolvedValue({
    exists: true,
    content: '{"access_token":"***"}',
    truncated: false,
  });
  getCodexUnifiedExecExternalStatusMock.mockResolvedValue({
    configPath: "/tmp/codex/config.toml",
    hasExplicitUnifiedExec: false,
    explicitUnifiedExecValue: null,
    officialDefaultEnabled: true,
  });
  restoreCodexUnifiedExecOfficialDefaultMock.mockResolvedValue({
    configPath: "/tmp/codex/config.toml",
    hasExplicitUnifiedExec: false,
    explicitUnifiedExecValue: null,
    officialDefaultEnabled: true,
  });
  setCodexUnifiedExecOfficialOverrideMock.mockResolvedValue({
    configPath: "/tmp/codex/config.toml",
    hasExplicitUnifiedExec: true,
    explicitUnifiedExecValue: true,
    officialDefaultEnabled: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockState.claudeManagement.providers = [];
  mockState.claudeModels.models = [];
  mockState.codexModels.models = [];
});

describe("VendorSettingsPanel", () => {
  it("does not expose the Gemini CLI vendor tab", async () => {
    renderPanel();

    await waitFor(() => {
      expect(readGlobalCodexConfigTomlMock).toHaveBeenCalled();
      expect(readGlobalCodexAuthJsonMock).toHaveBeenCalled();
    });
    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.queryByText("Gemini CLI")).toBeNull();
  });

  it("shows background terminal official actions in the Codex tab", async () => {
    renderPanel();

    const runtimeCard = await openCodexTab();
    const runtimeCardQueries = within(runtimeCard);

    expect(runtimeCardQueries.getByText("Background terminal")).toBeTruthy();
    expect(runtimeCardQueries.getByText("Official config")).toBeTruthy();
    expect(runtimeCardQueries.getByText("Enable")).toBeTruthy();
    expect(runtimeCardQueries.getByText("Disable")).toBeTruthy();
    expect(runtimeCardQueries.getByText("Follow official default")).toBeTruthy();
    expect(
      runtimeCardQueries.getByText("Official default on this platform: enabled."),
    ).toBeTruthy();
  });

  it("toggles sidebar provider labels from the Codex provider tab", async () => {
    const { onUpdateAppSettings } = renderPanel();

    await openCodexTab();

    fireEvent.click(
      screen.getByRole("switch", {
        name: "Show provider labels in session lists",
      }),
    );

    await waitFor(() => {
      expect(onUpdateAppSettings).toHaveBeenCalledWith(
        expect.objectContaining({ showSidebarProviderLabels: true }),
      );
    });
  });

  it("restores official default without extra confirm dialog", async () => {
    getCodexUnifiedExecExternalStatusMock.mockResolvedValue({
      configPath: "/tmp/codex/config.toml",
      hasExplicitUnifiedExec: true,
      explicitUnifiedExecValue: false,
      officialDefaultEnabled: true,
    });
    restoreCodexUnifiedExecOfficialDefaultMock.mockResolvedValue({
      configPath: "/tmp/codex/config.toml",
      hasExplicitUnifiedExec: false,
      explicitUnifiedExecValue: null,
      officialDefaultEnabled: true,
    });

    renderPanel();
    await openCodexTab();

    fireEvent.click(
      screen.getByRole("button", { name: "Follow official default" }),
    );

    await waitFor(() => {
      expect(restoreCodexUnifiedExecOfficialDefaultMock).toHaveBeenCalledTimes(
        1,
      );
    });
    expect(
      await screen.findByText("Restored the official unified_exec config."),
    ).toBeTruthy();
  });

  it("writes official unified_exec and reloads inherit sessions", async () => {
    const handleReloadCodexRuntimeConfig = vi.fn().mockResolvedValue(undefined);
    setCodexUnifiedExecOfficialOverrideMock.mockResolvedValue({
      configPath: "/tmp/codex/config.toml",
      hasExplicitUnifiedExec: true,
      explicitUnifiedExecValue: true,
      officialDefaultEnabled: true,
    });

    renderPanel({ handleReloadCodexRuntimeConfig });
    await openCodexTab();

    fireEvent.click(screen.getByRole("button", { name: "Enable" }));

    await waitFor(() => {
      expect(setCodexUnifiedExecOfficialOverrideMock).toHaveBeenCalledWith(
        true,
      );
      expect(handleReloadCodexRuntimeConfig).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText("Wrote official unified_exec = enabled."),
    ).toBeTruthy();
  });

  it("shows the no-session reload message without an applied prefix", async () => {
    renderPanel({
      codexReloadStatus: "applied",
      codexReloadMessage:
        "No Codex session is currently connected. The config has been updated and will apply on the next connection.",
    });

    await openCodexTab();

    expect(
      screen.getByText(
        "No Codex session is currently connected. The config has been updated and will apply on the next connection.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Codex runtime config applied:/)).toBeNull();
  });

  it("refreshes Codex config content and unified_exec status after reload", async () => {
    const { handleReloadCodexRuntimeConfig } = renderPanel();

    await openCodexTab();

    const initialConfigReads = readGlobalCodexConfigTomlMock.mock.calls.length;
    const initialAuthReads = readGlobalCodexAuthJsonMock.mock.calls.length;
    const initialStatusReads =
      getCodexUnifiedExecExternalStatusMock.mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", { name: "settings.codexRuntimeReload" }),
    );

    await waitFor(() => {
      expect(handleReloadCodexRuntimeConfig).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(readGlobalCodexConfigTomlMock.mock.calls.length).toBeGreaterThan(
        initialConfigReads,
      );
      expect(readGlobalCodexAuthJsonMock.mock.calls.length).toBeGreaterThan(
        initialAuthReads,
      );
      expect(
        getCodexUnifiedExecExternalStatusMock.mock.calls.length,
      ).toBeGreaterThan(initialStatusReads);
    });
  });

  it("syncs picker selections into the Claude managed list, not codex", async () => {
    mockState.claudeManagement.providers = [
      {
        id: "p1",
        name: "P1",
        isActive: true,
        settingsConfig: {
          env: {
            ANTHROPIC_AUTH_TOKEN: "tok",
            ANTHROPIC_BASE_URL: "http://example.test",
          },
        },
      },
    ];
    mockState.claudeModels.models = [{ id: "existing", label: "Existing" }];
    fetchSiteModelsMock.mockResolvedValue([
      { id: "existing", owned_by: "" },
      { id: "fresh", owned_by: "" },
    ]);

    renderPanel();

    fireEvent.click(
      screen.getByRole("button", { name: /Sync Models from Site/ }),
    );

    const existingCheckbox = (await screen.findByRole("checkbox", {
      name: /existing/,
    })) as HTMLInputElement;
    expect(existingCheckbox.checked).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: /fresh/ }));

    fireEvent.change(screen.getByRole("combobox", { name: "haiku" }), {
      target: { value: "fresh" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "sonnet" }), {
      target: { value: "fresh" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "opus" }), {
      target: { value: "fresh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(mockState.claudeModels.updateModels).toHaveBeenCalledWith([
        { id: "existing", label: "Existing" },
        { id: "fresh", label: "fresh" },
      ]);
    });
    expect(mockState.codexModels.updateModels).not.toHaveBeenCalled();
  });

  it("prefills site model picker slots from the active provider mapping", async () => {
    mockState.claudeManagement.providers = [
      {
        id: "p1",
        name: "P1",
        isActive: true,
        settingsConfig: {
          env: {
            ANTHROPIC_AUTH_TOKEN: "tok",
            ANTHROPIC_BASE_URL: "http://example.test",
            ANTHROPIC_DEFAULT_HAIKU_MODEL: "custom-haiku",
            ANTHROPIC_DEFAULT_SONNET_MODEL: "custom-sonnet",
            ANTHROPIC_DEFAULT_OPUS_MODEL: "custom-opus",
          },
        },
      },
    ];
    fetchSiteModelsMock.mockResolvedValue([
      { id: "auto-flash", owned_by: "" },
      { id: "auto-pro", owned_by: "" },
      { id: "auto-max", owned_by: "" },
      { id: "custom-haiku", owned_by: "" },
      { id: "custom-sonnet", owned_by: "" },
      { id: "custom-opus", owned_by: "" },
    ]);

    renderPanel();

    fireEvent.click(
      screen.getByRole("button", { name: /Sync Models from Site/ }),
    );

    await screen.findByRole("checkbox", { name: /custom-haiku/ });

    expect(
      (screen.getByRole("combobox", { name: "haiku" }) as HTMLSelectElement)
        .value,
    ).toBe("custom-haiku");
    expect(
      (screen.getByRole("combobox", { name: "sonnet" }) as HTMLSelectElement)
        .value,
    ).toBe("custom-sonnet");
    expect(
      (screen.getByRole("combobox", { name: "opus" }) as HTMLSelectElement)
        .value,
    ).toBe("custom-opus");
  });

  it("offers an API key configuration entry when site sync has no active provider key", async () => {
    const activeProvider = {
      id: "p1",
      name: "No Key",
      isActive: true,
      settingsConfig: {
        env: {
          ANTHROPIC_BASE_URL: "http://example.test",
        },
      },
    };
    mockState.claudeManagement.providers = [activeProvider];

    renderPanel();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Sync Models from Site/ }),
      );
    });

    expect(fetchSiteModelsMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("No active provider with API key configured."),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Configure API key" }));
    });

    expect(mockState.claudeManagement.handleEditProvider).toHaveBeenCalledWith(
      activeProvider,
    );
    expect(mockState.claudeManagement.handleAddProvider).not.toHaveBeenCalled();
  });

  it("marks synced Qwen VL models and stores the preferred vision model", async () => {
    mockState.claudeManagement.providers = [
      {
        id: "p1",
        name: "P1",
        isActive: true,
        settingsConfig: {
          env: {
            ANTHROPIC_AUTH_TOKEN: "tok",
            ANTHROPIC_BASE_URL: "http://example.test",
          },
        },
      },
    ];
    fetchSiteModelsMock.mockResolvedValue([
      { id: "deepseek-v4-pro", owned_by: "" },
      { id: "qwen3-vl-plus", owned_by: "" },
      { id: "qwen3-vl-flash", owned_by: "" },
    ]);
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);

    renderPanel({
      appSettings: { visionModelId: "deepseek-v4-pro" },
      onUpdateAppSettings,
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Sync Models from Site/ }),
    );

    fireEvent.click(await screen.findByRole("checkbox", { name: /qwen3-vl-plus/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /qwen3-vl-flash/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "haiku" }), {
      target: { value: "qwen3-vl-flash" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "sonnet" }), {
      target: { value: "qwen3-vl-flash" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "opus" }), {
      target: { value: "qwen3-vl-plus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(mockState.claudeModels.updateModels).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: "qwen3-vl-flash",
            capabilities: { imageInput: true },
          }),
          expect.objectContaining({
            id: "qwen3-vl-plus",
            capabilities: { imageInput: true },
          }),
        ]),
      );
    });
    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({ visionModelId: "qwen3-vl-flash" }),
    );
  });
});
