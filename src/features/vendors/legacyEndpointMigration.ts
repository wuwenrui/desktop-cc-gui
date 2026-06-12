/**
 * 旧服务地址一次性迁移：把存量配置里的裸 IP 端点替换为正式域名。
 *
 * 背景：new-api 与 lawhub 此前以 `http://47.239.143.243[:3000]` 直连，
 * 2026-06-12 起启用正式域名（model.codingrui.work / lawhub.codingrui.work）。
 * 新默认值已改，但存量用户的配置散在三处，启动时静默迁移：
 * - localStorage `skillhub.baseUrl`（skill 市场平台地址）
 * - Claude provider 的 `settingsConfig.env`（ANTHROPIC_BASE_URL 等）
 * - Codex provider 的 `configToml`（model_providers base_url）
 *
 * 幂等：替换完成后配置中不再含旧 host，重复执行为空操作。
 * 任何一步失败都不阻断启动（catch + console.warn）。
 *
 * 新增文件（fork-friendly）。
 */

import {
  getClaudeProviders,
  getCodexProviders,
  updateClaudeProvider,
  updateCodexProvider,
} from "../../services/tauri/vendors";
import {
  DEFAULT_SKILLHUB_BASE_URL,
  SKILLHUB_BASE_URL_KEY,
} from "../skill-market/platformConfig";
import type { CodexProviderConfig, ProviderConfig } from "./types";

/** 旧 new-api 直连地址（带 3000 端口）。 */
export const LEGACY_NEWAPI_HOST = "http://47.239.143.243:3000";
/** 旧 lawhub 直连地址（80 端口）。 */
export const LEGACY_LAWHUB_HOST = "http://47.239.143.243";
export const NEWAPI_DOMAIN = "https://model.codingrui.work";
export const LAWHUB_DOMAIN = DEFAULT_SKILLHUB_BASE_URL;

/**
 * 替换一段文本里的旧端点。顺序敏感：必须先替带 `:3000` 的 new-api 形式，
 * 再替裸 IP（lawhub）——后者是前者的前缀。
 */
export function migrateEndpointText(text: string): string {
  return text
    .replaceAll(LEGACY_NEWAPI_HOST, NEWAPI_DOMAIN)
    .replaceAll(LEGACY_LAWHUB_HOST, LAWHUB_DOMAIN);
}

/** env 对象迁移：只动字符串值；无变化返回原引用便于上层判断。 */
export function migrateEnv(
  env: Record<string, unknown>,
): { changed: boolean; next: Record<string, unknown> } {
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      const migrated = migrateEndpointText(value);
      next[key] = migrated;
      if (migrated !== value) {
        changed = true;
      }
    } else {
      next[key] = value;
    }
  }
  return changed ? { changed, next } : { changed: false, next: env };
}

function migrateSkillhubBaseUrl(): void {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(SKILLHUB_BASE_URL_KEY);
  } catch {
    return;
  }
  if (!stored) {
    return;
  }
  const normalized = stored.trim().replace(/\/+$/, "");
  if (normalized === LEGACY_LAWHUB_HOST || normalized === LEGACY_NEWAPI_HOST) {
    try {
      // 删除而非改写：回落到 DEFAULT_SKILLHUB_BASE_URL，未来默认值变更也自动生效。
      window.localStorage.removeItem(SKILLHUB_BASE_URL_KEY);
    } catch {
      // 写失败忽略：下次启动重试。
    }
  }
}

async function migrateClaudeProviders(): Promise<void> {
  const providers: ProviderConfig[] = await getClaudeProviders();
  for (const provider of providers) {
    const env = provider.settingsConfig?.env;
    if (!env) {
      continue;
    }
    const { changed, next } = migrateEnv(env);
    if (!changed) {
      continue;
    }
    // Rust 侧把 updates 反序列化为完整 ProviderConfig（必须含 id），整体回传。
    await updateClaudeProvider(provider.id, {
      ...provider,
      settingsConfig: { ...provider.settingsConfig, env: next },
    });
  }
}

async function migrateCodexProviders(): Promise<void> {
  const providers: CodexProviderConfig[] = await getCodexProviders();
  for (const provider of providers) {
    const toml = provider.configToml;
    if (!toml) {
      continue;
    }
    const migrated = migrateEndpointText(toml);
    if (migrated === toml) {
      continue;
    }
    await updateCodexProvider(provider.id, {
      ...provider,
      configToml: migrated,
    });
  }
}

/** 启动时调用一次；各步独立失败不影响其他步骤。 */
export async function migrateLegacyEndpoints(): Promise<void> {
  migrateSkillhubBaseUrl();
  try {
    await migrateClaudeProviders();
  } catch (error) {
    console.warn("[endpoint-migration] claude providers skipped:", error);
  }
  try {
    await migrateCodexProviders();
  } catch (error) {
    console.warn("[endpoint-migration] codex providers skipped:", error);
  }
}
