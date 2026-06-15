import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { HistoryCompletionSettings } from "../../HistoryCompletionSettings";
import { SessionRadarHistoryManagementSection } from "../../SessionRadarHistoryManagementSection";
import type { SessionRadarEntry } from "../../../../session-activity/hooks/useSessionRadarFeed";
import type { SessionRadarHistoryDeleteResult } from "../../../../session-activity/utils/sessionRadarHistoryManagement";
import { resetRealtimePerfFlags } from "../../../../threads/utils/realtimePerfFlags";
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

  const handleResetPerformanceFlags = () => {
    const removedKeys = resetRealtimePerfFlags();
    setPerformanceFlagsResetMessage(
      removedKeys.length > 0
        ? t("settings.performanceFlagsResetDone", { count: removedKeys.length })
        : t("settings.performanceFlagsResetAlreadyDefault"),
    );
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
