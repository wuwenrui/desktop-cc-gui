/**
 * 批量编辑文件分组组件
 * 统一 Marker 风格折叠行：灰色描边图标 + 批量标题 + 计数 + 总统计；展开体为文件列表与 diff 统计
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FilePen from 'lucide-react/dist/esm/icons/file-pen';
import type { ConversationItem } from '../../../../types';
import {
  parseToolArgs,
  resolveToolStatus,
  type ToolStatusTone,
  asRecord,
  pickStringField,
  EDIT_PATH_KEYS,
  EDIT_OLD_KEYS,
  EDIT_NEW_KEYS,
  EDIT_CONTENT_KEYS,
} from './toolConstants';
import { computeDiff, computeDiffFromUnifiedPatch, type DiffStats } from '../../utils/diffUtils';
import { ToolMarkerShell } from './ToolMarkerShell';
import {
  FileChangeRow,
  structuredDiffToLines,
  unifiedDiffToPreview,
  type FileChangeDiffLine,
} from './FileChangeRow';

type ToolItem = Extract<ConversationItem, { kind: 'tool' }>;

interface EditToolGroupBlockProps {
  items: ToolItem[];
  onOpenDiffPath?: (path: string) => void;
}

interface ParsedEditItem {
  id: string;
  filePath: string;
  diff: DiffStats;
  diffLines: FileChangeDiffLine[];
  status: ToolStatusTone;
}

const MAX_VISIBLE_ITEMS = 3;
const ITEM_HEIGHT = 32;

function parseEditItem(item: ToolItem): ParsedEditItem | null {
  const args = parseToolArgs(item.detail);
  const nestedInput = asRecord(args?.input);
  const nestedArgs = asRecord(args?.arguments);
  let filePath = '';
  let diff: DiffStats;
  let diffLines: FileChangeDiffLine[] = [];
  if (item.toolType === 'fileChange' && item.changes?.length) {
    filePath = item.changes[0]?.path ?? '';
    diff = item.changes.reduce(
      (acc, change) => {
        const stats = computeDiffFromUnifiedPatch(change.diff ?? '');
        return { additions: acc.additions + stats.additions, deletions: acc.deletions + stats.deletions };
      },
      { additions: 0, deletions: 0 },
    );
    const unified = item.changes
      .map((change) => change.diff ?? '')
      .filter(Boolean)
      .join('\n');
    diffLines = unified ? unifiedDiffToPreview(unified).lines : [];
  } else {
    filePath = pickStringField(args, nestedInput, nestedArgs, EDIT_PATH_KEYS);
    const oldString = pickStringField(args, nestedInput, nestedArgs, EDIT_OLD_KEYS);
    const newString = pickStringField(args, nestedInput, nestedArgs, EDIT_NEW_KEYS);
    if (oldString || newString) {
      const result = computeDiff(oldString, newString);
      diff = { additions: result.additions, deletions: result.deletions };
      diffLines = structuredDiffToLines(result.lines);
    } else {
      const content = pickStringField(args, nestedInput, nestedArgs, EDIT_CONTENT_KEYS);
      if (content) {
        const result = computeDiff('', content);
        diff = { additions: result.additions, deletions: result.deletions };
        diffLines = structuredDiffToLines(result.lines);
      } else {
        diff = { additions: 0, deletions: 0 };
      }
    }
  }

  if (!filePath) {
    return null;
  }

  const hasOutput = Boolean(item.output) || Boolean(item.changes?.length);
  const status = resolveToolStatus(item.status, hasOutput);

  return {
    id: item.id,
    filePath,
    diff,
    diffLines,
    status,
  };
}

export const EditToolGroupBlock = memo(function EditToolGroupBlock({
  items,
  onOpenDiffPath,
}: EditToolGroupBlockProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const previousCountRef = useRef(items.length);

  const parsedItems = useMemo(
    () => items.map(parseEditItem).filter((entry): entry is ParsedEditItem => Boolean(entry)),
    [items],
  );

  useEffect(() => {
    if (parsedItems.length > previousCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    previousCountRef.current = parsedItems.length;
  }, [parsedItems.length]);

  if (!parsedItems.length) {
    return null;
  }

  const totalDiff = parsedItems.reduce(
    (acc, item) => ({
      additions: acc.additions + item.diff.additions,
      deletions: acc.deletions + item.diff.deletions,
    }),
    { additions: 0, deletions: 0 },
  );
  const needsScroll = parsedItems.length > MAX_VISIBLE_ITEMS;
  const listHeight = Math.min(parsedItems.length, MAX_VISIBLE_ITEMS) * ITEM_HEIGHT;

  return (
    <ToolMarkerShell
      icon={<FilePen />}
      label={t('tools.batchEditFile')}
      expanded={isExpanded}
      onToggle={() => setIsExpanded((previous) => !previous)}
      body={
        <div
          ref={listRef}
          className="file-list-container mt-1 overflow-hidden rounded-md"
          style={{
            padding: '6px 8px',
            maxHeight: needsScroll ? `${listHeight + 12}px` : undefined,
            overflowY: needsScroll ? 'auto' : 'hidden',
            overflowX: 'hidden',
          }}
        >
          {parsedItems.map((entry) => (
            <FileChangeRow
              key={entry.id}
              filePath={entry.filePath}
              additions={entry.diff.additions}
              deletions={entry.diff.deletions}
              status={entry.status}
              canExpand={entry.diffLines.length > 0}
              loadDiff={
                entry.diffLines.length > 0
                  ? () => ({ lines: entry.diffLines })
                  : undefined
              }
              onOpenDiffPath={onOpenDiffPath}
            />
          ))}
        </div>
      }
    >
      <span className="shrink-0 text-muted-foreground">({parsedItems.length})</span>
      {(totalDiff.additions > 0 || totalDiff.deletions > 0) && (
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          {totalDiff.additions > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">+{totalDiff.additions}</span>
          )}
          {totalDiff.deletions > 0 && (
            <span className="text-red-500 dark:text-red-400">-{totalDiff.deletions}</span>
          )}
        </span>
      )}
    </ToolMarkerShell>
  );
});

export default EditToolGroupBlock;
