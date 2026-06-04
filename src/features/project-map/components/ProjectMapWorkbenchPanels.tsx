import { useTranslation } from "react-i18next";
import Lightbulb from "lucide-react/dist/esm/icons/lightbulb";
import ListFilter from "lucide-react/dist/esm/icons/list-filter";
import RadioTower from "lucide-react/dist/esm/icons/radio-tower";

import { cn } from "../../../lib/utils";
import type {
  ProjectMapActivityItem,
  ProjectMapActivityProjection,
  ProjectMapActivitySourceCategory,
  ProjectMapAdvisorHint,
  ProjectMapAdvisorKind,
  ProjectMapGroupedQueryResults,
  ProjectMapQueryResult,
} from "../types";

type ProjectMapWorkbenchActionTarget = {
  nodeIds: string[];
  relationIds: string[];
};

export type ProjectMapNavigationHistoryItem = {
  id: string;
  label: string;
  kind: "node" | "path";
  nodeId?: string;
  sourceNodeId?: string | null;
  targetNodeId?: string | null;
};

function MetaPills({ values }: { values: string[] }) {
  if (values.length === 0) {
    return null;
  }
  return (
    <span className="project-map-workbench-row-meta">
      {values.slice(0, 4).map((value) => (
        <em key={value}>{value}</em>
      ))}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="project-map-workbench-empty">{label}</p>;
}

function translateActivityGroupTitle(
  t: ReturnType<typeof useTranslation>["t"],
  category: ProjectMapActivitySourceCategory,
): string {
  return t(`projectMap.activityPanel.groups.${category}`);
}

function translateActivityKind(t: ReturnType<typeof useTranslation>["t"], item: ProjectMapActivityItem): string {
  return t(`projectMap.activityPanel.kinds.${item.kind}`);
}

function formatActivityTitle(t: ReturnType<typeof useTranslation>["t"], item: ProjectMapActivityItem): string {
  if (item.kind === "git-change") {
    return t("projectMap.activityPanel.titles.gitChange", {
      changed: item.nodeIds.length,
      affected: Math.max(item.relationIds.length, item.lensIds.length),
    });
  }
  if (item.kind === "project-map-run") {
    return t("projectMap.activityPanel.titles.mapRun");
  }
  if (item.kind === "candidate") {
    return t("projectMap.activityPanel.titles.candidate", { count: Math.max(item.nodeIds.length, 1) });
  }
  if (item.kind === "stale") {
    return t("projectMap.activityPanel.titles.stale", { count: Math.max(item.nodeIds.length, 1) });
  }
  if (item.kind === "evidence") {
    return t("projectMap.activityPanel.titles.evidence", { count: Math.max(item.filePaths.length, 1) });
  }
  return item.title;
}

function formatActivitySummary(t: ReturnType<typeof useTranslation>["t"], item: ProjectMapActivityItem): string {
  if (item.kind === "git-change") {
    return t("projectMap.activityPanel.summaries.gitChange", {
      files: item.filePaths.length,
      nodes: item.nodeIds.length,
      relations: item.relationIds.length,
      degraded: item.degraded ? t("projectMap.activityPanel.degradedSuffix") : "",
    });
  }
  if (item.kind === "project-map-run") {
    return t("projectMap.activityPanel.summaries.mapRun", {
      files: item.filePaths.length,
      nodes: item.nodeIds.length,
    });
  }
  if (item.kind === "candidate") {
    return t("projectMap.activityPanel.summaries.candidate", {
      nodes: item.nodeIds.length,
      files: item.filePaths.length,
    });
  }
  if (item.kind === "stale") {
    return t("projectMap.activityPanel.summaries.stale", {
      nodes: item.nodeIds.length,
      files: item.filePaths.length,
    });
  }
  if (item.kind === "evidence") {
    return t("projectMap.activityPanel.summaries.evidence", {
      files: item.filePaths.length,
      refs: item.sourceRefs.length,
    });
  }
  return item.summary;
}

function formatActivityMeta(t: ReturnType<typeof useTranslation>["t"], item: ProjectMapActivityItem): string[] {
  return [
    translateActivityKind(t, item),
    t(`projectMap.activityPanel.confidence.${item.confidence}`),
    item.deterministic ? t("projectMap.activityPanel.deterministic") : t("projectMap.activityPanel.inferred"),
    item.degraded ? t("projectMap.activityPanel.degraded") : "",
  ].filter(Boolean);
}

function translateAdvisorKind(t: ReturnType<typeof useTranslation>["t"], kind: ProjectMapAdvisorKind): string {
  return t(`projectMap.advisorPanel.kinds.${kind}`);
}

function formatAdvisorTitle(t: ReturnType<typeof useTranslation>["t"], hint: ProjectMapAdvisorHint): string {
  if (hint.kind === "diff-impact") {
    return t("projectMap.advisorPanel.titles.diffImpact", { nodes: hint.nodeIds.length, files: hint.filePaths.length });
  }
  if (hint.kind === "query-neighborhood") {
    return t("projectMap.advisorPanel.titles.queryNeighborhood", { nodes: hint.nodeIds.length });
  }
  if (hint.kind === "node-explain") {
    return t("projectMap.advisorPanel.titles.nodeExplain");
  }
  if (hint.kind === "guide-topology") {
    return t("projectMap.advisorPanel.titles.guideTopology", { nodes: hint.nodeIds.length });
  }
  return t("projectMap.advisorPanel.titles.graphHealth", { issues: hint.relationIds.length + hint.filePaths.length });
}

function formatAdvisorSummary(t: ReturnType<typeof useTranslation>["t"], hint: ProjectMapAdvisorHint): string {
  if (hint.kind === "diff-impact") {
    return t("projectMap.advisorPanel.summaries.diffImpact", {
      nodes: hint.nodeIds.length,
      relations: hint.relationIds.length,
      files: hint.filePaths.length,
    });
  }
  if (hint.kind === "query-neighborhood") {
    return t("projectMap.advisorPanel.summaries.queryNeighborhood", {
      nodes: hint.nodeIds.length,
      relations: hint.relationIds.length,
    });
  }
  if (hint.kind === "node-explain") {
    return t("projectMap.advisorPanel.summaries.nodeExplain", {
      nodes: hint.nodeIds.length,
      relations: hint.relationIds.length,
      files: hint.filePaths.length,
    });
  }
  if (hint.kind === "guide-topology") {
    return t("projectMap.advisorPanel.summaries.guideTopology", { nodes: hint.nodeIds.length });
  }
  return t("projectMap.advisorPanel.summaries.graphHealth", {
    relations: hint.relationIds.length,
    files: hint.filePaths.length,
  });
}

function formatAdvisorMeta(t: ReturnType<typeof useTranslation>["t"], hint: ProjectMapAdvisorHint): string[] {
  return [
    translateAdvisorKind(t, hint.kind),
    t(`projectMap.advisorPanel.severity.${hint.severity ?? "info"}`),
    hint.deterministic ? t("projectMap.advisorPanel.deterministic") : t("projectMap.advisorPanel.inferred"),
    hint.degraded ? t("projectMap.advisorPanel.degraded") : "",
  ].filter(Boolean);
}

export function ProjectMapGroupedQueryPanel({
  results,
  expanded,
  queryHistory,
  onActivateResult,
  onRestoreQuery,
  onClearQueryHistory,
}: {
  results: ProjectMapGroupedQueryResults;
  expanded: boolean;
  queryHistory: string[];
  onActivateResult: (result: ProjectMapQueryResult) => void;
  onRestoreQuery: (query: string) => void;
  onClearQueryHistory: () => void;
}) {
  const { t } = useTranslation();
  const hasQuery = results.query.trim().length > 0;
  const hasResults = results.groups.some((group) => group.results.length > 0);

  return (
    <section className={cn("project-map-workbench-panel", !expanded && "is-collapsed")} aria-label={t("projectMap.queryPanel.title")}>
      {!expanded ? null : (
        <>
          <header className="project-map-workbench-panel-header">
            <ListFilter aria-hidden />
            <div>
              <h4>{t("projectMap.queryPanel.title")}</h4>
              <p>{t("projectMap.queryPanel.subtitle")}</p>
            </div>
          </header>
          {queryHistory.length > 0 ? (
            <div className="project-map-local-history" aria-label={t("projectMap.queryPanel.history")}>
              <span>{t("projectMap.queryPanel.history")}</span>
              {queryHistory.map((query) => (
                <button key={query} type="button" onClick={() => onRestoreQuery(query)}>
                  {query}
                </button>
              ))}
              <button type="button" onClick={onClearQueryHistory}>
                {t("projectMap.queryPanel.clearHistory")}
              </button>
            </div>
          ) : null}
          {!hasQuery ? (
            <EmptyState label={t("projectMap.queryPanel.emptyQuery")} />
          ) : !hasResults ? (
            <EmptyState label={t("projectMap.queryPanel.emptyResults")} />
          ) : (
            <div className="project-map-workbench-groups">
              {results.groups.map((group) => (
                <section key={group.group} className="project-map-workbench-group">
                  <h5>
                    {group.title}
                    <span>{group.totalCount}</span>
                  </h5>
                  {group.results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className={cn("project-map-workbench-row", result.degraded && "is-degraded")}
                      onClick={() => onActivateResult(result)}
                    >
                      <strong>{result.title}</strong>
                      <span>{result.preview || result.summary}</span>
                      <MetaPills values={result.matchedFields} />
                    </button>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ProjectMapNavigationHistoryChips({
  items,
  onActivate,
  onClear,
}: {
  items: ProjectMapNavigationHistoryItem[];
  onActivate: (item: ProjectMapNavigationHistoryItem) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="project-map-local-history project-map-navigation-history" aria-label={t("projectMap.navigation.history")}>
      <span>{t("projectMap.navigation.history")}</span>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onActivate(item)}>
          {item.kind === "path" ? t("projectMap.navigation.path.badge") : t("projectMap.navigation.search.badge")}
          {" · "}
          {item.label}
        </button>
      ))}
      <button type="button" onClick={onClear}>
        {t("projectMap.navigation.clearHistory")}
      </button>
    </div>
  );
}

export function ProjectMapRecentActivityPanel({
  activity,
  expanded,
  onActivateTarget,
}: {
  activity: ProjectMapActivityProjection;
  expanded: boolean;
  onActivateTarget: (target: ProjectMapWorkbenchActionTarget) => void;
}) {
  const { t } = useTranslation();
  const hasActivity = activity.groups.some((group) => group.items.length > 0);

  return (
    <section className={cn("project-map-workbench-panel", !expanded && "is-collapsed")} aria-label={t("projectMap.activityPanel.title")}>
      {!expanded ? null : (
        <>
          <header className="project-map-workbench-panel-header">
            <RadioTower aria-hidden />
            <div>
              <h4>{t("projectMap.activityPanel.title")}</h4>
              <p>{t("projectMap.activityPanel.subtitle")}</p>
            </div>
          </header>
          {!hasActivity ? (
            <EmptyState label={t("projectMap.activityPanel.empty")} />
          ) : (
            <div className="project-map-workbench-groups">
              {activity.groups.map((group) => (
                <section key={group.id} className="project-map-workbench-group">
                  <h5>
                    {translateActivityGroupTitle(t, group.id)}
                    <span>{group.items.length}</span>
                  </h5>
                  {group.items.map((item: ProjectMapActivityItem) => (
                    <button
                      key={item.id}
                      type="button"
                      className={cn("project-map-workbench-row", item.degraded && "is-degraded")}
                      onClick={() => onActivateTarget(item)}
                    >
                      <strong>{formatActivityTitle(t, item)}</strong>
                      <span>{formatActivitySummary(t, item)}</span>
                      <MetaPills values={formatActivityMeta(t, item)} />
                    </button>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function ProjectMapAdvisorHintsPanel({
  hints,
  expanded,
  selectedHintId,
  onActivateHint,
  onClearHint,
}: {
  hints: ProjectMapAdvisorHint[];
  expanded: boolean;
  selectedHintId: string | null;
  onActivateHint: (hint: ProjectMapAdvisorHint) => void;
  onClearHint: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className={cn("project-map-workbench-panel", !expanded && "is-collapsed")} aria-label={t("projectMap.advisorPanel.title")}>
      {!expanded ? null : (
        <>
          <header className="project-map-workbench-panel-header">
            <Lightbulb aria-hidden />
            <div>
              <h4>{t("projectMap.advisorPanel.title")}</h4>
              <p>{t("projectMap.advisorPanel.subtitle")}</p>
            </div>
            {selectedHintId ? (
              <button type="button" onClick={onClearHint}>
                {t("projectMap.advisorPanel.clear")}
              </button>
            ) : null}
          </header>
          {hints.length === 0 ? (
            <EmptyState label={t("projectMap.advisorPanel.empty")} />
          ) : (
            <div className="project-map-workbench-groups">
              <section className="project-map-workbench-group">
                {hints.map((hint) => (
                  <button
                    key={hint.id}
                    type="button"
                    className={cn(
                      "project-map-workbench-row",
                      hint.degraded && "is-degraded",
                      selectedHintId === hint.id && "is-active",
                    )}
                    onClick={() => onActivateHint(hint)}
                  >
                    <strong>{formatAdvisorTitle(t, hint)}</strong>
                    <span>{formatAdvisorSummary(t, hint)}</span>
                    <MetaPills values={formatAdvisorMeta(t, hint)} />
                  </button>
                ))}
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}
