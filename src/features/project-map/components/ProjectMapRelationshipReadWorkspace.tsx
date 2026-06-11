import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import { useTranslation } from "react-i18next";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import MapPin from "lucide-react/dist/esm/icons/map-pin";

import { cn } from "../../../lib/utils";
import { readWorkspaceFilePreview } from "../../../services/tauri";
import type { ProjectMapRelationshipDashboardData } from "../utils/relationshipDashboardModel";
import {
  buildProjectMapReadMethodCards,
  buildProjectMapReadRelationCard,
  buildProjectMapReadRelationFlowNodes,
  formatProjectMapReadPathEvidence,
  getProjectMapReadPathBasename,
  isProjectMapReadAnatomyRelation,
  isProjectMapReadVerifyRelation,
  READ_ANATOMY_MAX_INCOMING,
  READ_ANATOMY_MAX_OUTGOING,
  READ_ANATOMY_MAX_VERIFY,
  sortProjectMapReadRelations,
  type ProjectMapRelationshipDashboardViewMode,
  type ProjectMapRelationshipReadMethodCard,
  type ProjectMapRelationshipReadRelationCard,
  type ProjectMapRelationshipRelationGroup,
} from "./projectMapRelationshipReadModel";
import type {
  ProjectMapFileRelation,
  ProjectMapScannedFile,
} from "../types";

type ProjectMapRelationshipReadWorkspaceProps = {
  activeWorkspaceId: string | null;
  inspectedRelationshipFile: ProjectMapScannedFile | null;
  openProjectMapRelationshipPath: (path: string | null | undefined, line?: number | null) => void;
  relationshipDashboardData: ProjectMapRelationshipDashboardData;
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
  relationshipDashboardModuleByFileId: ReadonlyMap<string, string>;
  selectedRelationshipRelation: ProjectMapFileRelation | null;
  selectedRelationshipRelationGroups: ProjectMapRelationshipRelationGroup[];
  setRelationshipDashboardViewMode: (value: ProjectMapRelationshipDashboardViewMode) => void;
};

export function ProjectMapRelationshipReadWorkspace({
  activeWorkspaceId,
  inspectedRelationshipFile,
  openProjectMapRelationshipPath,
  relationshipDashboardData,
  relationshipDashboardFileIndex,
  relationshipDashboardModuleByFileId,
  selectedRelationshipRelation,
  selectedRelationshipRelationGroups,
  setRelationshipDashboardViewMode,
}: ProjectMapRelationshipReadWorkspaceProps) {
  const { t } = useTranslation();
  const [selectedReadMethodId, setSelectedReadMethodId] = useState<string | null>(null);
  const [readSourceContent, setReadSourceContent] = useState<string | null>(null);
  const [readSourceError, setReadSourceError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setReadSourceContent(null);
    setReadSourceError(null);
    if (!activeWorkspaceId || !inspectedRelationshipFile) {
      return () => {
        cancelled = true;
      };
    }
    readWorkspaceFilePreview(activeWorkspaceId, inspectedRelationshipFile.path)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setReadSourceContent(response.content);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setReadSourceError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, inspectedRelationshipFile]);
  const relatedRelations = useMemo(() => {
    if (!inspectedRelationshipFile) {
      return [];
    }
    return relationshipDashboardData.relations
      .filter((relation) => (
        relation.sourceFileId === inspectedRelationshipFile.id
        || relation.targetFileId === inspectedRelationshipFile.id
      ))
      .sort(sortProjectMapReadRelations);
  }, [inspectedRelationshipFile, relationshipDashboardData.relations]);
  const incomingReadCards = useMemo(() => {
    if (!inspectedRelationshipFile) {
      return [];
    }
    return relatedRelations
      .filter((relation) => (
        relation.targetFileId === inspectedRelationshipFile.id
        && isProjectMapReadAnatomyRelation(relation)
      ))
      .slice(0, READ_ANATOMY_MAX_INCOMING)
      .map((relation) => buildProjectMapReadRelationCard({
        relation,
        lane: "incoming",
        inspectedFile: inspectedRelationshipFile,
        relationshipDashboardFileIndex,
      }));
  }, [inspectedRelationshipFile, relatedRelations, relationshipDashboardFileIndex]);
  const outgoingReadCards = useMemo(() => {
    if (!inspectedRelationshipFile) {
      return [];
    }
    return relatedRelations
      .filter((relation) => (
        relation.sourceFileId === inspectedRelationshipFile.id
        && isProjectMapReadAnatomyRelation(relation)
      ))
      .slice(0, READ_ANATOMY_MAX_OUTGOING)
      .map((relation) => buildProjectMapReadRelationCard({
        relation,
        lane: "outgoing",
        inspectedFile: inspectedRelationshipFile,
        relationshipDashboardFileIndex,
      }));
  }, [inspectedRelationshipFile, relatedRelations, relationshipDashboardFileIndex]);
  const verifyReadCards = useMemo(() => {
    if (!inspectedRelationshipFile) {
      return [];
    }
    return relatedRelations
      .filter(isProjectMapReadVerifyRelation)
      .slice(0, READ_ANATOMY_MAX_VERIFY)
      .map((relation) => buildProjectMapReadRelationCard({
        relation,
        lane: "verify",
        inspectedFile: inspectedRelationshipFile,
        relationshipDashboardFileIndex,
      }));
  }, [inspectedRelationshipFile, relatedRelations, relationshipDashboardFileIndex]);
  const readMethodCards = useMemo((): ProjectMapRelationshipReadMethodCard[] => {
    if (!inspectedRelationshipFile) {
      return [];
    }
    return buildProjectMapReadMethodCards({
      inspectedFile: inspectedRelationshipFile,
      readSourceContent,
      relatedRelations,
      relationshipDashboardData,
      relationshipDashboardFileIndex,
      formatFallbackLine: (line) => t("projectMap.relationship.readMethodFallbackLine", { line }),
    });
  }, [
    inspectedRelationshipFile,
    relatedRelations,
    readSourceContent,
    relationshipDashboardData,
    relationshipDashboardFileIndex,
    t,
  ]);
  useEffect(() => {
    setSelectedReadMethodId(readMethodCards[0]?.id ?? null);
  }, [inspectedRelationshipFile?.id, readMethodCards]);
  const selectedReadMethod = readMethodCards.find((methodCard) => methodCard.id === selectedReadMethodId)
    ?? readMethodCards[0]
    ?? null;
  const readPathFileCount = useMemo(() => {
    const pathSet = new Set<string>();
    for (const card of [...incomingReadCards, ...outgoingReadCards, ...verifyReadCards]) {
      pathSet.add(card.path);
    }
    return pathSet.size + (inspectedRelationshipFile ? 1 : 0);
  }, [incomingReadCards, inspectedRelationshipFile, outgoingReadCards, verifyReadCards]);
  const renderReadRelationCard = (card: ProjectMapRelationshipReadRelationCard): ReactElement => (
    <article
      key={card.id}
      className={cn(
        "project-map-relationship-read-relation-card",
        `is-lane-${card.lane}`,
        selectedRelationshipRelation?.id === card.relation.id && "is-active",
      )}
      title={`${card.title} · ${formatProjectMapReadPathEvidence(card.relation)}`}
    >
      <header>
        <strong>{card.file?.basename ?? getProjectMapReadPathBasename(card.path)}</strong>
        <span>{card.relation.type}</span>
      </header>
      <div>
        <button
          type="button"
          className="project-map-relationship-read-action"
          onClick={() => openProjectMapRelationshipPath(card.path)}
        >
          <ExternalLink aria-hidden="true" />
          {t("projectMap.relationship.readOpenFile")}
        </button>
        <button
          type="button"
          className="project-map-relationship-read-action"
          onClick={() => openProjectMapRelationshipPath(card.evidencePath, card.evidenceLine)}
        >
          <MapPin aria-hidden="true" />
          {t("projectMap.relationship.readOpenEvidence")}
        </button>
      </div>
    </article>
  );

  return (
    <div className="project-map-relationship-read-workspace">
      <section className="project-map-relationship-read-main">
        <header className="project-map-relationship-workspace-header">
          <div>
            <strong>{t("projectMap.relationship.readWorkspaceTitle")}</strong>
            <span>
              {inspectedRelationshipFile
                ? inspectedRelationshipFile.path
                : t("projectMap.relationship.readWorkspaceEmpty")}
            </span>
          </div>
          <button
            type="button"
            className="project-map-toolbar-action"
            onClick={() => setRelationshipDashboardViewMode("graph")}
          >
            {t("projectMap.relationship.openGraph")}
          </button>
        </header>
        {inspectedRelationshipFile ? (
          <article className="project-map-relationship-read-hero">
            <div>
              <span>{t("projectMap.relationship.readMissionTitle")}</span>
              <strong>{inspectedRelationshipFile.basename}</strong>
              <p>{t("projectMap.relationship.readMissionBody", {
                path: inspectedRelationshipFile.path,
              })}</p>
            </div>
            <dl>
              <div>
                <dt>{t("projectMap.relationship.readMetricFiles")}</dt>
                <dd>{readPathFileCount}</dd>
              </div>
              <div>
                <dt>{t("projectMap.relationship.readMetricRelations")}</dt>
                <dd>{selectedRelationshipRelationGroups.reduce((count, group) => count + group.relations.length, 0)}</dd>
              </div>
              <div>
                <dt>{t("projectMap.relationship.readMetricMethods")}</dt>
                <dd>{readMethodCards.length}</dd>
              </div>
            </dl>
          </article>
        ) : null}
        <section className="project-map-relationship-read-anatomy">
          <header>
            <span>{t("projectMap.relationship.readAnatomyEyebrow")}</span>
            <strong>{t("projectMap.relationship.readAnatomyTitle")}</strong>
            <p>{t("projectMap.relationship.readAnatomyHint")}</p>
          </header>
          {inspectedRelationshipFile ? (
            <>
              <div className="project-map-relationship-read-anatomy-graph">
                <section className="project-map-relationship-read-lane is-incoming">
                  <h5>{t("projectMap.relationship.readIncomingTitle")}</h5>
                  {incomingReadCards.length ? incomingReadCards.map(renderReadRelationCard) : (
                    <p className="project-map-relationship-empty">{t("projectMap.relationship.readIncomingEmpty")}</p>
                  )}
                </section>
                <article className="project-map-relationship-read-current-file">
                  <span>{t("projectMap.relationship.readCurrentFile")}</span>
                  <strong>{inspectedRelationshipFile.basename}</strong>
                  <p>{inspectedRelationshipFile.path}</p>
                  <div>
                    <em>{inspectedRelationshipFile.role}</em>
                    <em>{inspectedRelationshipFile.language}</em>
                    <em>{relationshipDashboardModuleByFileId.get(inspectedRelationshipFile.id) ?? inspectedRelationshipFile.layer}</em>
                  </div>
                  <button
                    type="button"
                    className="project-map-relationship-read-action"
                    onClick={() => openProjectMapRelationshipPath(inspectedRelationshipFile.path)}
                  >
                    <ExternalLink aria-hidden="true" />
                    {t("projectMap.relationship.readOpenCurrentFile")}
                  </button>
                </article>
                <section className="project-map-relationship-read-lane is-outgoing">
                  <h5>{t("projectMap.relationship.readOutgoingTitle")}</h5>
                  {outgoingReadCards.length ? outgoingReadCards.map(renderReadRelationCard) : (
                    <p className="project-map-relationship-empty">{t("projectMap.relationship.readOutgoingEmpty")}</p>
                  )}
                </section>
              </div>
              {verifyReadCards.length ? (
                <div className="project-map-relationship-read-verify-row">
                  <strong>{t("projectMap.relationship.readVerifyTitle")}</strong>
                  {verifyReadCards.map(renderReadRelationCard)}
                </div>
              ) : null}
            </>
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.readRouteEmpty")}
            </p>
          )}
        </section>
        <section className="project-map-relationship-read-methods">
          <header>
            <span>{t("projectMap.relationship.readMethodEyebrow")}</span>
            <strong>{t("projectMap.relationship.readMethodTitle")}</strong>
            <p>{t("projectMap.relationship.readMethodHint")}</p>
          </header>
          {readMethodCards.length && selectedReadMethod ? (
            <div className="project-map-relationship-read-method-grid">
              <nav aria-label={t("projectMap.relationship.readMethodTitle")}>
                {readMethodCards.map((methodCard) => (
                  <button
                    key={methodCard.id}
                    type="button"
                    className={cn(
                      "project-map-relationship-read-method-tab",
                      selectedReadMethod.id === methodCard.id && "is-active",
                    )}
                    onClick={() => setSelectedReadMethodId(methodCard.id)}
                  >
                    <strong>{methodCard.name}</strong>
                    <span>
                      {methodCard.kind}
                      {methodCard.line ? ` · L${methodCard.line}` : ""}
                      {" · "}
                      {methodCard.outgoing.length}{t("projectMap.relationship.readMethodCallsOut")}
                    </span>
                  </button>
                ))}
              </nav>
              <article className="project-map-relationship-read-method-chain">
                <header>
                  <div>
                    <span>{t("projectMap.relationship.readMethodSelected")}</span>
                    <strong>{selectedReadMethod.name}</strong>
                    <p>
                      {selectedReadMethod.incoming.length}{t("projectMap.relationship.readMethodIncoming")}
                      {" · "}
                      {selectedReadMethod.outgoing.length}{t("projectMap.relationship.readMethodOutgoing")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="project-map-relationship-read-action"
                    onClick={() => {
                      if (inspectedRelationshipFile) {
                        openProjectMapRelationshipPath(inspectedRelationshipFile.path, selectedReadMethod.line);
                      }
                    }}
                  >
                    <MapPin aria-hidden="true" />
                    {t("projectMap.relationship.readOpenMethod")}
                  </button>
                </header>
                <ol className="project-map-relationship-read-method-flow">
                  <li className="is-start">
                    <article>
                      <span>{t("projectMap.relationship.readFlowStart")}</span>
                      <strong>{selectedReadMethod.name}</strong>
                      <button
                        type="button"
                        className="project-map-relationship-read-action"
                        onClick={() => {
                          if (inspectedRelationshipFile) {
                            openProjectMapRelationshipPath(inspectedRelationshipFile.path, selectedReadMethod.line);
                          }
                        }}
                      >
                        <MapPin aria-hidden="true" />
                        {t("projectMap.relationship.readOpenMethod")}
                      </button>
                    </article>
                  </li>
                  {(selectedReadMethod.sourceFlowNodes.length
                    ? selectedReadMethod.sourceFlowNodes
                    : buildProjectMapReadRelationFlowNodes({
                        inspectedFile: inspectedRelationshipFile,
                        outgoingRelations: selectedReadMethod.outgoing,
                        relationshipDashboardFileIndex,
                      })).map((flowNode, index) => {
                    return (
                      <li key={`flow:${flowNode.id}`}>
                        <article>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{flowNode.label}</strong>
                          <div>
                            <button
                              type="button"
                              className="project-map-relationship-read-action"
                              onClick={() => openProjectMapRelationshipPath(flowNode.path)}
                            >
                              <ExternalLink aria-hidden="true" />
                              {t("projectMap.relationship.readOpenFile")}
                            </button>
                            <button
                              type="button"
                              className="project-map-relationship-read-action"
                              onClick={() => openProjectMapRelationshipPath(flowNode.path, flowNode.line)}
                            >
                              <MapPin aria-hidden="true" />
                              {t("projectMap.relationship.readOpenEvidence")}
                            </button>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                  <li className="is-end">
                    <article>
                      <span>{t("projectMap.relationship.readFlowEnd")}</span>
                      <strong>{t("projectMap.relationship.readFlowReturn")}</strong>
                    </article>
                  </li>
                </ol>
                {selectedReadMethod.sourceSnippet.length ? (
                  <pre className="project-map-relationship-read-method-snippet">
                    <code>
                      {selectedReadMethod.sourceSnippet
                        .map((line, index) => `${String((selectedReadMethod.line ?? 1) + index).padStart(4, " ")}  ${line}`)
                        .join("\n")}
                    </code>
                  </pre>
                ) : readSourceError ? (
                  <p className="project-map-relationship-empty">
                    {t("projectMap.relationship.readSourceUnavailable", { message: readSourceError })}
                  </p>
                ) : null}
              </article>
            </div>
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.readMethodEmpty")}
            </p>
          )}
        </section>
      </section>
    </div>
  );
}
