import { useTranslation } from 'react-i18next';
import { ClaudeContextCard } from './ClaudeContextCard';
import type { TokenIndicatorProps } from './types';

/**
 * TokenIndicator - Usage ring progress bar component
 * Implemented using SVG dual-circle approach
 */
export const TokenIndicator = ({
  percentage,
  size = 14,
  usedTokens,
  maxTokens,
  claudeContextUsage = null,
}: TokenIndicatorProps) => {
  const { t } = useTranslation();
  // Circle radius (accounting for stroke space)
  const radius = (size - 3) / 2;
  const center = size / 2;

  // Circumference
  const circumference = 2 * Math.PI * radius;
  const resolvedPercentage = typeof percentage === 'number' && isFinite(percentage)
    ? Math.max(percentage, 0)
    : null;
  const clampedPercentage = resolvedPercentage !== null
    ? Math.min(resolvedPercentage, 100)
    : 0;

  // Calculate offset (fill clockwise from top)
  const strokeOffset = circumference * (1 - clampedPercentage / 100);

  // Round percentage to one decimal place, but hide trailing .0
  const formatPercent = (value: number | null) => {
    if (value === null) {
      return '...';
    }
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded)
      ? `${Math.round(rounded)}%`
      : `${rounded.toFixed(1)}%`;
  };

  const formattedPercentage = formatPercent(resolvedPercentage);

  // 没有任何可用数据时（会话刚开始、还没有 token 用量），不渲染孤零零的空圆环
  // 与占位气泡；等有百分比或 Claude 上下文数据后再显示。
  if (resolvedPercentage === null && !claudeContextUsage) {
    return null;
  }

  const formatTokens = (value?: number | null) => {
    if (typeof value !== 'number' || !isFinite(value)) return undefined;
    // Always display capacity in k (thousands) units
    // e.g.: 1,000,000 -> 1000k, 500,000 -> 500k
    if (value >= 1_000) {
      const kValue = value / 1_000;
      // If it's a whole number, don't show decimal point
      return Number.isInteger(kValue) ? `${kValue}k` : `${kValue.toFixed(1)}k`;
    }
    return `${value}`;
  };

  const usedText = formatTokens(usedTokens);
  const maxText = formatTokens(maxTokens);
  const tooltip = usedText && maxText
    ? `${formattedPercentage} · ${usedText} / ${maxText} ${' '}${t('chat.context')}`
    : t('chat.usagePercentage', { percentage: formattedPercentage });
  const tokenIndicatorClassName = [
    'token-indicator',
    resolvedPercentage === null ? 'token-indicator--pending' : null,
    claudeContextUsage ? 'token-indicator--claude' : null,
  ].filter(Boolean).join(' ');
  const tooltipClassName = [
    'token-tooltip',
    claudeContextUsage ? 'token-tooltip--claude' : null,
  ].filter(Boolean).join(' ');

  return (
    <div className={tokenIndicatorClassName}>
      {resolvedPercentage !== null ? (
        <span className="token-percentage-label">{formattedPercentage}</span>
      ) : null}
      <div className="token-indicator-wrap">
        <svg
          className="token-indicator-ring"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle */}
          <circle
            className="token-indicator-bg"
            cx={center}
            cy={center}
            r={radius}
          />
          {/* Progress arc */}
          <circle
            className="token-indicator-fill"
            cx={center}
            cy={center}
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
          />
        </svg>
        {/* Hover tooltip */}
        <div className={tooltipClassName}>
          {claudeContextUsage ? (
            <ClaudeContextCard usage={claudeContextUsage} />
          ) : (
            tooltip
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenIndicator;
