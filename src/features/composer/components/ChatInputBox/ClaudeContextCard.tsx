import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import type { ClaudeContextUsageViewModel } from './types';

/**
 * ClaudeContextCard — Claude 背景信息窗口卡片
 *
 * 视觉完全对齐 ai-elements 的 Context 组件（header 百分比 + 进度条、
 * body 分项用量、footer 状态），数据取自项目的 ClaudeContextUsageViewModel。
 * 内容常驻 DOM，由外层 `.token-tooltip` 的 :hover 控制显隐。
 */

const formatTokens = (value?: number | null): string | undefined => {
  if (typeof value !== 'number' || !isFinite(value)) return undefined;
  if (value >= 1_000) {
    const k = value / 1_000;
    return Number.isInteger(k) ? `${k}k` : `${k.toFixed(1)}k`;
  }
  return `${value}`;
};

const formatPercent = (value?: number | null): string | null => {
  if (typeof value !== 'number' || !isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${Math.round(rounded)}%` : `${rounded.toFixed(1)}%`;
};

type UsageRowProps = {
  label: string;
  tokens?: number | null;
  note?: string | null;
};

const UsageRow = ({ label, tokens, note }: UsageRowProps) => {
  const text = formatTokens(tokens);
  if (!text) return null;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{text}</span>
      </div>
      {note ? <p className="text-[10px] leading-tight text-muted-foreground/70">{note}</p> : null}
    </div>
  );
};

export const ClaudeContextCard = ({
  usage,
}: {
  usage: ClaudeContextUsageViewModel;
}) => {
  const { t } = useTranslation();

  const usedPercentLabel = formatPercent(usage.usedPercent);
  const usedTokensText = formatTokens(usage.usedTokens);
  const contextWindowText = formatTokens(usage.contextWindow);
  const inputText = formatTokens(usage.inputTokens);
  const cachedText = formatTokens(usage.cachedInputTokens);

  const barValue = typeof usage.usedPercent === 'number' && isFinite(usage.usedPercent)
    ? Math.min(Math.max(usage.usedPercent, 0), 100)
    : null;

  // header 右侧的窗口用量：优先 已用/总量；退化到"估算 tokens"或"等待回传"
  const windowText = usedTokensText && contextWindowText
    ? `${usedTokensText} / ${contextWindowText}`
    : usedTokensText
      ? t(
        usage.freshness === 'live'
          ? 'chat.claudeContextWindowUsedOnly'
          : 'chat.claudeContextWindowEstimatedTokens',
        { tokens: usedTokensText },
      )
      : t('chat.claudeContextUnavailable');

  const cachedNote = cachedText
    ? t('chat.claudeContextCachedExcludedDetail', { tokens: cachedText })
    : null;

  const freshnessLabel = t(`chat.claudeContextFreshness.${usage.freshness}`, {
    defaultValue: t('chat.claudeContextFreshness.unknown'),
  });

  const categoryUsages = usage.categoryUsages ?? [];

  return (
    <div className="claude-context-card w-full min-w-60 divide-y divide-border overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
      {/* Header：百分比 + 已用/总量 + 进度条 */}
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-3 text-xs">
          {usedPercentLabel ? (
            <span className="font-medium">{usedPercentLabel}</span>
          ) : (
            <span className="text-muted-foreground">{t('chat.claudeContextTooltipTitle')}</span>
          )}
          <span className="font-mono tabular-nums text-muted-foreground">{windowText}</span>
        </div>
        {barValue !== null ? <Progress className="bg-muted" value={barValue} /> : null}
      </div>

      {/* Body：分项用量 */}
      {(inputText || formatTokens(usage.outputTokens) || cachedText || categoryUsages.length > 0) ? (
        <div className="space-y-1.5 p-3">
          <UsageRow label={t('chat.claudeContextInputLabel')} tokens={usage.inputTokens} />
          <UsageRow label={t('chat.claudeContextOutputLabel')} tokens={usage.outputTokens} />
          <UsageRow
            label={t('chat.claudeContextCacheLabel')}
            tokens={usage.cachedInputTokens}
            note={cachedNote}
          />
          {categoryUsages.length > 0 ? (
            <div className="claude-context-category-grid space-y-1 pt-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {t('chat.claudeContextCategoryTitle')}
              </p>
              {categoryUsages.map((item) => {
                const tokens = formatTokens(item.tokens) ?? String(item.tokens);
                const percent = formatPercent(item.percent);
                return (
                  <div
                    key={`${item.name}:${item.tokens}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="truncate text-muted-foreground">{item.name}</span>
                    <span className="font-mono tabular-nums">
                      {tokens}
                      {percent ? <span className="ml-1.5 text-muted-foreground">{percent}</span> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Footer：数据来源/新鲜度 */}
      <div className="flex items-center justify-between gap-3 bg-secondary p-3 text-xs">
        <span className="text-muted-foreground">{t('chat.claudeContextTooltipTitle')}</span>
        <span>{freshnessLabel}</span>
      </div>
    </div>
  );
};

export default ClaudeContextCard;
