/**
 * 单个编辑文件工具块组件
 * Edit Tool Block Component
 * 统一 Marker 风格折叠行：灰色描边图标 + 文件名 + 绿/红统计 + 靠右状态图标
 */
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FilePen from 'lucide-react/dist/esm/icons/file-pen';
import type { ConversationItem } from '../../../../types';
import {
  parseToolArgs,
  getFileName,
  resolveToolStatus,
  asRecord,
  pickStringField,
  EDIT_PATH_KEYS,
  EDIT_OLD_KEYS,
  EDIT_NEW_KEYS,
  EDIT_CONTENT_KEYS,
} from './toolConstants';
import { computeDiff } from '../../utils/diffUtils';
import {
  ToolMarkerShell,
  ToolStatusIcon,
  TOOL_MARKER_BODY_CLASS,
} from './ToolMarkerShell';

interface EditToolBlockProps {
  item: Extract<ConversationItem, { kind: 'tool' }>;
}

export const EditToolBlock = memo(function EditToolBlock({
  item,
}: EditToolBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const args = useMemo(() => parseToolArgs(item.detail), [item.detail]);
  const nestedInput = useMemo(() => asRecord(args?.input), [args]);
  const nestedArgs = useMemo(() => asRecord(args?.arguments), [args]);

  const filePath = pickStringField(args, nestedInput, nestedArgs, EDIT_PATH_KEYS);
  const fileName = getFileName(filePath);
  const displayPath = fileName || filePath;

  const { diff, hasStructuredDiff } = useMemo(() => {
    if (!args && !nestedInput && !nestedArgs) {
      return { diff: { lines: [], additions: 0, deletions: 0 }, hasStructuredDiff: false };
    }

    const oldString = pickStringField(args, nestedInput, nestedArgs, EDIT_OLD_KEYS);
    const newString = pickStringField(args, nestedInput, nestedArgs, EDIT_NEW_KEYS);
    if (oldString || newString) {
      return { diff: computeDiff(oldString, newString), hasStructuredDiff: true };
    }

    const content = pickStringField(args, nestedInput, nestedArgs, EDIT_CONTENT_KEYS);
    if (content) {
      return { diff: computeDiff('', content), hasStructuredDiff: true };
    }

    return { diff: { lines: [], additions: 0, deletions: 0 }, hasStructuredDiff: false };
  }, [args, nestedArgs, nestedInput]);

  const status = resolveToolStatus(item.status, Boolean(item.output));

  const hasInlineDiff = hasStructuredDiff && diff.lines.length > 0;
  const hasBody = hasInlineDiff || Boolean(item.output);

  const renderDiffLines = () =>
    diff.lines.map((line, index) => {
      const lineClass =
        line.type === 'deleted'
          ? 'is-deleted'
          : line.type === 'added'
            ? 'is-added'
            : '';

      return (
        <div
          key={`${line.type}-${index}`}
          className={`edit-diff-line ${lineClass}`}
        >
          <div className="edit-diff-gutter" />
          <div className={`edit-diff-sign ${lineClass}`}>
            {line.type === 'deleted' ? '-' : line.type === 'added' ? '+' : ' '}
          </div>
          <pre className="edit-diff-content">
            {line.content}
          </pre>
        </div>
      );
    });

  return (
    <ToolMarkerShell
      icon={<FilePen className="size-3.5" />}
      label={t('tools.editFile')}
      labelHidden
      expanded={expanded && hasBody}
      onToggle={() => setExpanded((prev) => !prev)}
      trailing={<ToolStatusIcon status={status} />}
      body={
        <div className={TOOL_MARKER_BODY_CLASS}>
          {hasInlineDiff ? (
            <div className="edit-diff-viewer">{renderDiffLines()}</div>
          ) : (
            <pre className="m-0 max-h-[300px] overflow-auto whitespace-pre-wrap break-words p-2.5 font-mono text-xs text-muted-foreground">
              {item.output}
            </pre>
          )}
        </div>
      }
    >
      {displayPath && (
        <span className="truncate" title={filePath || fileName}>
          {displayPath}
        </span>
      )}
      {(diff.additions > 0 || diff.deletions > 0) && (
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          {diff.additions > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">+{diff.additions}</span>
          )}
          {diff.deletions > 0 && (
            <span className="text-red-500 dark:text-red-400">-{diff.deletions}</span>
          )}
        </span>
      )}
    </ToolMarkerShell>
  );
});

export default EditToolBlock;
