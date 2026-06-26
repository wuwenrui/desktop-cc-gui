import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { HistoryCompletionSettings } from "../../HistoryCompletionSettings";
import { SessionRadarHistoryManagementSection } from "../../SessionRadarHistoryManagementSection";
import type { SessionRadarEntry } from "../../../../session-activity/hooks/useSessionRadarFeed";
import type { SessionRadarHistoryDeleteResult } from "../../../../session-activity/utils/sessionRadarHistoryManagement";
import {
  readStreamingScheduleTier,
  resetRealtimePerfFlags,
} from "../../../../threads/utils/realtimePerfFlags";
import {
  RENDER_TIER_FLAG_KEY,
  RENDER_SCHEDULE_TIER_VALUES,
  type RenderScheduleTier,
} from "../../../../threads/utils/renderSchedulingPolicy";
import { CostBudgetSettingsSection } from "./CostBudgetSettingsSection";

type OtherSectionProps = {
  title: string;
  description: string;
  sessionRadarRecentCompletedSessions: SessionRadarEntry[];
  onDeleteSessionRadarHistory: (
    entries: SessionRadarEntry[],
  ) => Promise<SessionRadarHistoryDeleteResult>;
};

export function OtherSection({
  title,
  description,
  sessionRadarRecentCompletedSessions,
  onDeleteSessionRadarHistory,
}: OtherSectionProps) {
  const { t } = useTranslation();
  const [performanceFlagsResetMessage, setPerformanceFlagsResetMessage] =
    useState<string | null>(null);
  const [streamingScheduleTier, setStreamingScheduleTier] =
    useState<RenderScheduleTier>(() => readStreamingScheduleTier());

  const handleResetPerformanceFlags = () => {
    const removedKeys = resetRealtimePerfFlags();
    setStreamingScheduleTier(readStreamingScheduleTier());
    setPerformanceFlagsResetMessage(
      removedKeys.length > 0
        ? t("settings.performanceFlagsResetDone", { count: removedKeys.length })
        : t("settings.performanceFlagsResetAlreadyDefault"),
    );
  };

  const handleStreamingScheduleTierChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextTier = event.target.value as RenderScheduleTier;
    window.localStorage.setItem(RENDER_TIER_FLAG_KEY, nextTier);
    setStreamingScheduleTier(nextTier);
  };

  return (
    <section className="settings-section">
      <div className="settings-section-title">{title}</div>
      <div className="settings-section-subtitle">{description}</div>
      <HistoryCompletionSettings />
      <Separator className="my-4" />
      <div className="settings-subsection-title">
        {t("settings.performanceDiagnosticsTitle")}
      </div>
      <div className="settings-subsection-subtitle">
        {t("settings.performanceDiagnosticsDescription")}
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">
            {t("settings.streamingScheduleTierTitle")}
          </div>
          <div className="settings-toggle-subtitle">
            {t("settings.streamingScheduleTierDescription")}
          </div>
          <div className="settings-help">
            {t(`settings.streamingScheduleTierDetail.${streamingScheduleTier}`)}
          </div>
          <div className="settings-help">
            {t("settings.streamingScheduleTierRestartHint")}
          </div>
        </div>
        <select
          aria-label={t("settings.streamingScheduleTierTitle")}
          className="settings-select"
          value={streamingScheduleTier}
          onChange={handleStreamingScheduleTierChange}
        >
          {RENDER_SCHEDULE_TIER_VALUES.map((tier) => (
            <option key={tier} value={tier}>
              {t(`settings.streamingScheduleTier.${tier}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="settings-toggle-row">
        <div>
          <div className="settings-toggle-title">
            {t("settings.performanceFlagsResetTitle")}
          </div>
          <div className="settings-toggle-subtitle">
            {t("settings.performanceFlagsResetDescription")}
          </div>
          {performanceFlagsResetMessage ? (
            <div className="settings-help">{performanceFlagsResetMessage}</div>
          ) : null}
        </div>
        <Button type="button" variant="outline" onClick={handleResetPerformanceFlags}>
          {t("settings.performanceFlagsResetButton")}
        </Button>
      </div>
      <Separator className="my-4" />
      <CostBudgetSettingsSection />
      <Separator className="my-4" />
      <SessionRadarHistoryManagementSection
        entries={sessionRadarRecentCompletedSessions}
        onDeleteEntries={onDeleteSessionRadarHistory}
      />
    </section>
  );
}
