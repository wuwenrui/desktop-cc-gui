import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import "./usage-badge.css";

/**
 * new-api 余额/用量快照（与 Rust `NewapiUsage` 结构体对齐）。
 * 所有金额字段单位为 CNY。换算依据：new-api `QuotaPerUnit = 500000`（1 USD = 500000 quota，
 * common/constants.go:62），CNY = quota / quota_per_unit * usd_exchange_rate，与 new-api 自身
 * 计费公式 controller/billing.go:50 完全一致。
 */
export type NewapiUsage = {
  granted_cny: number;
  used_cny: number;
  available_cny: number;
  unlimited: boolean;
};

const REFRESH_INTERVAL_MS = 60_000;

// 余额低于该阈值（CNY）时用警示色提醒，避免用户额度耗尽而不自知。
const LOW_BALANCE_THRESHOLD_CNY = 5;

// 货币格式化器：CNY、固定 2 位小数。currency 模式自带 ¥ 符号并做本地化分组，
// 比手写字符串更精确（避免漏掉千分位、符号位置不一致）。负值/NaN 归零，
// 防止 new-api 偶发的过额（available 轻微为负）被展示成 "-¥0.01" 这类异常文案。
const cnyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  currencyDisplay: "symbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCny(value: number): string {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  return cnyFormatter.format(safe);
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; usage: NewapiUsage }
  | { status: "error"; message: string };

/**
 * 常驻顶栏徽标：展示 new-api 余额与已用额度，每 60 秒刷新一次。
 *
 * 新增文件（fork-friendly）：调用上游已有的 `invoke` 调本 fork 的
 * `get_newapi_usage` 命令，不依赖任何上游业务组件。样式见 `usage-badge.css`，
 * 全量复用客户端设计 token，自动跟随明暗主题。
 */
export function UsageBadge() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const usage = await invoke<NewapiUsage>("get_newapi_usage");
        if (!cancelled) {
          setState({ status: "ready", usage });
        }
      } catch (error) {
        if (!cancelled) {
          const message = typeof error === "string" ? error : "用量获取失败";
          setState({ status: "error", message });
        }
      }
    }

    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (state.status === "loading") {
    return (
      <span className="usage-badge usage-badge--loading" title="正在获取 new-api 用量">
        <span className="usage-badge__spinner" aria-hidden="true" />
        <span className="usage-badge__text">用量加载中…</span>
      </span>
    );
  }

  if (state.status === "error") {
    return (
      <span
        className="usage-badge usage-badge--error"
        title={state.message}
        role="status"
      >
        <span className="usage-badge__dot" aria-hidden="true" />
        <span className="usage-badge__text">用量不可用</span>
      </span>
    );
  }

  const { usage } = state;

  if (usage.unlimited) {
    const used = formatCny(usage.used_cny);
    return (
      <span
        className="usage-badge usage-badge--ready usage-badge--unlimited"
        title={`已用 ${used}`}
        aria-label={`余额不限额，已用 ${used}`}
      >
        <span className="usage-badge__icon" aria-hidden="true">
          ∞
        </span>
        <span className="usage-badge__primary">
          <span className="usage-badge__label">余额</span>
          <span className="usage-badge__value">不限额</span>
        </span>
        <span className="usage-badge__sep" aria-hidden="true" />
        <span className="usage-badge__secondary">已用 {used}</span>
      </span>
    );
  }

  const available = formatCny(usage.available_cny);
  const used = formatCny(usage.used_cny);
  const isLow = usage.available_cny < LOW_BALANCE_THRESHOLD_CNY;

  return (
    <span
      className={`usage-badge usage-badge--ready${isLow ? " usage-badge--low" : ""}`}
      title={`总授予 ${formatCny(usage.granted_cny)}`}
      aria-label={`余额 ${available}，已用 ${used}`}
    >
      <span className="usage-badge__icon" aria-hidden="true">
        ¥
      </span>
      <span className="usage-badge__primary">
        <span className="usage-badge__label">余额</span>
        <span className="usage-badge__value">{available}</span>
      </span>
      <span className="usage-badge__sep" aria-hidden="true" />
      <span className="usage-badge__secondary">已用 {used}</span>
    </span>
  );
}
