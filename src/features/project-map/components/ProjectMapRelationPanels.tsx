import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";
import type {
  ProjectMapIndexedRelation,
  ProjectMapNodeRelationBucket,
  ProjectMapRelationDirectionFilter,
  ProjectMapRelationIndex,
} from "../utils/relationIndex";
import type { ProjectMapNode } from "../types";

const PROJECT_MAP_RELATION_FILTER_ALL = "all";

export type ProjectMapHierarchyRelationView = {
  id: string;
  parent: ProjectMapNode;
  child: ProjectMapNode;
};

export function ProjectMapRelationLegendPanel({
  relationIndex,
  hierarchyRelations,
  hierarchyRelationTotalCount,
  expanded,
  typeFilter,
  sourceKindFilter,
  directionFilter,
  typeOptions,
  sourceKindOptions,
  selectedNodeId,
  onTypeFilterChange,
  onSourceKindFilterChange,
  onDirectionFilterChange,
  onClearSelectedRelation,
  onFocusNode,
}: {
  relationIndex: ProjectMapRelationIndex;
  hierarchyRelations: ProjectMapHierarchyRelationView[];
  hierarchyRelationTotalCount: number;
  expanded: boolean;
  typeFilter: string;
  sourceKindFilter: string;
  directionFilter: ProjectMapRelationDirectionFilter;
  typeOptions: string[];
  sourceKindOptions: string[];
  selectedNodeId: string | null;
  onTypeFilterChange: (value: string) => void;
  onSourceKindFilterChange: (value: string) => void;
  onDirectionFilterChange: (value: ProjectMapRelationDirectionFilter) => void;
  onClearSelectedRelation: () => void;
  onFocusNode: (nodeId: string) => void;
}) {
  const { t } = useTranslation();
  const hasHierarchyRelations = hierarchyRelationTotalCount > 0;

  return (
    <section className={cn("project-map-relation-legend-panel", !expanded && "is-collapsed")}>
      {!expanded ? null : (
        <>
      {hasHierarchyRelations ? (
        <p className="project-map-relation-hierarchy-summary">
          {t("projectMap.relations.hierarchySummary", {
            count: hierarchyRelationTotalCount,
            typed: relationIndex.relations.length,
          })}
        </p>
      ) : null}
      <div className="project-map-relation-filters">
        <label>
          <span>{t("projectMap.relations.typeFilter")}</span>
          <select
            value={typeFilter}
            aria-label={t("projectMap.relations.typeFilter")}
            onChange={(event) => onTypeFilterChange(event.currentTarget.value)}
          >
            <option value={PROJECT_MAP_RELATION_FILTER_ALL}>
              {t("projectMap.relations.allTypes")}
            </option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
            {hasHierarchyRelations ? (
              <option value="hierarchy">{t("projectMap.relations.hierarchyType")}</option>
            ) : null}
          </select>
        </label>
        <label>
          <span>{t("projectMap.relations.sourceKindFilter")}</span>
          <select
            value={sourceKindFilter}
            aria-label={t("projectMap.relations.sourceKindFilter")}
            onChange={(event) => onSourceKindFilterChange(event.currentTarget.value)}
          >
            <option value={PROJECT_MAP_RELATION_FILTER_ALL}>
              {t("projectMap.relations.allSourceKinds")}
            </option>
            {sourceKindOptions.map((sourceKind) => (
              <option key={sourceKind} value={sourceKind}>
                {sourceKind}
              </option>
            ))}
            {hasHierarchyRelations ? (
              <option value="map-tree">{t("projectMap.relations.mapTreeSourceKind")}</option>
            ) : null}
          </select>
        </label>
        <label>
          <span>{t("projectMap.relations.directionFilter")}</span>
          <select
            value={directionFilter}
            disabled={!selectedNodeId}
            aria-label={t("projectMap.relations.directionFilter")}
            onChange={(event) =>
              onDirectionFilterChange(event.currentTarget.value as ProjectMapRelationDirectionFilter)
            }
          >
            <option value="all">{t("projectMap.relations.allDirections")}</option>
            <option value="incoming">{t("projectMap.relations.incoming")}</option>
            <option value="outgoing">{t("projectMap.relations.outgoing")}</option>
          </select>
        </label>
        <button type="button" onClick={onClearSelectedRelation}>
          {t("projectMap.relations.clearSelection")}
        </button>
      </div>
      {relationIndex.typeCounts.length > 0 ? (
        <div className="project-map-relation-type-counts">
          {hasHierarchyRelations ? (
            <button
              key="hierarchy"
              type="button"
              className={cn(typeFilter === "hierarchy" && "is-active")}
              onClick={() =>
                onTypeFilterChange(typeFilter === "hierarchy" ? PROJECT_MAP_RELATION_FILTER_ALL : "hierarchy")
              }
            >
              <span>{t("projectMap.relations.hierarchyType")}</span>
              <em>{hierarchyRelationTotalCount}</em>
            </button>
          ) : null}
          {relationIndex.typeCounts.slice(0, 8).map((item) => (
            <button
              key={item.key}
              type="button"
              className={cn(typeFilter === item.key && "is-active")}
              onClick={() =>
                onTypeFilterChange(typeFilter === item.key ? PROJECT_MAP_RELATION_FILTER_ALL : item.key)
              }
            >
              <span>{item.key}</span>
              <em>{item.count}</em>
            </button>
          ))}
        </div>
      ) : (
        <>
          {hasHierarchyRelations ? (
            <div className="project-map-relation-type-counts">
              <button
                type="button"
                className={cn(typeFilter === "hierarchy" && "is-active")}
                onClick={() =>
                  onTypeFilterChange(typeFilter === "hierarchy" ? PROJECT_MAP_RELATION_FILTER_ALL : "hierarchy")
                }
              >
                <span>{t("projectMap.relations.hierarchyType")}</span>
                <em>{hierarchyRelationTotalCount}</em>
              </button>
            </div>
          ) : null}
          <p className="project-map-relation-empty">
            {hasHierarchyRelations
              ? t("projectMap.relations.noTypedRelations")
              : t("projectMap.relations.empty")}
          </p>
        </>
      )}
      {hierarchyRelations.length > 0 ? (
        <div className="project-map-hierarchy-relation-list" role="list">
          {hierarchyRelations.slice(0, 16).map((relation) => (
            <div key={relation.id} className="project-map-hierarchy-relation-row" role="listitem">
              <span>{t("projectMap.relations.hierarchyType")}</span>
              <button type="button" onClick={() => onFocusNode(relation.parent.id)}>
                {relation.parent.title}
              </button>
              <em>→</em>
              <button type="button" onClick={() => onFocusNode(relation.child.id)}>
                {relation.child.title}
              </button>
            </div>
          ))}
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}

export function ProjectMapRelationInspector({
  bucket,
  selectedRelationId,
  onFocusNode,
  onSelectRelation,
}: {
  bucket: ProjectMapNodeRelationBucket | null;
  selectedRelationId: string | null;
  onFocusNode: (nodeId: string) => void;
  onSelectRelation: (relationId: string) => void;
}) {
  const { t } = useTranslation();
  const incoming = bucket?.incoming ?? [];
  const outgoing = bucket?.outgoing ?? [];

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <section className="project-map-relation-inspector">
        <header className="project-map-relation-inspector-head">
          <h4>{t("projectMap.relations.inspectorTitle")}</h4>
          <p>{t("projectMap.relations.noNodeRelations")}</p>
        </header>
      </section>
    );
  }

  return (
    <section className="project-map-relation-inspector">
      <header className="project-map-relation-inspector-head">
        <h4>{t("projectMap.relations.inspectorTitle")}</h4>
        <p>
          {t("projectMap.relations.inspectorSummary", {
            defaultValue: "{{outgoing}} outgoing · {{incoming}} incoming",
            outgoing: outgoing.length,
            incoming: incoming.length,
          })}
        </p>
      </header>
      <ProjectMapRelationGroup
        title={t("projectMap.relations.outgoing")}
        relations={outgoing}
        selectedRelationId={selectedRelationId}
        endpointKind="target"
        onFocusNode={onFocusNode}
        onSelectRelation={onSelectRelation}
      />
      <ProjectMapRelationGroup
        title={t("projectMap.relations.incoming")}
        relations={incoming}
        selectedRelationId={selectedRelationId}
        endpointKind="source"
        onFocusNode={onFocusNode}
        onSelectRelation={onSelectRelation}
      />
    </section>
  );
}

export function ProjectMapRelationGroup({
  title,
  relations,
  selectedRelationId,
  endpointKind,
  onFocusNode,
  onSelectRelation,
}: {
  title: string;
  relations: ProjectMapIndexedRelation[];
  selectedRelationId: string | null;
  endpointKind: "source" | "target";
  onFocusNode: (nodeId: string) => void;
  onSelectRelation: (relationId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="project-map-relation-group">
      <strong>
        {title} <span>{relations.length}</span>
      </strong>
      {relations.length === 0 ? (
        <p>{t("projectMap.relations.noRelationsInGroup")}</p>
      ) : (
        <ul>
          {relations.slice(0, 8).map((indexedRelation) => {
            const endpoint = indexedRelation[endpointKind];
            const relation = indexedRelation.relation;
            return (
              <li
                key={`${title}:${relation.id}:${endpointKind}`}
                className={cn(
                  selectedRelationId === relation.id && "is-selected",
                  indexedRelation.degraded && "is-degraded",
                )}
              >
                <button
                  className="project-map-relation-select-button"
                  type="button"
                  onClick={() => onSelectRelation(relation.id)}
                >
                  <span>{relation.label ?? relation.type}</span>
                  <em>
                    {relation.sourceKind} · {relation.confidence}
                    {relation.stale ? ` · ${t("projectMap.relations.stale")}` : ""}
                  </em>
                </button>
                {endpoint.node ? (
                  <button
                    className="project-map-relation-endpoint-button"
                    type="button"
                    onClick={() => onFocusNode(endpoint.nodeId)}
                  >
                    <span>{endpoint.node.title}</span>
                    <em>{t("projectMap.relations.focusEndpoint", { defaultValue: "Focus node" })}</em>
                  </button>
                ) : (
                  <span>{t("projectMap.relations.missingEndpoint", { nodeId: endpoint.nodeId })}</span>
                )}
                {relation.evidence.length > 0 ? (
                  <small className="project-map-relation-evidence-count">
                    {t("projectMap.relations.evidenceCount", { count: relation.evidence.length })}
                  </small>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
