/**
 * skill 平台基址配置。
 *
 * 运行时可配：优先读 localStorage 的 `skillhub.baseUrl`，缺省回落到
 * dev 默认 `http://47.239.143.243:8100`。所有读写都做 trim + 去尾斜杠归一化。
 *
 * 新增文件（fork-friendly）：不依赖任何上游模块。
 */

export const SKILLHUB_BASE_URL_KEY = "skillhub.baseUrl";
export const DEFAULT_SKILLHUB_BASE_URL = "http://47.239.143.243:8100";

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/** 读取平台基址；非法/缺省回落到 dev 默认值。 */
export function getPlatformBaseUrl(): string {
  try {
    const stored = window.localStorage.getItem(SKILLHUB_BASE_URL_KEY);
    if (stored) {
      const normalized = normalizeBaseUrl(stored);
      if (normalized) {
        return normalized;
      }
    }
  } catch {
    // localStorage 不可用（如某些沙箱）时静默回落，不抛错。
  }
  return DEFAULT_SKILLHUB_BASE_URL;
}

/** 持久化平台基址（归一化后写入 localStorage）。 */
export function setPlatformBaseUrl(raw: string): string {
  const normalized = normalizeBaseUrl(raw) || DEFAULT_SKILLHUB_BASE_URL;
  try {
    window.localStorage.setItem(SKILLHUB_BASE_URL_KEY, normalized);
  } catch {
    // 忽略写入失败：下次仍回落默认值。
  }
  return normalized;
}
