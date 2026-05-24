import { useState } from "react";
import type { TFunction } from "i18next";
import Info from "lucide-react/dist/esm/icons/info";
import MessageSquareText from "lucide-react/dist/esm/icons/message-square-text";
import { Badge } from "@/components/ui/badge";
import { EngineIcon } from "../../../../engine/components/EngineIcon";
import type { WorkspaceSessionCatalogEntry } from "../../../../../services/tauri";
import { buildWorkspaceSessionSelectionKey } from "../hooks/useWorkspaceSessionCatalog";
import {
  formatUpdatedAtDisplay,
  normalizeEngineType,
  resolveAttributionConfidenceLabel,
  resolveAttributionReasonLabel,
  resolveWorkspaceSessionDisplayTitle,
  UNASSIGNED_WORKSPACE_ID,
} from "./sessionManagementSectionUtils";

type SessionListSectionProps = {
  title: string;
  description?: string;
  entries: WorkspaceSessionCatalogEntry[];
  selectedIds: Record<string, true>;
  workspaceLabelById: Map<string, string>;
  engineFilterLabel: Record<string, string>;
  locale: string;
  onToggleSelection: (selectionKey: string) => void;
  onOpenSessionCurtain: (entry: WorkspaceSessionCatalogEntry) => void;
  t: TFunction;
};

export function SessionListSection({
  title,
  description,
  entries,
  selectedIds,
  workspaceLabelById,
  engineFilterLabel,
  locale,
  onToggleSelection,
  onOpenSessionCurtain,
  t,
}: SessionListSectionProps) {
  const [expandedDetailKeys, setExpandedDetailKeys] = useState<
    Record<string, boolean>
  >({});
  const toggleDetail = (selectionKey: string) => {
    setExpandedDetailKeys((current) => ({
      ...current,
      [selectionKey]: !current[selectionKey],
    }));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <ul className="settings-project-sessions-list">
        {entries.map((entry) => {
          const selectionKey = buildWorkspaceSessionSelectionKey(entry);
          const selected = Boolean(selectedIds[selectionKey]);
          const engineLabel =
            engineFilterLabel[normalizeEngineType(entry.engine)] ??
            entry.engine;
          const ownerWorkspaceLabel =
            entry.workspaceId === UNASSIGNED_WORKSPACE_ID
              ? t("settings.sessionManagementWorkspaceUnassigned")
              : (entry.workspaceLabel ??
                workspaceLabelById.get(entry.workspaceId) ??
                entry.workspaceId);
          const attributionReason = resolveAttributionReasonLabel(entry, t);
          const attributionConfidence = resolveAttributionConfidenceLabel(
            entry,
            t,
          );
          const titleLabel = resolveWorkspaceSessionDisplayTitle(
            entry,
            t("settings.projectSessionItemUntitled"),
          );
          const updatedAtDisplay = formatUpdatedAtDisplay(
            entry.updatedAt,
            locale,
          );
          const detailExpanded = Boolean(expandedDetailKeys[selectionKey]);
          return (
            <li key={selectionKey}>
              <div
                className={`settings-project-sessions-item${selected ? " is-selected" : ""}${detailExpanded ? " is-expanded" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleSelection(selectionKey)}
                  aria-label={titleLabel}
                />
                <span
                  className="settings-project-sessions-item-engine"
                  aria-hidden
                >
                  <EngineIcon
                    engine={normalizeEngineType(entry.engine)}
                    size={14}
                  />
                </span>
                <span className="settings-project-sessions-item-content">
                  <span className="settings-project-sessions-item-heading">
                    <span className="settings-project-sessions-item-title">
                      {titleLabel}
                    </span>
                    {entry.inconsistencyCode === "missing-on-disk" ? (
                      <Badge variant="destructive" size="sm">
                        {t("settings.sessionManagementBadgeMissingOnDisk")}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="settings-project-sessions-item-date">
                    {updatedAtDisplay}
                  </span>
                  <button
                    type="button"
                    className="settings-project-sessions-detail-toggle"
                    aria-expanded={detailExpanded}
                    aria-label={t("settings.sessionManagementDetailToggle")}
                    title={t("settings.sessionManagementDetailToggle")}
                    onClick={() => toggleDetail(selectionKey)}
                  >
                    <Info size={22} strokeWidth={2.1} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="settings-project-sessions-curtain-toggle"
                    aria-label={t("settings.sessionManagementOpenCurtain")}
                    title={t("settings.sessionManagementOpenCurtain")}
                    onClick={() => onOpenSessionCurtain(entry)}
                  >
                    <MessageSquareText
                      size={22}
                      strokeWidth={2.1}
                      aria-hidden
                    />
                  </button>
                  {detailExpanded ? (
                    <span className="settings-project-sessions-item-details">
                      <span className="settings-project-sessions-detail-badges">
                        {entry.archivedAt ? (
                          <Badge variant="secondary" size="sm">
                            {t("settings.sessionManagementBadgeArchived")}
                          </Badge>
                        ) : null}
                        {entry.attributionStatus === "inferred-related" ? (
                          <Badge variant="outline" size="sm">
                            {t("settings.sessionManagementBadgeRelated")}
                          </Badge>
                        ) : null}
                        {entry.childrenCount && entry.childrenCount > 0 ? (
                          <Badge variant="outline" size="sm">
                            {t("settings.sessionManagementChildrenCount", {
                              count: entry.childrenCount,
                            })}
                          </Badge>
                        ) : null}
                        {attributionConfidence ? (
                          <Badge variant="outline" size="sm">
                            {attributionConfidence}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="settings-project-sessions-detail-grid">
                        <span>
                          {t("settings.sessionManagementDetailEngine")}
                        </span>
                        <span>{engineLabel}</span>
                        <span>
                          {t("settings.sessionManagementDetailWorkspace")}
                        </span>
                        <span>{ownerWorkspaceLabel}</span>
                        {entry.sourceLabel ? (
                          <>
                            <span>
                              {t("settings.sessionManagementDetailSource")}
                            </span>
                            <span>{entry.sourceLabel}</span>
                          </>
                        ) : null}
                        {attributionReason ? (
                          <>
                            <span>
                              {t("settings.sessionManagementDetailAttribution")}
                            </span>
                            <span>{attributionReason}</span>
                          </>
                        ) : null}
                        {entry.parentSessionId ? (
                          <>
                            <span>
                              {t("settings.sessionManagementDetailParent")}
                            </span>
                            <span>
                              {t("settings.sessionManagementParentSession", {
                                id: entry.parentSessionId,
                              })}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
