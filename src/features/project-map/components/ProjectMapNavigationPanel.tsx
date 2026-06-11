import { useTranslation } from "react-i18next";
import Route from "lucide-react/dist/esm/icons/route";
import Search from "lucide-react/dist/esm/icons/search";

import { cn } from "../../../lib/utils";
import type { ProjectMapPathResult } from "../utils/navigation";
import type { ProjectMapAssociationExplanation, ProjectMapNode } from "../types";

export function ProjectMapNavigationPanel({
  searchQuery,
  expanded,
  pathNodeOptions,
  pathSourceNodeId,
  pathTargetNodeId,
  pathResult,
  associationExplanation,
  onSearchQueryChange,
  onFocusNode,
  onPathSourceNodeChange,
  onPathTargetNodeChange,
}: {
  searchQuery: string;
  expanded: boolean;
  pathNodeOptions: ProjectMapNode[];
  pathSourceNodeId: string | null;
  pathTargetNodeId: string | null;
  pathResult: ProjectMapPathResult;
  associationExplanation: ProjectMapAssociationExplanation;
  onSearchQueryChange: (query: string) => void;
  onFocusNode: (nodeId: string | null) => void;
  onPathSourceNodeChange: (nodeId: string | null) => void;
  onPathTargetNodeChange: (nodeId: string | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <section
      className={cn("project-map-navigation-panel", !expanded && "is-collapsed")}
      aria-label={t("projectMap.navigation.title")}
    >
      {!expanded ? null : (
        <>
      <div className="project-map-navigation-card project-map-search-card">
        <header>
          <Search aria-hidden />
          <div>
            <h4>{t("projectMap.navigation.search.title")}</h4>
            <p>{t("projectMap.navigation.search.subtitle")}</p>
          </div>
        </header>
        <label className="project-map-search-input">
          <span>{t("projectMap.navigation.search.label")}</span>
          <input
            value={searchQuery}
            placeholder={t("projectMap.navigation.search.placeholder")}
            onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          />
        </label>
      </div>

      <div className="project-map-navigation-card">
        <header>
          <Route aria-hidden />
          <div>
            <h4>{t("projectMap.navigation.path.title")}</h4>
            <p>{t("projectMap.navigation.path.subtitle")}</p>
          </div>
        </header>
        <div className="project-map-path-controls">
          <label>
            <span>{t("projectMap.navigation.path.source")}</span>
            <select
              value={pathSourceNodeId ?? ""}
              onChange={(event) => onPathSourceNodeChange(event.currentTarget.value || null)}
            >
              {pathNodeOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("projectMap.navigation.path.target")}</span>
            <select
              value={pathTargetNodeId ?? ""}
              onChange={(event) => onPathTargetNodeChange(event.currentTarget.value || null)}
            >
              {pathNodeOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={cn("project-map-path-result", `is-${pathResult.status}`)}>
          <p>{pathResult.message}</p>
          {pathResult.steps.length > 0 ? (
            <ol>
              {pathResult.steps.map((step, index) => (
                <li key={`${step.node.id}-${index}`}>
                  <button type="button" onClick={() => onFocusNode(step.node.id)}>
                    {step.node.title}
                  </button>
                  <span>
                    {step.via === "relation" ? (
                      <>
                        {step.relation?.label ?? step.relation?.type ?? t("projectMap.navigation.path.relation")}
                        {step.relation ? (
                          <em>
                            {t("projectMap.navigation.path.relationMeta", {
                              type: step.relation.type,
                              sourceKind: step.relation.sourceKind,
                            })}
                          </em>
                        ) : null}
                      </>
                    ) : step.via === "hierarchy" ? (
                      t("projectMap.navigation.path.hierarchy")
                    ) : (
                      t("projectMap.navigation.path.self")
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {associationExplanation.status === "found" && associationExplanation.reasons.length > 0 ? (
            <details className="project-map-path-explanation">
              <summary>{t("projectMap.navigation.path.explain")}</summary>
              <ul>
                {associationExplanation.reasons.slice(0, 6).map((reason, index) => (
                  <li
                    key={`${reason.relationId ?? reason.label}:${index}`}
                    className={cn(reason.degraded && "is-degraded")}
                  >
                    <strong>{reason.label}</strong>
                    <span>
                      {t("projectMap.navigation.path.reasonMeta", {
                        confidence: t(`projectMap.confidence.${reason.confidence}`),
                        evidence: reason.evidenceCount,
                        sourceKind: reason.sourceKind ?? t("projectMap.navigation.path.hierarchy"),
                      })}
                      {reason.stale ? ` · ${t("projectMap.relations.stale")}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : associationExplanation.status === "not-found" ? (
            <p className="project-map-path-explanation-empty">
              {t("projectMap.navigation.path.noExplanation")}
            </p>
          ) : null}
        </div>
      </div>
        </>
      )}
    </section>
  );
}
