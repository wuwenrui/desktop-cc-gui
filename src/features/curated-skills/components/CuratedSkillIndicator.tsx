import { useEffect, useMemo, useState } from "react";
import { getCuratedSkills, getEnabledCuratedSkillIds } from "../../../services/tauri";
import { resolveLucideIcon, FALLBACK_ICON } from "../utils/resolveLucideIcon";
import type { CuratedSkillOption } from "../../../types";

/**
 * Read-only indicator that surfaces which curated skills are currently
 * active for the conversation. Renders nothing when zero skills are
 * enabled so the indicator costs zero visual weight by default.
 *
 * Visual contract: a compact row of one chip per always-on curated
 * skill, showing only the lucide icon + display name. Token counts and
 * totals were intentionally removed: the chip is a declarative
 * "this skill is in effect" affordance, not a budget readout, and
 * keeping the chips to name-only avoids competing with the context
 * token indicator elsewhere in the composer.
 *
 * **Why a poll?** `AppSettings` is a per-component `useState` cache;
 * the Settings view and the composer each hold their own snapshot and
 * are not wired together. Toggling a curated skill in
 * `Settings > Skills` does NOT cause the composer tree to re-render,
 * so the indicator cannot rely on a `useAppSettings()` subscription
 * to see the change. Instead we ask the backend (the source of
 * truth) every `POLL_INTERVAL_MS` for the live enabled-id set and the
 * bundled metadata, and re-derive the display. The IPC is in-process
 * (Tauri invoke into the running Rust binary) so the cost is
 * negligible. The poll continues while the component is mounted even
 * when it currently renders null; otherwise the composer could not
 * discover a skill that was enabled from Settings.
 */
const POLL_INTERVAL_MS = 2000;

type CuratedSkillIndicatorProps = {
  /**
   * Click handler forwarded by the composer tree. Wired from
   * `useAppShellLayoutNodesSection` via prop drilling. When omitted
   * (e.g. in tests or storybook), the chip falls back to a static
   * "read-only" indicator with no click behavior.
   */
  onOpenSkillsSettings?: () => void;
};

export function CuratedSkillIndicator({
  onOpenSkillsSettings,
}: CuratedSkillIndicatorProps = {}) {
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [skills, setSkills] = useState<CuratedSkillOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const [ids, entries] = await Promise.all([
          getEnabledCuratedSkillIds(),
          getCuratedSkills(),
        ]);
        if (cancelled) return;
        setEnabledIds(ids ?? []);
        setSkills(entries ?? []);
      } catch {
        // Best-effort: a failed poll leaves the previous values in
        // place. The next successful tick will overwrite them.
      }
    };

    void tick();
    const handle = window.setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    // Note: the `setInterval` is intentionally not paused on
    // visibilitychange. The poll is cheap (two in-process IPC calls
    // every 2s) and the user expects the indicator to reflect the
    // current settings even when they switch back to a backgrounded
    // tab.
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  const enabledSet = useMemo(() => new Set(enabledIds), [enabledIds]);
  const enabledSkills = useMemo(
    () => skills.filter((s) => enabledSet.has(s.name)),
    [skills, enabledSet],
  );

  if (enabledSkills.length === 0) {
    return null;
  }

  const tooltip = enabledSkills
    .map((s) => s.displayName)
    .join(", ");

  const visible = enabledSkills.slice(0, 2);
  const overflow = enabledSkills.length - visible.length;

  return (
    <div
      className="curated-indicator curated-indicator-top"
      data-testid="curated-indicator"
      data-count={enabledSkills.length}
      role="status"
      aria-live="polite"
      title={tooltip}
    >
      {visible.map((entry) => {
        const Icon = resolveLucideIcon(entry.icon) ?? FALLBACK_ICON;
        const label = `${entry.displayName} — open Skills settings`;
        if (onOpenSkillsSettings) {
          return (
            <button
              key={entry.name}
              type="button"
              className="curated-indicator-chip curated-indicator-chip-button"
              data-testid={`curated-indicator-chip-${entry.name}`}
              aria-label={label}
              title={label}
              onClick={onOpenSkillsSettings}
            >
              <span className="curated-indicator-chip-icon" aria-hidden>
                <Icon />
              </span>
              <span className="curated-indicator-chip-name">
                {entry.displayName}
              </span>
            </button>
          );
        }
        return (
          <span
            key={entry.name}
            className="curated-indicator-chip"
            data-testid={`curated-indicator-chip-${entry.name}`}
            title={label}
          >
            <span className="curated-indicator-chip-icon" aria-hidden>
              <Icon />
            </span>
            <span className="curated-indicator-chip-name">
              {entry.displayName}
            </span>
          </span>
        );
      })}
      {overflow > 0 ? (
        <span
          className="curated-indicator-overflow"
          data-testid="curated-indicator-overflow"
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
