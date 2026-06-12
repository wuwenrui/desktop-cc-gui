import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import {
  buildTree,
  type FileTreeNode,
} from "../files/components/fileTreePanelInternals";
import type { WorkspaceDirectoryEntry } from "../../services/tauri";
import { fileBasename, type SessionFileActivity } from "./turnEvidence";

/**
 * casebar 文件视图下区：完整工作区文件树（只读轻量版）。
 * 与右栏 FileTreePanel 共用 buildTree，但不带预览/拖拽/重命名等重交互；
 * 本会话碰过的文件按路径后缀匹配打热度标记（橙=改动 / 蓝=引用），
 * 其祖先目录默认展开，让律师一眼看到「AI 在案卷的哪个角落动了手」。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit（文件双区增量）。新增文件（fork-friendly）。
 */

const EMPTY_LAZY_DIRECTORIES = new Set<string>();
const EMPTY_DIRECTORY_METADATA = new Map<string, WorkspaceDirectoryEntry>();

/**
 * 树是工作区相对路径，活动是引擎工具调用里的绝对路径——
 * 按 basename 分桶后用「相等或以 /相对路径 结尾」匹配，免去穿 workspacePath。
 */
function buildHeatIndex(
  files: string[],
  activities: ReadonlyArray<SessionFileActivity>,
): Map<string, SessionFileActivity> {
  const heat = new Map<string, SessionFileActivity>();
  if (activities.length === 0 || files.length === 0) {
    return heat;
  }
  const byBasename = new Map<string, string[]>();
  for (const file of files) {
    const name = fileBasename(file);
    const bucket = byBasename.get(name);
    if (bucket) {
      bucket.push(file);
    } else {
      byBasename.set(name, [file]);
    }
  }
  for (const activity of activities) {
    const normalized = activity.path.replace(/\\/g, "/");
    const candidates = byBasename.get(fileBasename(normalized)) ?? [];
    for (const file of candidates) {
      if (normalized !== file && !normalized.endsWith(`/${file}`)) {
        continue;
      }
      const prev = heat.get(file);
      heat.set(
        file,
        prev
          ? {
              path: file,
              reads: prev.reads + activity.reads,
              edits: prev.edits + activity.edits,
            }
          : { path: file, reads: activity.reads, edits: activity.edits },
      );
    }
  }
  return heat;
}

function collectAncestorFolders(paths: Iterable<string>): Set<string> {
  const result = new Set<string>();
  for (const path of paths) {
    const segments = path.split("/").filter(Boolean);
    let current = "";
    for (let i = 0; i < segments.length - 1; i += 1) {
      current = current ? `${current}/${segments[i]}` : segments[i];
      result.add(current);
    }
  }
  return result;
}

/** 搜索过滤：保留命中节点及其祖先；目录名命中时保留整棵子树。 */
function filterTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    const selfMatch = node.name.toLowerCase().includes(query);
    if (node.type === "file") {
      if (selfMatch) {
        result.push(node);
      }
      continue;
    }
    const children = filterTree(node.children, query);
    if (selfMatch && children.length === 0) {
      result.push(node);
    } else if (selfMatch || children.length > 0) {
      result.push({ ...node, children });
    }
  }
  return result;
}

function TreeRows({
  nodes,
  depth,
  isExpandedFolder,
  onToggleFolder,
  heatByPath,
  onOpenFile,
}: {
  nodes: FileTreeNode[];
  depth: number;
  isExpandedFolder: (path: string) => boolean;
  onToggleFolder: (path: string) => void;
  heatByPath: Map<string, SessionFileActivity>;
  onOpenFile?: (path: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {nodes.map((node) => {
        if (node.type === "folder") {
          const expanded = isExpandedFolder(node.path);
          return (
            <div key={node.path}>
              <button
                type="button"
                className="session-ws-row is-folder"
                style={{ paddingLeft: 10 + depth * 16 }}
                aria-expanded={expanded}
                onClick={() => onToggleFolder(node.path)}
              >
                <ChevronRight
                  size={13}
                  className={`session-ws-caret${expanded ? " is-open" : ""}`}
                  aria-hidden
                />
                <span className="session-ws-name">{node.name}</span>
              </button>
              {expanded && (
                <TreeRows
                  nodes={node.children}
                  depth={depth + 1}
                  isExpandedFolder={isExpandedFolder}
                  onToggleFolder={onToggleFolder}
                  heatByPath={heatByPath}
                  onOpenFile={onOpenFile}
                />
              )}
            </div>
          );
        }
        const heat = heatByPath.get(node.path);
        return (
          <button
            key={node.path}
            type="button"
            className="session-ws-row is-file"
            style={{ paddingLeft: 10 + depth * 16 }}
            title={node.path}
            onClick={() => onOpenFile?.(node.path)}
          >
            <span className="session-ws-name">{node.name}</span>
            {heat && heat.edits > 0 ? (
              <i className="session-ws-badge is-edit">
                {t("fanbox.casebar.editsBadge", { count: heat.edits })}
              </i>
            ) : heat && heat.reads > 0 ? (
              <i className="session-ws-badge is-read">
                {t("fanbox.casebar.readsBadge", { count: heat.reads })}
              </i>
            ) : null}
          </button>
        );
      })}
    </>
  );
}

export function SessionWorkspaceTree({
  files,
  directories,
  activities,
  onOpenFile,
}: {
  files: string[];
  directories: string[];
  activities: ReadonlyArray<SessionFileActivity>;
  onOpenFile?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  // 用户对单个目录的显式开合覆盖默认值（默认 = 热度文件的祖先展开）。
  const [userToggles, setUserToggles] = useState<Map<string, boolean>>(new Map());

  const { nodes, folderPaths } = useMemo(
    () => buildTree(files, directories, EMPTY_LAZY_DIRECTORIES, EMPTY_DIRECTORY_METADATA),
    [files, directories],
  );
  const heatByPath = useMemo(() => buildHeatIndex(files, activities), [files, activities]);
  const hotAncestors = useMemo(
    () => collectAncestorFolders(heatByPath.keys()),
    [heatByPath],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const visibleNodes = useMemo(
    () => (normalizedQuery ? filterTree(nodes, normalizedQuery) : nodes),
    [nodes, normalizedQuery],
  );

  const isExpandedFolder = (path: string) =>
    normalizedQuery
      ? true
      : (userToggles.get(path) ?? hotAncestors.has(path));

  const toggleFolder = (path: string) => {
    setUserToggles((prev) => {
      const next = new Map(prev);
      next.set(path, !(prev.get(path) ?? hotAncestors.has(path)));
      return next;
    });
  };

  const setAllFolders = (expanded: boolean) => {
    const next = new Map<string, boolean>();
    folderPaths.forEach((path) => next.set(path, expanded));
    setUserToggles(next);
  };

  if (files.length === 0 && directories.length === 0) {
    return <p className="session-board-empty">{t("fanbox.casebar.workspaceEmpty")}</p>;
  }

  return (
    <div className="session-ws">
      <div className="session-ws-toolbar">
        <input
          type="search"
          className="session-ws-search"
          placeholder={t("fanbox.casebar.searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" onClick={() => setAllFolders(true)}>
          {t("fanbox.casebar.expandAll")}
        </button>
        <button type="button" onClick={() => setAllFolders(false)}>
          {t("fanbox.casebar.collapseAll")}
        </button>
      </div>
      <div className="session-ws-tree">
        {visibleNodes.length === 0 ? (
          <p className="session-board-empty">{t("fanbox.casebar.workspaceEmpty")}</p>
        ) : (
          <TreeRows
            nodes={visibleNodes}
            depth={0}
            isExpandedFolder={isExpandedFolder}
            onToggleFolder={toggleFolder}
            heatByPath={heatByPath}
            onOpenFile={onOpenFile}
          />
        )}
      </div>
    </div>
  );
}
