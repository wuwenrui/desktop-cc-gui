import { type ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../../lib/utils";
import type {
  ProjectMapApiInspectorPathOpener,
  ProjectMapApiMethodChainTreeNode,
} from "./ProjectMapRelationshipApiTypes";
import type {
  ProjectMapApiCallChain,
  ProjectMapApiEndpoint,
} from "../types";

type ProjectMapRelationshipApiMethodChainSectionProps = {
  openApiInspectorPath: ProjectMapApiInspectorPathOpener;
  selectedApiCallChains: ProjectMapApiCallChain[];
  selectedApiEndpoint: ProjectMapApiEndpoint;
  selectedApiMethodChainTrees: ProjectMapApiMethodChainTree[];
};

export type ProjectMapApiMethodChainTree = {
  chain: ProjectMapApiCallChain;
  roots: ProjectMapApiMethodChainTreeNode[];
};

const API_METHOD_CHAIN_MAX_TREE_DEPTH = 5;
const API_METHOD_CHAIN_MAX_RENDERED_NODES = 32;

export function buildProjectMapApiMethodChainTree(
  chain: ProjectMapApiCallChain,
  rootSymbol: string | null | undefined,
): ProjectMapApiMethodChainTreeNode[] {
  const childrenBySource = new Map<string, ProjectMapApiCallChain["edges"]>();
  const targetSymbols = new Set<string>();
  for (const edge of chain.edges) {
    const children = childrenBySource.get(edge.sourceSymbol) ?? [];
    children.push(edge);
    childrenBySource.set(edge.sourceSymbol, children);
    targetSymbols.add(edge.targetSymbol);
  }
  const roots = rootSymbol
    ? [rootSymbol]
    : Array.from(childrenBySource.keys()).filter((symbol) => !targetSymbols.has(symbol));
  const fallbackRoots = roots.length ? roots : chain.edges[0] ? [chain.edges[0].sourceSymbol] : [];
  let renderedCount = 0;
  const visit = (
    symbol: string,
    incomingEdge: ProjectMapApiCallChain["edges"][number] | undefined,
    depth: number,
    path: Set<string>,
  ): ProjectMapApiMethodChainTreeNode => {
    renderedCount += 1;
    if (
      depth >= API_METHOD_CHAIN_MAX_TREE_DEPTH
      || renderedCount >= API_METHOD_CHAIN_MAX_RENDERED_NODES
      || path.has(symbol)
    ) {
      return { symbol, incomingEdge, children: [] };
    }
    const nextPath = new Set(path);
    nextPath.add(symbol);
    const children = (childrenBySource.get(symbol) ?? [])
      .slice(0, 8)
      .map((edge) => visit(edge.targetSymbol, edge, depth + 1, nextPath));
    return { symbol, incomingEdge, children };
  };
  return fallbackRoots.map((symbol) => visit(symbol, undefined, 0, new Set()));
}

export function ProjectMapRelationshipApiMethodChainSection({
  openApiInspectorPath,
  selectedApiCallChains,
  selectedApiEndpoint,
  selectedApiMethodChainTrees,
}: ProjectMapRelationshipApiMethodChainSectionProps) {
  const { t } = useTranslation();

  const renderApiMethodChainNode = (
    node: ProjectMapApiMethodChainTreeNode,
    depth: number,
  ): ReactElement => {
    const edge = node.incomingEdge;
    const edgeLocationLabel = edge ? `${edge.sourceFile}${edge.line ? `:${edge.line}` : ""}` : null;
    const edgeTargetLocationLabel = edge?.targetFile
      ? `${edge.targetFile}${edge.targetLine ? `:${edge.targetLine}` : ""}`
      : null;
    return (
      <li
        key={`${node.symbol}:${edge?.id ?? "root"}`}
        className={cn(
          "project-map-api-method-tree-node",
          depth === 0 && "is-root",
          edge && !edge.targetFile && "is-unresolved",
        )}
      >
        <div className="project-map-api-method-tree-card">
          <div className="project-map-api-method-tree-card-main">
            <strong>{node.symbol}</strong>
            {edge ? (
              <span>{edge.kind} · {edge.confidence}</span>
            ) : (
              <span>{selectedApiEndpoint.method ?? selectedApiEndpoint.protocol ?? "endpoint"}</span>
            )}
          </div>
          {edge ? (
            <div className="project-map-api-method-tree-anchors">
              {edgeLocationLabel ? (
                <button
                  type="button"
                  onClick={() => openApiInspectorPath(edge.sourceFile, edge.line)}
                  aria-label={edge.line
                    ? t("projectMap.relationship.sourceOpenFileAtLine", {
                        path: edge.sourceFile,
                        line: edge.line,
                      })
                    : t("projectMap.relationship.sourceOpenFile", {
                        path: edge.sourceFile,
                      })}
                >
                  call · {edgeLocationLabel}
                </button>
              ) : null}
              {edgeTargetLocationLabel && edge.targetFile ? (
                <button
                  type="button"
                  className="is-target"
                  onClick={() => openApiInspectorPath(edge.targetFile, edge.targetLine)}
                  aria-label={edge.targetLine
                    ? t("projectMap.relationship.sourceOpenFileAtLine", {
                        path: edge.targetFile,
                        line: edge.targetLine,
                      })
                    : t("projectMap.relationship.sourceOpenFile", {
                        path: edge.targetFile,
                      })}
                >
                  def · {edgeTargetLocationLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          {edge?.excerpt ? (
            <button
              type="button"
              className="project-map-api-method-tree-excerpt"
              onClick={() => openApiInspectorPath(edge.sourceFile, edge.line)}
              aria-label={edge.line
                ? t("projectMap.relationship.sourceOpenFileAtLine", {
                    path: edge.sourceFile,
                    line: edge.line,
                  })
                : t("projectMap.relationship.sourceOpenFile", {
                    path: edge.sourceFile,
                  })}
            >
              <code>{edge.excerpt}</code>
            </button>
          ) : null}
        </div>
        {node.children.length ? (
          <ol>
            {node.children.map((child) => renderApiMethodChainNode(child, depth + 1))}
          </ol>
        ) : null}
      </li>
    );
  };

  return (
    <section className="project-map-api-contract-inspector-section">
      <h5>{t("projectMap.relationship.apiMethodChainTitle")}</h5>
      {selectedApiCallChains.length ? (
        <div className="project-map-api-contract-method-chain-list">
          {selectedApiMethodChainTrees.map(({ chain, roots }) => (
            <article key={chain.id} className="project-map-api-method-tree">
              {chain.truncatedReason ? (
                <span className="project-map-api-contract-method-chain-warning">
                  {t("projectMap.relationship.apiMethodChainTruncated", {
                    reason: chain.truncatedReason,
                  })}
                </span>
              ) : null}
              <ol className="project-map-api-method-tree-roots">
                {roots.map((root) => renderApiMethodChainNode(root, 0))}
              </ol>
            </article>
          ))}
        </div>
      ) : (
        <p>
          {selectedApiEndpoint.callChainUnavailableReason
            ? t("projectMap.relationship.apiMethodChainUnavailable", {
                reason: selectedApiEndpoint.callChainUnavailableReason,
              })
            : t("projectMap.relationship.apiMethodChainEmpty")}
        </p>
      )}
    </section>
  );
}
