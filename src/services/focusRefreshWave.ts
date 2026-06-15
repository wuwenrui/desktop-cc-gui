import { registerListenerOwner } from "./listenerOwners";

export type FocusRefreshSource = {
  id: string;
  owner: "workspace" | "panel" | "shell";
  refresh: () => void;
};

const sources = new Map<string, FocusRefreshSource>();
let cleanupListeners: (() => void) | null = null;
let waveScheduled = false;
let waveCount = 0;
let coalescedCount = 0;

function enqueueWave() {
  if (waveScheduled) {
    coalescedCount += 1;
    return;
  }
  waveScheduled = true;
  queueMicrotask(() => {
    waveScheduled = false;
    waveCount += 1;
    const currentSources = Array.from(sources.values());
    for (const source of currentSources) {
      source.refresh();
    }
  });
}

function ensureListeners() {
  if (cleanupListeners || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const cleanupOwner = registerListenerOwner({
    id: "focus-refresh-wave",
    owner: "workspace",
    surfaceId: "focus-refresh-wave",
  });
  const handleFocus = () => enqueueWave();
  const handleVisibilityChange = () => {
    if (document.visibilityState !== "hidden") {
      enqueueWave();
    }
  };
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  cleanupListeners = () => {
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    cleanupOwner();
    cleanupListeners = null;
    waveScheduled = false;
  };
}

function cleanupIfIdle() {
  if (sources.size === 0 && cleanupListeners) {
    cleanupListeners();
  }
}

export function registerFocusRefreshSource(source: FocusRefreshSource) {
  sources.set(source.id, source);
  ensureListeners();
  return () => {
    sources.delete(source.id);
    cleanupIfIdle();
  };
}

export function getFocusRefreshWaveDiagnostics() {
  return {
    activeSourceCount: sources.size,
    waveCount,
    coalescedCount,
    evidenceClass: "proxy" as const,
  };
}

export function resetFocusRefreshWaveForTests() {
  sources.clear();
  cleanupListeners?.();
  cleanupListeners = null;
  waveScheduled = false;
  waveCount = 0;
  coalescedCount = 0;
}
