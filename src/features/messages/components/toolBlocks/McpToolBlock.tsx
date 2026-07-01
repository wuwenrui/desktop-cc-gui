/**
 * MCP 工具块组件 - 用于展示 MCP (Model Context Protocol) 工具调用
 * MCP Tool Block Component - for displaying MCP tool calls
 * 统一 Marker 风格折叠行：灰色描边图标 + 工具名 + 摘要 + 靠右状态图标
 */
import { memo, useMemo, useState } from 'react';
import SearchIcon from 'lucide-react/dist/esm/icons/search';
import Database from 'lucide-react/dist/esm/icons/database';
import Globe from 'lucide-react/dist/esm/icons/globe';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Wrench from 'lucide-react/dist/esm/icons/wrench';
import type { ConversationItem } from '../../../../types';
import {
  parseToolArgs,
  getFirstStringField,
  truncateText,
  resolveToolStatus,
} from './toolConstants';
import { TOOL_MARKER_BODY_CLASS, ToolMarkerShell, ToolStatusIcon } from './ToolMarkerShell';

interface McpToolBlockProps {
  item: Extract<ConversationItem, { kind: 'tool' }>;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}

/**
 * 格式化 MCP 工具名称
 * mcp__ace-tool__search_context -> Mcp Ace-tool Search Context
 */
function formatMcpToolName(title: string): string {
  const cleanTitle = title.replace(/^Tool:\s*/i, '').trim();
  const parts = cleanTitle.split('__');

  return parts
    .map(part =>
      part.split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('-')
    )
    .join(' ');
}

/**
 * 根据 MCP 工具名称获取 lucide 描边图标
 */
function getMcpIcon(title: string) {
  const lower = title.toLowerCase();

  if (lower.includes('search') || lower.includes('context') || lower.includes('query')) {
    return <SearchIcon />;
  }
  if (lower.includes('database') || lower.includes('sql') || lower.includes('db')) {
    return <Database />;
  }
  if (lower.includes('web') || lower.includes('fetch') || lower.includes('http')) {
    return <Globe />;
  }
  if (lower.includes('read') || lower.includes('file') || lower.includes('doc')) {
    return <FileText />;
  }

  return <Wrench />;
}

/**
 * 获取状态
 */
function getStatus(item: Extract<ConversationItem, { kind: 'tool' }>): 'completed' | 'processing' | 'failed' {
  return resolveToolStatus(item.status, Boolean(item.output));
}

export const McpToolBlock = memo(function McpToolBlock({
  item,
  isExpanded: _isExpanded,
  onToggle: _onToggle,
}: McpToolBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const args = useMemo(() => parseToolArgs(item.detail), [item.detail]);

  const displayName = formatMcpToolName(item.title);
  const status = getStatus(item);

  const summary = getFirstStringField(args, ['query', 'pattern', 'path', 'file_path', 'text', 'prompt']);
  const displaySummary = truncateText(summary, 50);

  const omitFields = useMemo(() => new Set(['query', 'pattern', 'path', 'file_path', 'text', 'prompt']), []);

  const otherParams = useMemo(() => {
    if (!args) return [];
    return Object.entries(args).filter(
      ([key, value]) => !omitFields.has(key) && value !== undefined && value !== null && value !== ''
    );
  }, [args, omitFields]);

  const hasDetails = otherParams.length > 0 || Boolean(item.output);

  return (
    <ToolMarkerShell
      icon={getMcpIcon(item.title)}
      label={displayName}
      expanded={expanded && hasDetails}
      onToggle={() => setExpanded(prev => !prev)}
      trailing={<ToolStatusIcon status={status} />}
      body={
        <div className={TOOL_MARKER_BODY_CLASS}>
          {otherParams.length > 0 && (
            <div className="task-content-wrapper">
              {otherParams.map(([key, value]) => (
                <div key={key} className="task-field">
                  <div className="task-field-label">{key}</div>
                  <div className="task-field-content">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {item.output && (
            <div style={{ padding: '12px' }}>
              <div className="task-field-content" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{item.output}</pre>
              </div>
            </div>
          )}
        </div>
      }
    >
      {displaySummary && (
        <span className="truncate" title={summary}>
          {displaySummary}
        </span>
      )}
    </ToolMarkerShell>
  );
});

export default McpToolBlock;
