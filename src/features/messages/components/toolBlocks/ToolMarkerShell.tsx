/**
 * 工具块共享外壳 - 统一 Marker 风格的折叠行
 * Shared shell for tool blocks rendered as shadcn Marker rows.
 * 定稿口径：对齐 shadcn 官方 Marker 默认尺寸（text-sm + 图标 size-4 + gap-2），
 * 无边框、muted —— 灰色 lucide 描边图标 + 内容 + 靠右状态图标 + 折叠体。
 */
import type { ReactNode } from 'react';
import CircleAlert from 'lucide-react/dist/esm/icons/circle-alert';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { cn } from '@/lib/utils';
import { Marker, MarkerContent, MarkerIcon } from '../../../../components/ui/marker';
import type { ToolStatusTone } from './toolConstants';

/** 单块统一折叠体容器类：淡边框 + rounded-md(6px) + muted/30 底、与头部小间距 */
export const TOOL_MARKER_BODY_CLASS =
  'mt-1 overflow-hidden rounded-md border border-border bg-muted/30';

/**
 * 靠右状态图标：失败=警示、完成=不显示、处理中=转圈。
 * 自带 ml-auto，确保贴右。
 */
export function ToolStatusIcon({ status }: { status: ToolStatusTone }) {
  if (status === 'failed') {
    return <CircleAlert className="ml-auto size-4 shrink-0 text-destructive" />;
  }
  if (status === 'completed') {
    return null;
  }
  return (
    <Loader2 className="ml-auto size-4 shrink-0 animate-spin text-muted-foreground" />
  );
}

interface ToolMarkerShellProps {
  /** 前置 lucide 描边图标（不写 size 时由 MarkerIcon 容器自动 size-4），继承 muted 色 */
  icon: ReactNode;
  /** 类型标识：sr-only 时仅作无障碍/测试锚点；可见时作分组/工具标题 */
  label: ReactNode;
  /** label 是否视觉隐藏（单块动词隐藏、组块/MCP 标题可见） */
  labelHidden?: boolean;
  /** 给 Marker 的 aria-label（如 Search 需要 getByLabelText 锚点） */
  ariaLabel?: string;
  /** 给 Marker 的 ARIA role（如工具卡片需 role="group" 保留语义/测试锚点） */
  role?: string;
  expanded?: boolean;
  onToggle?: () => void;
  /** 是否可点击（默认 true）；false 时不绑定点击、不显示指针 */
  interactive?: boolean;
  /** Marker 容器附加类 */
  className?: string;
  /** 最外层 wrapper（含折叠体）附加类，用于承载块级间距等 */
  wrapperClassName?: string;
  /** MarkerContent 附加类 */
  contentClassName?: string;
  /** 靠右节点（状态图标 / 进度文本），自带 ml-auto */
  trailing?: ReactNode;
  /** Marker 主体内容（文件名 / 命令 / 计数 / 统计…） */
  children?: ReactNode;
  /** 展开体（自带容器与样式，可用 TOOL_MARKER_BODY_CLASS） */
  body?: ReactNode;
}

/**
 * 工具块折叠行外壳。头部恒为一行 Marker，展开体由调方自带容器，
 * 仅在 expanded 时渲染。
 */
export function ToolMarkerShell({
  icon,
  label,
  labelHidden = false,
  ariaLabel,
  role,
  expanded = false,
  onToggle,
  interactive = true,
  className,
  wrapperClassName,
  contentClassName,
  trailing,
  children,
  body,
}: ToolMarkerShellProps) {
  const clickable = interactive && Boolean(onToggle);

  return (
    <div className={wrapperClassName}>
      <Marker
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        {...(role ? { role } : {})}
        {...(clickable ? { onClick: onToggle } : {})}
        className={cn(
          'gap-2 rounded-md pr-3 py-1.5 text-sm transition-colors',
          clickable && 'cursor-pointer select-none',
          className,
        )}
      >
        <MarkerIcon>{icon}</MarkerIcon>
        <span className={labelHidden ? 'sr-only' : 'min-w-0 truncate'}>
          {label}
        </span>
        {children != null && (
          <MarkerContent
            className={cn('flex min-w-0 items-center gap-2', contentClassName)}
          >
            {children}
          </MarkerContent>
        )}
        {trailing}
        {clickable && body != null && (
          <ChevronRight
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              // trailing 自带 ml-auto 已把右侧组顶到最右；无 trailing 时 chevron 自己贴右。
              // 避免双 ml-auto 平分空白导致状态图标被顶到中间。
              trailing == null && 'ml-auto',
              expanded && 'rotate-90',
            )}
          />
        )}
      </Marker>
      {expanded && body != null ? body : null}
    </div>
  );
}

export default ToolMarkerShell;
