import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

/**
 * new-api 余额/用量快照（与 Rust `NewapiUsage` 结构体对齐）。
 * 所有金额字段单位为 CNY。
 */
export type NewapiUsage = {
  granted_cny: number;
  used_cny: number;
  available_cny: number;
  unlimited: boolean;
};

const REFRESH_INTERVAL_MS = 60_000;

function formatCny(value: number): string {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; usage: NewapiUsage }
  | { status: "error"; message: string };

/**
 * 常驻顶栏徽标：展示 new-api 余额与已用额度，每 60 秒刷新一次。
 *
 * 新增文件（fork-friendly）：调用上游已有的 `invoke` 调本 fork 的
 * `get_newapi_usage` 命令，不依赖任何上游业务组件。
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
        用量加载中…
      </span>
    );
  }

  if (state.status === "error") {
    return (
      <span className="usage-badge usage-badge--error" title={state.message}>
        用量不可用
      </span>
    );
  }

  const { usage } = state;
  if (usage.unlimited) {
    return (
      <span
        className="usage-badge usage-badge--ready"
        title={`已用 ¥${formatCny(usage.used_cny)}`}
      >
        余额 不限额 · 已用 ¥{formatCny(usage.used_cny)}
      </span>
    );
  }

  return (
    <span
      className="usage-badge usage-badge--ready"
      title={`总授予 ¥${formatCny(usage.granted_cny)}`}
    >
      余额 ¥{formatCny(usage.available_cny)} · 已用 ¥{formatCny(usage.used_cny)}
    </span>
  );
}
