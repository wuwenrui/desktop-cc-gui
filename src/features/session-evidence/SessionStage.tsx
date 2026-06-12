import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  SessionCasebar,
  SessionEvidenceBoard,
  SessionFilesBoard,
  type CasebarView,
} from "./SessionCasebar";
import {
  deriveSessionEvidence,
  deriveTurnSourceSummary,
  hasSourceSignal,
  pickEvidenceMessages,
  type TurnSourceSummary,
} from "./turnEvidence";

/**
 * 会话舞台：casebar 三视图（对话/文件/证据）的状态持有方。
 *
 * - 视图态为组件局部 state（OpenSpec Decision 4），不进全局 centerMode；
 *   切换线程（sessionKey 变化）回落「对话」。
 * - 「对话」视图的 children（Messages）保持常驻挂载，仅 CSS 隐藏——
 *   避免切视图丢失消息列表滚动位置与内部状态。
 * - 无活动会话（sessionKey 为空）时不渲染 casebar，直接透传 children，
 *   首页/落地态不受影响。
 *
 * OpenSpec change: add-fanbox-dialogue-cockpit。新增文件（fork-friendly）。
 */

export function SessionStage({
  sessionKey,
  title,
  items,
  workspaceFiles,
  workspaceDirectories,
  onOpenFile,
  children,
}: {
  sessionKey: string | null;
  title: string;
  /** 会话消息（ConversationItem 联合类型；只消费 assistant 文本变体）。 */
  items: ReadonlyArray<unknown>;
  /** 工作区文件树数据（与右栏 FileTreePanel 同源）；缺省时文件视图只展示上区。 */
  workspaceFiles?: string[];
  workspaceDirectories?: string[];
  onOpenFile?: (path: string) => void;
  children: ReactNode;
}) {
  const [view, setView] = useState<CasebarView>("chat");

  useEffect(() => {
    setView("chat");
  }, [sessionKey]);

  const messages = useMemo(() => pickEvidenceMessages(items), [items]);

  const activities = useMemo(
    () => (view === "files" ? deriveSessionEvidence(messages) : []),
    [view, messages],
  );

  const latest = useMemo<TurnSourceSummary | null>(() => {
    if (view !== "evidence") {
      return null;
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role !== "assistant") {
        continue;
      }
      const summary = deriveTurnSourceSummary(messages[i].text);
      if (hasSourceSignal(summary)) {
        return summary;
      }
    }
    return null;
  }, [view, messages]);

  // 有会话 id 或屏幕上已有对话内容（部分会话态 threadId 为空）都展示 casebar；
  // 两者皆无（首页/落地态）时透传。
  if (!sessionKey && messages.length === 0) {
    return <>{children}</>;
  }

  return (
    <div className="session-stage">
      <SessionCasebar title={title} view={view} onViewChange={setView} />
      <div
        className="session-stage-chat"
        style={view === "chat" ? undefined : { display: "none" }}
      >
        {children}
      </div>
      {view === "files" && (
        <SessionFilesBoard
          activities={activities}
          workspaceFiles={workspaceFiles}
          workspaceDirectories={workspaceDirectories}
          onOpenFile={onOpenFile}
        />
      )}
      {view === "evidence" && <SessionEvidenceBoard latest={latest} />}
    </div>
  );
}
