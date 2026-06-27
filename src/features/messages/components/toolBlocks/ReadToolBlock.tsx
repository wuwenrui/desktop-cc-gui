/**
 * 读取文件工具块组件
 * Read Tool Block Component - for displaying file read operations
 * 统一 Marker 风格折叠行：灰色描边图标 + 文件名 + 行号范围 + 靠右状态图标
 */
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Folder from 'lucide-react/dist/esm/icons/folder';
import type { ConversationItem } from '../../../../types';
import { cn } from '@/lib/utils';
import {
  asRecord,
  parseToolArgs,
  getFirstStringField,
  getFileName,
  resolveToolStatus,
} from './toolConstants';
import { Markdown } from '../Markdown';
import {
  ToolMarkerShell,
  ToolStatusIcon,
  TOOL_MARKER_BODY_CLASS,
} from './ToolMarkerShell';

interface ReadToolBlockProps {
  item: Extract<ConversationItem, { kind: 'tool' }>;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx']);
const PATH_KEYS = ['file_path', 'filePath', 'path', 'target_file', 'targetFile', 'filename', 'file'];
const OUTPUT_KEYS = ['output', 'result', 'content', 'text'];

function looksLikeMarkdownOutput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return (
    /^#{1,6}\s+/m.test(trimmed) ||
    /^\s*[-*+]\s+\S+/m.test(trimmed) ||
    /^\s*\d+\.\s+\S+/m.test(trimmed) ||
    /^\s*>+\s+\S+/m.test(trimmed) ||
    /```[\s\S]*```/.test(trimmed) ||
    (/^\s*\|.+\|\s*$/m.test(trimmed) && /^\s*\|?\s*[-:]{2,}/m.test(trimmed))
  );
}

function isMarkdownPath(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, '/');
  if (!normalized) {
    return false;
  }
  const fileName = getFileName(normalized).toLowerCase();
  const ext = fileName.includes('.') ? fileName.split('.').pop() ?? '' : '';
  if (MARKDOWN_EXTENSIONS.has(ext)) {
    return true;
  }
  return fileName === 'readme' || fileName.startsWith('readme.');
}

export const ReadToolBlock = memo(function ReadToolBlock({
  item,
  isExpanded: _isExpanded,
  onToggle: _onToggle,
}: ReadToolBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const args = useMemo(() => parseToolArgs(item.detail), [item.detail]);
  const nestedInput = useMemo(() => asRecord(args?.input), [args]);
  const nestedArgs = useMemo(() => asRecord(args?.arguments), [args]);

  const filePath =
    getFirstStringField(args, PATH_KEYS) ||
    getFirstStringField(nestedInput, PATH_KEYS) ||
    getFirstStringField(nestedArgs, PATH_KEYS);
  const fileName = getFileName(filePath);

  const renderedOutput = useMemo(() => {
    if (item.output && item.output.trim()) {
      return item.output;
    }
    return (
      getFirstStringField(args, OUTPUT_KEYS) ||
      getFirstStringField(nestedInput, OUTPUT_KEYS) ||
      getFirstStringField(nestedArgs, OUTPUT_KEYS)
    );
  }, [args, item.output, nestedArgs, nestedInput]);

  const renderAsMarkdown = useMemo(() => {
    if (!renderedOutput) {
      return false;
    }
    if (isMarkdownPath(filePath)) {
      return true;
    }
    return looksLikeMarkdownOutput(renderedOutput);
  }, [filePath, renderedOutput]);

  const offset = args?.offset as number | undefined;
  const limit = args?.limit as number | undefined;
  let lineInfo = '';
  if (typeof offset === 'number' && typeof limit === 'number') {
    const startLine = offset + 1;
    const endLine = offset + limit;
    lineInfo = t("tools.lineRange", { start: startLine, end: endLine });
  }

  const isDirectory = filePath?.endsWith('/') || fileName === '.' || fileName === '..';
  const actionText = isDirectory ? t("tools.readDirectory") : t("tools.readFile");

  const status = resolveToolStatus(item.status, Boolean(renderedOutput));
  const hasBody = Boolean(renderedOutput);

  return (
    <ToolMarkerShell
      icon={isDirectory ? <Folder /> : <FileText />}
      label={actionText}
      labelHidden
      expanded={expanded && hasBody}
      onToggle={() => setExpanded((prev) => !prev)}
      trailing={<ToolStatusIcon status={status} />}
      body={
        <div className={cn(TOOL_MARKER_BODY_CLASS, 'read-tool-details')}>
          {renderAsMarkdown ? (
            <div className="task-content-wrapper read-tool-markdown-wrapper">
              <div className="read-tool-rendered-content">
                <Markdown
                  value={renderedOutput}
                  className="markdown read-tool-markdown"
                  liveRenderMode="lightweight"
                />
              </div>
            </div>
          ) : (
            <div className="task-content-wrapper">
              <div className="task-field-content" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {renderedOutput}
              </div>
            </div>
          )}
        </div>
      }
    >
      {fileName && (
        <span className="truncate" title={filePath}>
          {fileName}
        </span>
      )}
      {lineInfo && (
        <span className="shrink-0 text-muted-foreground/70">{lineInfo}</span>
      )}
    </ToolMarkerShell>
  );
});

export default ReadToolBlock;
