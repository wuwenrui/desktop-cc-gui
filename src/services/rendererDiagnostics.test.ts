import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientStorageMocks = vi.hoisted(() => ({
  getClientStoreSync: vi.fn(),
  isPreloaded: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));

vi.mock("./clientStorage", () => clientStorageMocks);

const EARLY_RENDERER_DIAGNOSTICS_STORAGE_KEY = "ccgui.bootstrapRendererDiagnostics";
const testLocalStorage = globalThis.localStorage;

describe("rendererDiagnostics", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    vi.unstubAllGlobals();
    if (typeof document !== "undefined") {
      document.body.innerHTML = "";
    }
    testLocalStorage.clear();
    clientStorageMocks.getClientStoreSync.mockReset();
    clientStorageMocks.isPreloaded.mockReset();
    clientStorageMocks.writeClientStoreValue.mockReset();
  });

  afterEach(async () => {
    const diagnostics = await import("./rendererDiagnostics");
    diagnostics.stopRendererBlankScreenWatchdog();
    diagnostics.stopRendererHeartbeat();
    vi.useRealTimers();
  });

  it("buffers diagnostics until client stores are preloaded", async () => {
    clientStorageMocks.isPreloaded.mockReturnValue(false);
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.appendRendererDiagnostic("window/focus", { hasFocus: true });
    expect(clientStorageMocks.writeClientStoreValue).not.toHaveBeenCalled();

    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue([]);

    diagnostics.flushRendererDiagnosticsBuffer();

    expect(clientStorageMocks.writeClientStoreValue).toHaveBeenCalledWith(
      "app",
      "diagnostics.rendererLifecycleLog",
      [
        expect.objectContaining({
          label: "window/focus",
          payload: { hasFocus: true },
        }),
      ],
      { immediate: true },
    );
  });

  it("persists buffered diagnostics to localStorage before preload completes", async () => {
    clientStorageMocks.isPreloaded.mockReturnValue(false);
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.appendRendererDiagnostic("bootstrap/start");
    diagnostics.flushRendererDiagnosticsBuffer();

    expect(clientStorageMocks.writeClientStoreValue).not.toHaveBeenCalled();
    expect(JSON.parse(testLocalStorage.getItem(EARLY_RENDERER_DIAGNOSTICS_STORAGE_KEY) ?? "[]")).toEqual([
      expect.objectContaining({
        label: "bootstrap/start",
      }),
    ]);
  });

  it("merges early persisted diagnostics into the client store after preload", async () => {
    testLocalStorage.setItem(
      EARLY_RENDERER_DIAGNOSTICS_STORAGE_KEY,
      JSON.stringify([
        {
          timestamp: 1,
          label: "bootstrap/failed",
          payload: { error: "Error: preload failed" },
        },
      ]),
    );
    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue([]);
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.flushRendererDiagnosticsBuffer();

    expect(clientStorageMocks.writeClientStoreValue).toHaveBeenCalledWith(
      "app",
      "diagnostics.rendererLifecycleLog",
      [
        expect.objectContaining({
          label: "bootstrap/failed",
          payload: { error: "Error: preload failed" },
        }),
      ],
      { immediate: true },
    );
    expect(testLocalStorage.getItem(EARLY_RENDERER_DIAGNOSTICS_STORAGE_KEY)).toBeNull();
  });

  it("trims persisted diagnostics to the newest 200 entries", async () => {
    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue(
      Array.from({ length: 200 }, (_, index) => ({
        timestamp: index,
        label: `old-${index}`,
        payload: { index },
      })),
    );
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.appendRendererDiagnostic("window/pageshow", { persisted: false });

    const [, , persistedEntries] = clientStorageMocks.writeClientStoreValue.mock.calls[0] ?? [];
    expect(Array.isArray(persistedEntries)).toBe(true);
    expect(persistedEntries).toHaveLength(200);
    expect(persistedEntries[0]).toMatchObject({ label: "old-1" });
    expect(persistedEntries[199]).toMatchObject({ label: "window/pageshow" });
  });

  it("keeps perf diagnostics in an independent 1000-entry bucket", async () => {
    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue([
      ...Array.from({ length: 200 }, (_, index) => ({
        timestamp: index,
        label: `old-${index}`,
        payload: { index },
      })),
      ...Array.from({ length: 1000 }, (_, index) => ({
        timestamp: 1_000 + index,
        label: "perf.web-vital",
        payload: { index },
      })),
    ]);
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.appendRendererPerfDiagnostic("perf.web-vital", { index: 1000 });

    const [, , persistedValue] = clientStorageMocks.writeClientStoreValue.mock.calls[0] ?? [];
    expect(Array.isArray(persistedValue)).toBe(true);
    const persistedEntries = persistedValue as Array<{ label: string; payload: { index?: number } }>;
    expect(persistedEntries).toHaveLength(1200);
    expect(persistedEntries.filter((entry) => entry.label.startsWith("perf."))).toHaveLength(1000);
    expect(persistedEntries.filter((entry) => !entry.label.startsWith("perf."))).toHaveLength(200);
    expect(persistedEntries.some((entry) => entry.payload.index === 0 && entry.label === "perf.web-vital")).toBe(false);
    expect(persistedEntries.some((entry) => entry.payload.index === 1000 && entry.label === "perf.web-vital")).toBe(true);
  });

  it("records content-safe client interaction performance diagnostics", async () => {
    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue([]);
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.appendClientInteractionPerfDiagnostic({
      area: "typing",
      evidenceKind: "proxy",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      engine: "codex",
      turnId: "turn-1",
      inputEventCount: 50,
      renderCount: 3,
      commitDurationMs: 12.5,
      longTaskCount: 0,
      requestCount: 1,
      foregroundLatencyMs: 16,
      hydrationLatencyMs: 44,
      notes: "prompt text and assistant text must not be included",
      // @ts-expect-error content-bearing fields are intentionally rejected.
      promptText: "secret prompt body",
      assistantText: "secret assistant body",
      toolOutput: "secret tool output",
    });

    const [, , persistedValue] =
      clientStorageMocks.writeClientStoreValue.mock.calls[0] ?? [];
    expect(Array.isArray(persistedValue)).toBe(true);
    const [entry] = persistedValue as Array<{
      label: string;
      payload: Record<string, unknown>;
    }>;
    expect(entry.label).toBe("perf.client-interaction");
    expect(entry.payload).toMatchObject({
      area: "typing",
      evidenceKind: "proxy",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      engine: "codex",
      turnId: "turn-1",
      inputEventCount: 50,
      renderCount: 3,
      commitDurationMs: 12.5,
      longTaskCount: 0,
      requestCount: 1,
      foregroundLatencyMs: 16,
      hydrationLatencyMs: 44,
    });
    expect(entry.payload).not.toHaveProperty("promptText");
    expect(entry.payload).not.toHaveProperty("assistantText");
    expect(entry.payload).not.toHaveProperty("toolOutput");
  });

  it("falls back to an empty diagnostics list when persisted cache is malformed", async () => {
    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue({ broken: true });
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.appendRendererDiagnostic("bootstrap/start");

    expect(clientStorageMocks.writeClientStoreValue).toHaveBeenCalledWith(
      "app",
      "diagnostics.rendererLifecycleLog",
      [
        expect.objectContaining({
          label: "bootstrap/start",
        }),
      ],
      { immediate: true },
    );
  });

  it("ignores malformed entries inside persisted diagnostic arrays", async () => {
    testLocalStorage.setItem(
      EARLY_RENDERER_DIAGNOSTICS_STORAGE_KEY,
      JSON.stringify([
        { timestamp: 1, label: "bootstrap/valid", payload: { ok: true } },
        { timestamp: 2, label: null, payload: { broken: true } },
        { timestamp: "3", label: "bootstrap/broken", payload: { broken: true } },
      ]),
    );
    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue([
      { timestamp: 4, label: "stored/valid", payload: { ok: true } },
      { timestamp: 5, label: { broken: true }, payload: { broken: true } },
    ]);
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.flushRendererDiagnosticsBuffer();

    const [, , persistedEntries] = clientStorageMocks.writeClientStoreValue.mock.calls[0] ?? [];
    expect(persistedEntries).toEqual([
      expect.objectContaining({ label: "bootstrap/valid" }),
      expect.objectContaining({ label: "stored/valid" }),
    ]);
  });

  it("installs lifecycle listeners only once", async () => {
    clientStorageMocks.isPreloaded.mockReturnValue(false);
    const windowMock = {
      addEventListener: vi.fn(),
      location: { href: "https://example.test/renderer" },
    };
    const documentMock = {
      addEventListener: vi.fn(),
      visibilityState: "visible",
      readyState: "complete",
      hidden: false,
      hasFocus: () => true,
    };
    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("document", documentMock);
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.installRendererLifecycleDiagnostics();
    const windowListenerCallsAfterFirstInstall = windowMock.addEventListener.mock.calls.length;
    const documentListenerCallsAfterFirstInstall = documentMock.addEventListener.mock.calls.length;

    diagnostics.installRendererLifecycleDiagnostics();

    expect(windowListenerCallsAfterFirstInstall).toBeGreaterThan(0);
    expect(documentListenerCallsAfterFirstInstall).toBeGreaterThan(0);
    expect(windowMock.addEventListener).toHaveBeenCalledTimes(windowListenerCallsAfterFirstInstall);
    expect(documentMock.addEventListener).toHaveBeenCalledTimes(documentListenerCallsAfterFirstInstall);
  });

  it("records a blank-screen suspicion after repeated empty root samples", async () => {
    class TestHTMLElement {
      childElementCount = 0;
      textContent = "";
      tagName = "DIV";

      constructor(
        private readonly rect: { width: number; height: number },
      ) {}

      getBoundingClientRect() {
        return this.rect;
      }
    }
    const rootElement = new TestHTMLElement({ width: 800, height: 600 });
    const bodyElement = new TestHTMLElement({ width: 800, height: 600 });
    vi.stubGlobal("HTMLElement", TestHTMLElement);
    vi.stubGlobal("document", {
      body: bodyElement,
      activeElement: bodyElement,
      visibilityState: "visible",
      readyState: "complete",
      hasFocus: () => true,
      getElementById: (id: string) => (id === "root" ? rootElement : null),
    });
    vi.stubGlobal("window", {
      clearInterval: globalThis.clearInterval,
      location: { href: "tauri://localhost" },
      setInterval: globalThis.setInterval,
      getComputedStyle: () => ({
        display: "block",
        opacity: "1",
        visibility: "visible",
      }),
    });
    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue([]);
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.startRendererBlankScreenWatchdog({
      rootId: "root",
      intervalMs: 250,
      minConsecutiveSamples: 2,
      maxReports: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 550));

    expect(clientStorageMocks.writeClientStoreValue).toHaveBeenCalledWith(
      "app",
      "diagnostics.rendererLifecycleLog",
      [
        expect.objectContaining({
          label: "renderer/blank-screen-suspected",
          payload: expect.objectContaining({
            rootId: "root",
            consecutiveSamples: 2,
            root: expect.objectContaining({
              exists: true,
              childElementCount: 0,
              textLength: 0,
            }),
          }),
        }),
      ],
      { immediate: true },
    );
  });

  it("does not report a blank screen when the root has visible content", async () => {
    class TestHTMLElement {
      tagName = "DIV";

      constructor(
        readonly childElementCount: number,
        readonly textContent: string,
        private readonly rect: { width: number; height: number },
      ) {}

      getBoundingClientRect() {
        return this.rect;
      }
    }
    const rootElement = new TestHTMLElement(1, "ready", { width: 800, height: 600 });
    const bodyElement = new TestHTMLElement(1, "ready", { width: 800, height: 600 });
    vi.stubGlobal("HTMLElement", TestHTMLElement);
    vi.stubGlobal("document", {
      body: bodyElement,
      activeElement: bodyElement,
      visibilityState: "visible",
      readyState: "complete",
      hasFocus: () => true,
      getElementById: (id: string) => (id === "root" ? rootElement : null),
    });
    vi.stubGlobal("window", {
      clearInterval: globalThis.clearInterval,
      location: { href: "tauri://localhost" },
      setInterval: globalThis.setInterval,
      getComputedStyle: () => ({
        display: "block",
        opacity: "1",
        visibility: "visible",
      }),
    });
    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue([]);
    const diagnostics = await import("./rendererDiagnostics");

    diagnostics.startRendererBlankScreenWatchdog({
      rootId: "root",
      intervalMs: 250,
      minConsecutiveSamples: 2,
      maxReports: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 550));

    expect(clientStorageMocks.writeClientStoreValue).not.toHaveBeenCalled();
  });

  it("builds privacy-safe renderer heartbeat payload without conversation content fields", async () => {
    vi.stubGlobal("navigator", {
      platform: "MacIntel",
    });
    vi.stubGlobal("document", {
      visibilityState: "visible",
      readyState: "complete",
    });
    clientStorageMocks.isPreloaded.mockReturnValue(true);
    clientStorageMocks.getClientStoreSync.mockReturnValue([]);
    const diagnostics = await import("./rendererDiagnostics");

    const payload = diagnostics.buildRendererHeartbeatPayload({
      workspaceId: "workspace-1",
      threadId: "thread-1",
    });
    const serialized = JSON.stringify(payload);

    expect(payload.workspaceId).toBe("workspace-1");
    expect(payload.threadId).toBe("thread-1");
    expect(serialized).not.toContain("prompt");
    expect(serialized).not.toContain("assistant");
    expect(serialized).not.toContain("toolOutput");
    expect(serialized).not.toContain("fileContent");
    expect(serialized).not.toContain("environment");
  });
});
