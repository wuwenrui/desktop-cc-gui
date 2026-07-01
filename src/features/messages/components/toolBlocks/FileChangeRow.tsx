/**
 * 单文件变更行 - 全站文件变更的统一渲染单元
 * Shared single file-change row. One component behind EditToolBlock、
 * EditToolGroupBlock 与 GenericToolBlock 的 fileChange 分支，确保实时/历史、
 * 单文件/多文件/分组处处像素与行为一致。
 * 口径：ToolMarkerShell（FilePen 描边图标 + 文件名 + 绿/红统计 + 靠右状态 + 折叠 diff 体）。
 */
import { memo, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import FilePen from 'lucide-react/dist/esm/icons/file-pen';
import { parseDiff } from '../../../../utils/diff';
import type { DiffLine } from '../../utils/diffUtils';
import { getFileName, type ToolStatusTone } from './toolConstants';
import {
  ToolMarkerShell,
  ToolStatusIcon,
  TOOL_MARKER_BODY_CLASS,
} from './ToolMarkerShell';

/** 中性 diff 行表示：各调用方把自己的 diff（computeDiff / parseDiff）归一到此形态 */
export type FileChangeDiffLine = {
  kind: 'add' | 'del' | 'hunk' | 'context';
  text: string;
};

export type FileChangeDiffPreview = {
  lines: FileChangeDiffLine[];
  truncated?: boolean;
};

const DEFAULT_DIFF_PREVIEW_MAX_LINES = 48;

/** computeDiff 的结构化行（unchanged/deleted/added）→ 共享中性行。 */
export function structuredDiffToLines(lines: DiffLine[]): FileChangeDiffLine[] {
  return lines.map((line) => ({
    kind:
      line.type === 'deleted' ? 'del' : line.type === 'added' ? 'add' : 'context',
    text: line.content,
  }));
}

/** unified diff 文本（parseDiff）→ 共享中性预览（含预览行数截断）。 */
export function unifiedDiffToPreview(
  diffText: string,
  maxLines = DEFAULT_DIFF_PREVIEW_MAX_LINES,
): FileChangeDiffPreview {
  const parsed = parseDiff(diffText);
  const truncated = parsed.length > maxLines;
  const visible = truncated ? parsed.slice(0, maxLines) : parsed;
  return {
    lines: visible.map(
      (line): FileChangeDiffLine => ({
        kind:
          line.type === 'add'
            ? 'add'
            : line.type === 'del'
              ? 'del'
              : line.type === 'hunk' || line.type === 'meta'
                ? 'hunk'
                : 'context',
        text: line.text,
      }),
    ),
    truncated,
  };
}

interface FileChangeRowProps {
  filePath: string;
  additions: number;
  deletions: number;
  status: ToolStatusTone;
  /** 是否可展开（有 diff 预览或回退内容时为真）。为假时渲染纯展示行 */
  canExpand?: boolean;
  /** 懒加载 diff 预览：仅在该行展开时调用（保护「折叠态不解析 diff」的性能守卫） */
  loadDiff?: () => FileChangeDiffPreview;
  /** 展开后无 diff 预览时的回退展开体（如原始工具输出） */
  fallbackBody?: ReactNode;
  /**
   * @deprecated 文件名已统一为纯文本展示，不再作为可点链接（对齐 EditToolBlock 的历史/渲染态口径）。
   * 保留该 prop 仅为兼容既有调用链，避免跨 ToolBlockRenderer→Messages→renderAppShell 的删除级联。
   * ponytail: 惰性 prop（上限：死管线）。彻底移除请沿上述链一并清理 onOpenDiffPath 与相关测试。
   */
  onOpenDiffPath?: (path: string) => void;
  defaultExpanded?: boolean;
  wrapperClassName?: string;
}

function renderDiffLines(preview: FileChangeDiffPreview): ReactNode {
  return (
    <div className="tool-change-inline-diff edit-diff-viewer">
      {preview.lines.map((line, index) => {
        const lineClass =
          line.kind === 'del'
            ? 'is-deleted'
            : line.kind === 'add'
              ? 'is-added'
              : line.kind === 'hunk'
                ? 'is-hunk'
                : '';
        const signNode =
          line.kind === 'hunk' ? (
            <span
              className="codicon codicon-diff tool-change-hunk-icon"
              aria-hidden
            />
          ) : line.kind === 'del' ? (
            '-'
          ) : line.kind === 'add' ? (
            '+'
          ) : (
            ' '
          );
        const content =
          line.kind === 'hunk'
            ? line.text.replace(/^@@\s*/, '').replace(/\s*@@$/, '')
            : line.text;
        return (
          <div
            key={`${line.kind}-${index}`}
            className={`edit-diff-line ${lineClass}`}
          >
            <div className="edit-diff-gutter" />
            <div className={`edit-diff-sign ${lineClass}`}>{signNode}</div>
            <pre className="edit-diff-content">{content}</pre>
          </div>
        );
      })}
      {preview.truncated && (
        <div className="tool-change-inline-diff-truncated">Diff truncated…</div>
      )}
    </div>
  );
}

export const FileChangeRow = memo(function FileChangeRow({
  filePath,
  additions,
  deletions,
  status,
  canExpand = false,
  loadDiff,
  fallbackBody,
  defaultExpanded = false,
  wrapperClassName,
}: FileChangeRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const fileName = getFileName(filePath) || filePath;
  const hasStats = additions > 0 || deletions > 0;

  // 仅在展开时解析 diff —— 折叠态不触发解析，保持性能守卫。
  const preview = useMemo(
    () => (expanded && loadDiff ? loadDiff() : null),
    [expanded, loadDiff],
  );
  const hasDiff = (preview?.lines.length ?? 0) > 0;

  const body = canExpand ? (
    <div className={TOOL_MARKER_BODY_CLASS}>
      {hasDiff && preview ? renderDiffLines(preview) : fallbackBody}
    </div>
  ) : undefined;

  return (
    <ToolMarkerShell
      icon={<FilePen />}
      label={t('tools.editFile')}
      labelHidden
      wrapperClassName={wrapperClassName}
      interactive={canExpand}
      expanded={expanded}
      onToggle={canExpand ? () => setExpanded((prev) => !prev) : undefined}
      trailing={<ToolStatusIcon status={status} />}
      body={body}
    >
      <span className="min-w-0 truncate" title={filePath}>
        {fileName}
      </span>
      {hasStats && (
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          {additions > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-red-500 dark:text-red-400">-{deletions}</span>
          )}
        </span>
      )}
    </ToolMarkerShell>
  );
});

export default FileChangeRow;
