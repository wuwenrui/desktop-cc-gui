import "./skill-structure.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SkillFileContentResp } from "./previewApi";
import {
  buildSkillTree,
  isSubSkillPath,
  pickDefaultFile,
  type SkillFileEntry,
  type SkillTreeNode,
} from "./skillTree";

/**
 * skill 结构查看器：左侧文件树 + 右侧文本内容。
 *
 * 两处复用（OpenSpec add-lawhub-skill-group-structure-preview Decision 2）：
 * - 已装本地查看（SkillStructureDrawer，loadFile 走 Rust 命令）
 * - 市场装前预览（SkillMarketPanel，loadFile 走 lawhub 预览 API）
 *
 * 新增文件（fork-friendly）：数据获取由调用方注入，本组件只管渲染与选中态。
 */

type ContentState =
  | { status: "idle" }
  | { status: "loading"; path: string }
  | { status: "ready"; data: SkillFileContentResp }
  | { status: "error"; path: string; message: string };

type Props = {
  entries: SkillFileEntry[];
  loadFile: (path: string) => Promise<SkillFileContentResp>;
  /** 提供时，sub-skills/*_SKILL.md 行与内容区展示「用」动作。 */
  onUseSkill?: () => void;
};

function TreeRows({
  nodes,
  depth,
  selectedPath,
  onSelect,
  onUseSkill,
}: {
  nodes: SkillTreeNode[];
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onUseSkill?: () => void;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.path}>
          {node.isDir ? (
            <div
              className="skill-structure-tree-row is-dir"
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              <span className="skill-structure-tree-name">{node.name}/</span>
            </div>
          ) : (
            <button
              type="button"
              className={`skill-structure-tree-row is-file${
                selectedPath === node.path ? " is-selected" : ""
              }`}
              style={{ paddingLeft: 8 + depth * 14 }}
              title={node.path}
              onClick={() => onSelect(node.path)}
            >
              <span className="skill-structure-tree-name">{node.name}</span>
              {onUseSkill && isSubSkillPath(node.path) && (
                <span
                  className="skill-structure-tree-use"
                  role="button"
                  tabIndex={0}
                  aria-label={`使用 ${node.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUseSkill();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onUseSkill();
                    }
                  }}
                >
                  用
                </span>
              )}
            </button>
          )}
          {node.children.length > 0 && (
            <TreeRows
              nodes={node.children}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onUseSkill={onUseSkill}
            />
          )}
        </div>
      ))}
    </>
  );
}

export function SkillStructureView({ entries, loadFile, onUseSkill }: Props) {
  const tree = useMemo(() => buildSkillTree(entries), [entries]);
  const defaultPath = useMemo(() => pickDefaultFile(entries), [entries]);
  const [selectedPath, setSelectedPath] = useState<string | null>(defaultPath);
  const [content, setContent] = useState<ContentState>({ status: "idle" });

  // entries 变化（切换 skill）时重置选中到默认文件。
  useEffect(() => {
    setSelectedPath(defaultPath);
  }, [defaultPath]);

  const select = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  useEffect(() => {
    if (!selectedPath) {
      setContent({ status: "idle" });
      return;
    }
    let cancelled = false;
    setContent({ status: "loading", path: selectedPath });
    // Promise.resolve 包一层：loadFile 实现异常（含非 Promise 返回）也走 error 分支。
    Promise.resolve()
      .then(() => loadFile(selectedPath))
      .then((data) => {
        if (!cancelled) {
          setContent({ status: "ready", data });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setContent({ status: "error", path: selectedPath, message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPath, loadFile]);

  return (
    <div className="skill-structure-view">
      <div className="skill-structure-tree" aria-label="skill 文件树">
        {tree.length === 0 ? (
          <p className="skill-structure-hint">无文件</p>
        ) : (
          <TreeRows
            nodes={tree}
            depth={0}
            selectedPath={selectedPath}
            onSelect={select}
            onUseSkill={onUseSkill}
          />
        )}
      </div>
      <div className="skill-structure-content">
        {content.status === "idle" && (
          <p className="skill-structure-hint">选择左侧文件查看内容</p>
        )}
        {content.status === "loading" && (
          <p className="skill-structure-hint">加载中…</p>
        )}
        {content.status === "error" && (
          <p className="skill-structure-error">
            无法预览 {content.path}：{content.message}
          </p>
        )}
        {content.status === "ready" && (
          <>
            <div className="skill-structure-content-head">
              <span
                className="skill-structure-content-path"
                title={content.data.path}
              >
                {content.data.path}
              </span>
              {content.data.truncated && (
                <span className="skill-structure-truncated">
                  内容过长，已截断展示
                </span>
              )}
            </div>
            <pre className="skill-structure-content-text">
              {content.data.content}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
