import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { setCuratedSkillEnabled } from "../../../services/tauri";
import type { AppSettings } from "../../../types";

/**
 * Toggle handler for curated skills. The IPC returns the new
 * `AppSettings`, which we write back to the **caller-supplied** setter
 * so every consumer (CuratedSection, readiness indicator, etc.) re-renders
 * synchronously.
 *
 * We deliberately do NOT call `useAppSettings()` ourselves: each call
 * would create a brand-new local state slot in React's hook list, so a
 * `setSettings` here would update a *different* instance from the one
 * the rendering hook reads. To guarantee they stay in lockstep the
 * caller passes its own `setSettings` down, which means the same
 * React state slot is shared between the read path and the write
 * path.
 */
export function useCuratedSkillToggle(options: {
  setSettings: Dispatch<SetStateAction<AppSettings>>;
}) {
  const { setSettings } = options;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setEnabled = useCallback(
    async (skillId: string, enabled: boolean) => {
      setPendingId(skillId);
      setError(null);
      try {
        const next = (await setCuratedSkillEnabled(skillId, enabled)) as AppSettings;
        setSettings(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setPendingId(null);
      }
    },
    [setSettings],
  );

  return {
    setEnabled,
    pendingId,
    error,
  };
}
