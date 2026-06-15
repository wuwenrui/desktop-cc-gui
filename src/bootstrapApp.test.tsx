// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const createRootMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const preloadClientStoresMock = vi.hoisted(() => vi.fn());
const migrateLocalStorageToFileStoreMock = vi.hoisted(() => vi.fn());
const initInputHistoryStoreMock = vi.hoisted(() => vi.fn());
const appendRendererDiagnosticMock = vi.hoisted(() => vi.fn());
const flushRendererDiagnosticsBufferMock = vi.hoisted(() => vi.fn());
const startRendererBlankScreenWatchdogMock = vi.hoisted(() => vi.fn());
const pushGlobalRuntimeNoticeMock = vi.hoisted(() => vi.fn());
const recordStartupMilestoneMock = vi.hoisted(() => vi.fn());
const recordStartupTaskTraceMock = vi.hoisted(() => vi.fn());
const recordStartupPerfMarkerMock = vi.hoisted(() => vi.fn());
const invokeMock = vi.hoisted(() => vi.fn());
const isTauriMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("react-dom/client", () => ({
  default: {
    createRoot: createRootMock,
  },
}));

vi.mock("./services/clientStorage", () => ({
  preloadClientStores: preloadClientStoresMock,
}));

vi.mock("./services/migrateLocalStorage", () => ({
  migrateLocalStorageToFileStore: migrateLocalStorageToFileStoreMock,
}));

vi.mock("./features/composer/hooks/useInputHistoryStore", () => ({
  initInputHistoryStore: initInputHistoryStoreMock,
}));

vi.mock("./services/rendererDiagnostics", () => ({
  appendRendererDiagnostic: appendRendererDiagnosticMock,
  flushRendererDiagnosticsBuffer: flushRendererDiagnosticsBufferMock,
  startRendererBlankScreenWatchdog: startRendererBlankScreenWatchdogMock,
}));

vi.mock("./services/globalRuntimeNotices", () => ({
  pushGlobalRuntimeNotice: pushGlobalRuntimeNoticeMock,
}));

vi.mock("./features/startup-orchestration/utils/startupTrace", () => ({
  recordStartupMilestone: recordStartupMilestoneMock,
  recordStartupTaskTrace: recordStartupTaskTraceMock,
}));

vi.mock("./services/perfBaseline/startupMarkers", () => ({
  recordStartupPerfMarker: recordStartupPerfMarkerMock,
}));

vi.mock("./i18n", () => ({
  i18nReady: Promise.resolve(),
}));

vi.mock("./App", () => ({
  default: () => null,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

vi.mock("./components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: unknown }) => children,
}));

describe("startApp", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
    createRootMock.mockReset();
    renderMock.mockReset();
    preloadClientStoresMock.mockReset();
    migrateLocalStorageToFileStoreMock.mockReset();
    initInputHistoryStoreMock.mockReset();
    appendRendererDiagnosticMock.mockReset();
    flushRendererDiagnosticsBufferMock.mockReset();
    startRendererBlankScreenWatchdogMock.mockReset();
    pushGlobalRuntimeNoticeMock.mockReset();
    recordStartupMilestoneMock.mockReset();
    recordStartupTaskTraceMock.mockReset();
    recordStartupPerfMarkerMock.mockReset();
    invokeMock.mockReset();
    isTauriMock.mockReset();
    isTauriMock.mockReturnValue(false);
    createRootMock.mockReturnValue({ render: renderMock });
  });

  it("pushes detailed bootstrap notices during a successful startup", async () => {
    const { startApp } = await import("./bootstrapApp");

    await startApp();

    expect(pushGlobalRuntimeNoticeMock.mock.calls.map(([notice]) => notice.messageKey)).toEqual([
      "runtimeNotice.bootstrap.start",
      "runtimeNotice.bootstrap.interfaceResources",
      "runtimeNotice.bootstrap.mountShell",
      "runtimeNotice.bootstrap.ready",
      "runtimeNotice.bootstrap.storageMigrationCheck",
      "runtimeNotice.bootstrap.inputHistoryRestore",
    ]);
    expect(preloadClientStoresMock).toHaveBeenCalledTimes(1);
    expect(migrateLocalStorageToFileStoreMock).toHaveBeenCalledTimes(1);
    expect(initInputHistoryStoreMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById("root"));
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(startRendererBlankScreenWatchdogMock).toHaveBeenCalledWith({ rootId: "root" });
    expect(recordStartupMilestoneMock).toHaveBeenCalledWith("shell-ready");
    expect(recordStartupPerfMarkerMock).toHaveBeenCalledWith("first-paint");
    expect(recordStartupTaskTraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "bootstrap:app-import",
        lifecycleState: "started",
      }),
    );
  });

  it("renders the bootstrap fallback and flushes diagnostics when preload fails early", async () => {
    const preloadError = new Error("preload failed");
    preloadClientStoresMock.mockRejectedValue(preloadError);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { startApp } = await import("./bootstrapApp");

    await startApp();

    expect(appendRendererDiagnosticMock).toHaveBeenNthCalledWith(1, "bootstrap/start");
    expect(appendRendererDiagnosticMock).toHaveBeenNthCalledWith(2, "bootstrap/failed", {
      error: "Error: preload failed",
    });
    expect(pushGlobalRuntimeNoticeMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        messageKey: "runtimeNotice.bootstrap.start",
      }),
    );
    expect(pushGlobalRuntimeNoticeMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messageKey: "runtimeNotice.bootstrap.failed",
      }),
    );
    expect(flushRendererDiagnosticsBufferMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById("root"));
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith("[bootstrap] Startup failed:", preloadError);

    consoleErrorSpy.mockRestore();
  });
});
