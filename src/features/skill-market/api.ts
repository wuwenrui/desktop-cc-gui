/**
 * skill 平台 HTTP 客户端（浏览公开 skill + 登录）。
 *
 * 与后端契约对齐（skillhub `skills_api.py` / `auth_api.py`）：
 * - `GET  /api/skills/public?q=&page=&size=` → `{items, total}`
 * - `POST /api/auth/login {newapi_key}`      → `{token}`
 *
 * 浏览公开列表无需 token；登录仅为将来 `mine` 预留。下载走 Rust 命令
 * `market_add_skill`（服务端直接拉 zip），前端不直接下载二进制。
 *
 * 新增文件（fork-friendly）：仅用浏览器 fetch，不引入 http 插件依赖。
 */

/** 与后端 `SkillResp` 对齐。 */
export type SkillResp = {
  id: number;
  name: string;
  display_name: string;
  description: string;
  visibility: string;
  latest_version: number;
  author?: string;
};

/** 与后端 `SkillListResp` 对齐。 */
export type SkillListResp = {
  items: SkillResp[];
  total: number;
};

/** 已装索引条目（与 Rust `InstalledEntry` 对齐；旧索引无 installed_at/display_name）。 */
export type InstalledEntry = {
  skill_id: number;
  version: number;
  installed_at?: number | null;
  display_name?: string | null;
};

/** 已装索引：name -> InstalledEntry（与 Rust `market_list_installed` 对齐）。 */
export type InstalledIndex = Record<string, InstalledEntry>;

export async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body?.detail === "string") {
      return body.detail;
    }
  } catch {
    // 非 JSON 错误体，回落到状态文本。
  }
  return `HTTP ${res.status}`;
}

/** 列公开 skill（搜索 + 分页）。 */
export async function fetchPublicSkills(params: {
  baseUrl: string;
  q?: string;
  page?: number;
  size?: number;
  signal?: AbortSignal;
}): Promise<SkillListResp> {
  const { baseUrl, q = "", page = 1, size = 20, signal } = params;
  const query = new URLSearchParams({
    q,
    page: String(page),
    size: String(size),
  });
  const res = await fetch(`${baseUrl}/api/skills/public?${query.toString()}`, {
    method: "GET",
    signal,
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return (await res.json()) as SkillListResp;
}

/** 用 new-api key 登录平台，拿 JWT（MVP 浏览/下载用不到，预留 mine）。 */
export async function loginPlatform(params: {
  baseUrl: string;
  newapiKey: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { baseUrl, newapiKey, signal } = params;
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newapi_key: newapiKey }),
    signal,
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}
