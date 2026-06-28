import { useCallback, useState } from "react";
import { setCuratedSkillEnabled } from "../../../services/tauri";
import type { AppSettings } from "../../../types";

/**
 * Toggle handler for curated skills. The IPC returns the new
 * `AppSettings`, which we hand back to the caller-owned settings updater.
 *
 * This hook deliberately does not own AppSettings state. SettingsView already
 * owns the active settings snapshot, so writing through that parent updater
 * keeps the row switch and every sibling settings consumer in lockstep.
 */
export function useCuratedSkillToggle(options: {
  onSettingsChanged: (next: AppSettings) => Promise<void> | void;
}) {
  const { onSettingsChanged } = options;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setEnabled = useCallback(
    async (skillId: string, enabled: boolean) => {
      setPendingId(skillId);
      setError(null);
      try {
        const next = (await setCuratedSkillEnabled(skillId, enabled)) as AppSettings;
        await onSettingsChanged(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setPendingId(null);
      }
    },
    [onSettingsChanged],
  );

  return {
    setEnabled,
    pendingId,
    error,
  };
}
