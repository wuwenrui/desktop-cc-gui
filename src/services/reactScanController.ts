// Runtime controller for the react-scan render-profiling overlay.
//
// react-scan ships inside production bundles on purpose so it can be toggled from
// the in-app settings page (Other -> Performance diagnostics). The module itself is
// loaded lazily via dynamic import, so it stays in a separate chunk that is only
// fetched when the overlay is actually turned on.

import { recordReactScanRender } from "./perfBaseline/reactScanRenderLog";

type ReactScanModule = typeof import("react-scan");

const REACT_SCAN_FLAG_KEY = "ccgui.perf.reactScan";

let cachedModule: ReactScanModule | null = null;
let loadPromise: Promise<ReactScanModule> | null = null;

function canUseLocalStorage(): boolean {
  try {
    return typeof globalThis !== "undefined" && typeof globalThis.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/** Whether the user toggled the overlay on (persisted in localStorage). */
export function isReactScanFlagEnabled(): boolean {
  if (!canUseLocalStorage()) {
    return false;
  }
  try {
    return globalThis.localStorage.getItem(REACT_SCAN_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Sync check used at boot to decide whether to start the overlay before first render. */
export function isReactScanStartupEnabled(): boolean {
  const env = import.meta.env as { DEV?: boolean; VITE_ENABLE_REACT_SCAN?: string };
  const envEnabled = env.DEV === true && env.VITE_ENABLE_REACT_SCAN === "1";
  return envEnabled || isReactScanFlagEnabled();
}

function persistFlag(enabled: boolean): void {
  if (!canUseLocalStorage()) {
    return;
  }
  try {
    if (enabled) {
      globalThis.localStorage.setItem(REACT_SCAN_FLAG_KEY, "1");
    } else {
      globalThis.localStorage.removeItem(REACT_SCAN_FLAG_KEY);
    }
  } catch {
    // localStorage is best effort; ignore quota/permission failures.
  }
}

function loadReactScan(): Promise<ReactScanModule> {
  if (!loadPromise) {
    loadPromise = import("react-scan").then((mod) => {
      cachedModule = mod;
      return mod;
    });
  }
  return loadPromise;
}

async function applyReactScan(enabled: boolean): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  // Nothing to tear down if react-scan was never loaded.
  if (!enabled && cachedModule === null && loadPromise === null) {
    return;
  }
  try {
    const { scan } = await loadReactScan();
    // dangerouslyForceRunInProduction is required: this app bundles react-scan into
    // production builds intentionally, and without this flag react-scan refuses to run
    // outside development. In production builds only re-render highlights and counts are
    // available (React strips per-render timings from production builds).
    scan({
      enabled,
      showToolbar: enabled,
      // 在工具条直接显示 FPS,便于第一眼看到掉帧(生产版只有 FPS/计数,无 per-render 计时)。
      showFPS: true,
      dangerouslyForceRunInProduction: true,
      // MON-3:把每次 commit 的组件渲染记入日志,供掉帧现场回答"谁在重渲染"。
      onRender: (fiber, renders) => {
        recordReactScanRender(fiber, renders);
      },
    });
  } catch (error) {
    console.error("Failed to apply react-scan overlay:", error);
  }
}

/** Start the overlay at app boot when the persisted flag (or dev env var) is set. */
export async function startReactScanOverlay(): Promise<void> {
  await applyReactScan(true);
}

/** Toggle the overlay from settings: persist the choice and apply it live. */
export async function setReactScanEnabled(enabled: boolean): Promise<void> {
  persistFlag(enabled);
  await applyReactScan(enabled);
}
