import { useCallback, useMemo, type ComponentType, type SVGProps } from "react";
import { useCuratedSkills } from "../hooks/useCuratedSkills";
import { useCuratedSkillToggle } from "../hooks/useCuratedSkillToggle";
import { useAppSettings } from "../../settings/hooks/useAppSettings";
import { Switch } from "../../../components/ui/switch";
import { useTranslation } from "react-i18next";
import type { CuratedSkillOption } from "../../../types";
import Package from "lucide-react/dist/esm/icons/package";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import {
  CATEGORY_DEFAULTS,
  resolveCategoryLabel,
  translateOrFallback,
} from "../i18n/categoryLabels";
import { resolveLucideIcon } from "../utils/resolveLucideIcon";

/**
 * Settings panel for client-bundled curated skills (V0.5.14+).
 *
 * Visual contract: curated is rendered **above** `SkillsSection` and
 * wears a "Built-in" badge so the user can tell at a glance that it
 * ships with the desktop client (vs. `SkillsSection`, which renders
 * user-installed global / project / custom skills with source
 * badges). The two surfaces never share data and never share CSS
 * class names.
 *
 * Renders an empty-state placeholder when 0 curated skills are
 * loaded, so first-time users can see the concept exists; in the MVP
 * there's always at least 1 curated entry (lazy-senior-dev), but the
 * empty state still kicks in if the lock file is empty or `build.rs`
 * rejects every entry at compile time.
 */
export function CuratedSection() {
  const { t } = useTranslation();
  // Lift the AppSettings state slot to this component so the read
  // (useCuratedSkills) and write (useCuratedSkillToggle) hooks share
  // one React state slot. Calling useAppSettings() inside each child
  // hook would create two independent state slots and the switch
  // would visually appear to do nothing.
  const { settings, setSettings } = useAppSettings();
  const { skills, loading, error, refresh } = useCuratedSkills({
    enabledCuratedSkillIds: settings.enabledCuratedSkillIds,
  });
  const { setEnabled, pendingId, error: toggleError } = useCuratedSkillToggle({
    setSettings,
  });

  const builtInLabel = useMemo(
    () =>
      translateOrFallback(
        t,
        "common.curatedBundledBadge",
        CATEGORY_DEFAULTS.bundledBadge,
      ),
    [t],
  );
  const loadingLabel = useMemo(
    () =>
      translateOrFallback(
        t,
        "common.curatedLoading",
        CATEGORY_DEFAULTS.loading,
      ),
    [t],
  );
  const errorLabel = useMemo(
    () => translateOrFallback(t, "common.curatedError", CATEGORY_DEFAULTS.error),
    [t],
  );
  const subtitleLabel = useMemo(
    () =>
      translateOrFallback(
        t,
        "common.curatedSubtitle",
        CATEGORY_DEFAULTS.subtitle,
      ),
    [t],
  );
  const retryLabel = useMemo(
    () => translateOrFallback(t, "common.retry", "Retry"),
    [t],
  );
  const sectionTitleLabel = useMemo(
    () =>
      translateOrFallback(
        t,
        "common.curatedSectionTitle",
        CATEGORY_DEFAULTS.sectionTitle,
      ),
    [t],
  );

  const handleToggle = useCallback(
    async (entry: CuratedSkillOption, enabled: boolean) => {
      try {
        await setEnabled(entry.name, enabled);
      } catch {
        // Error is already surfaced via `useCuratedSkillToggle`'s
        // `error` field; nothing else to do here.
      }
    },
    [setEnabled],
  );

  if (loading) {
    return (
      <section className="curated-section" data-testid="curated-section-loading">
        <SectionHeader
          builtInLabel={builtInLabel}
          sectionTitleLabel={sectionTitleLabel}
        />
        <div className="curated-section-empty">{loadingLabel}</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="curated-section" data-testid="curated-section-error">
        <SectionHeader
          builtInLabel={builtInLabel}
          sectionTitleLabel={sectionTitleLabel}
        />
        <div className="curated-section-error" role="alert">
          <AlertCircle aria-hidden />
          {errorLabel}
          <button type="button" onClick={() => void refresh()}>
            {retryLabel}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="curated-section"
      data-testid="curated-section"
      data-count={skills.length}
    >
      <SectionHeader
        builtInLabel={builtInLabel}
        sectionTitleLabel={sectionTitleLabel}
      />
      <div className="curated-section-subtitle">{subtitleLabel}</div>
      {toggleError ? (
        <div className="curated-section-error" role="alert">
          <AlertCircle aria-hidden />
          {toggleError}
        </div>
      ) : null}
      {skills.length === 0 ? (
        <div
          className="curated-section-empty"
          data-testid="curated-section-empty"
        >
          {/* 0 entry: future-proof placeholder. In MVP this branch
              should not fire because build.rs guarantees ≥ 1 curated
              entry, but we render the slot so the section header
              still appears. */}
        </div>
      ) : (
        <ul className="curated-section-list">
          {skills.map((entry) => (
            <CuratedRow
              key={entry.name}
              entry={entry}
              isPending={pendingId === entry.name}
              onToggle={handleToggle}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionHeader({
  builtInLabel,
  sectionTitleLabel,
}: {
  builtInLabel: string;
  sectionTitleLabel: string;
}) {
  return (
    <header className="curated-section-head">
      <span className="curated-section-title">
        <Package className="curated-section-title-icon" aria-hidden />
        {sectionTitleLabel}
      </span>
      <span className="curated-section-badge">{builtInLabel}</span>
    </header>
  );
}

interface CuratedRowProps {
  entry: CuratedSkillOption;
  isPending: boolean;
  onToggle: (entry: CuratedSkillOption, enabled: boolean) => void;
}

function CuratedRow({ entry, isPending, onToggle }: CuratedRowProps) {
  const { t } = useTranslation();
  const Icon = useMemo(() => resolveLucideIcon(entry.icon), [entry.icon]);
  const categoryLabel = useMemo(
    () => resolveCategoryLabel(t, entry.category),
    [t, entry.category],
  );
  const tokenLabel = useMemo(() => {
    // Round to 0.1K granularity for display (1100 -> 1.1K).
    const thousands = entry.tokenEstimate / 1000;
    const rounded = Math.round(thousands * 10) / 10;
    const display =
      rounded >= 1 ? `${rounded.toFixed(1)}K` : `${entry.tokenEstimate}`;
    return translateOrFallback(
      t,
      "common.curatedTokenEstimate",
      `${display} tokens`,
      { count: entry.tokenEstimate },
    );
  }, [t, entry.tokenEstimate]);

  const handleChange = useCallback(
    (value: boolean) => onToggle(entry, value),
    [entry, onToggle],
  );
  const viewOnGithubLabel = useMemo(
    () =>
      translateOrFallback(
        t,
        "common.curatedViewOnGithub",
        CATEGORY_DEFAULTS.viewOnGithub,
      ),
    [t],
  );
  const viewOnGithubAriaLabel = useMemo(
    () =>
      translateOrFallback(
        t,
        "common.curatedViewOnGithubAria",
        CATEGORY_DEFAULTS.viewOnGithubAria,
        { name: entry.displayName },
      ),
    [t, entry.displayName],
  );
  const toggleAriaLabel = useMemo(
    () =>
      translateOrFallback(
        t,
        "common.curatedToggleAria",
        `Toggle ${entry.displayName}`,
        { name: entry.displayName },
      ),
    [t, entry.displayName],
  );

  return (
    <li
      className="curated-section-row"
      data-testid={`curated-row-${entry.name}`}
      data-enabled={entry.enabled}
    >
      <div className="curated-section-row-main">
        <div className="curated-section-row-title">
          <span
            className="curated-section-row-icon"
            aria-hidden
            data-icon={entry.icon}
          >
            <IconComponent Icon={Icon} />
          </span>
          <span className="curated-section-row-name">{entry.displayName}</span>
          <span
            className="curated-section-row-category"
            data-category={entry.category}
          >
            {categoryLabel}
          </span>
          {entry.sourceUrl ? (
            <a
              className="curated-section-row-source"
              data-testid={`curated-row-source-${entry.name}`}
              href={entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={viewOnGithubAriaLabel}
              aria-label={viewOnGithubAriaLabel}
            >
              <ExternalLink aria-hidden />
              <span className="curated-section-row-source-text">
                {viewOnGithubLabel}
              </span>
            </a>
          ) : null}
        </div>
        <div className="curated-section-row-description">{entry.description}</div>
        <div className="curated-section-row-meta">
          <span
            className="curated-section-row-token"
            title={`${entry.tokenEstimate} tokens`}
          >
            {tokenLabel}
          </span>
          <span className="curated-section-row-license">{entry.license}</span>
          <span className="curated-section-row-version">v{entry.version}</span>
        </div>
      </div>
      <Switch
        checked={entry.enabled}
        disabled={isPending}
        onCheckedChange={handleChange}
        aria-label={toggleAriaLabel}
      />
    </li>
  );
}

/**
 * Render a lucide icon component (or a fallback package icon when the
 * requested name doesn't resolve). Pulled out of the row to keep the
 * JSX clean — the `Icon` memo may legitimately be `null` for unknown
 * names and the row should still render a generic swatch.
 */
function IconComponent({
  Icon,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>> | null;
}) {
  if (!Icon) {
    return <Package aria-hidden />;
  }
  return <Icon aria-hidden />;
}
