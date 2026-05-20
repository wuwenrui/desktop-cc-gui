import type { EngineType } from "../types";

export function resolveModelConfigEngine(
  providerId: string | undefined,
  fallbackEngine: EngineType,
): EngineType | null {
  if (providerId === "claude" || providerId === "codex" || providerId === "gemini") {
    return providerId;
  }
  if (fallbackEngine === "claude" || fallbackEngine === "codex" || fallbackEngine === "gemini") {
    return fallbackEngine;
  }
  return null;
}
