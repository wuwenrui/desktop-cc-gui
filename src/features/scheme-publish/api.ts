/**
 * lawhub 方案发布客户端（方案预览 + 协作批注）。
 *
 * 桌面端把本地 PPT HTML 发布到 lawhub `schemes` 模块，并打开 lawhub web
 * 查看器 URL 进行协作批注。鉴权复用 lawhub 现有「用户名/密码 → JWT」
 * （`POST /api/auth/login {username,password}`），owner_id 与 lawhub web 一致，
 * 保证桌面端发布的方案在 web 端同一用户可见。
 *
 * 与 skill-market 的 `loginPlatform` 区分：后者契约是旧 skillhub `{newapi_key}`，
 * 这里按当前 lawhub `auth/router.py` 的 `{username,password}` 契约实现。
 *
 * 新增文件（fork-friendly）：仅用浏览器 fetch，不引入 http 插件依赖。
 */

const LAWHUB_TOKEN_KEY = "lawhub.token";

export class LawhubError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "LawhubError";
    this.status = status;
  }
}

export interface LawhubUser {
  readonly id: number;
  readonly username: string;
}

export interface LawhubLoginResp {
  readonly token: string;
  readonly user: LawhubUser;
}

export interface PublishSchemeReq {
  readonly title: string;
  readonly html: string;
}

export interface SchemeResp {
  readonly id: number;
  readonly title: string;
}

export function getLawhubToken(): string | null {
  try {
    return window.localStorage.getItem(LAWHUB_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setLawhubToken(token: string): void {
  try {
    window.localStorage.setItem(LAWHUB_TOKEN_KEY, token);
  } catch {
    // localStorage 不可用时静默：发布会因无 token 报错，符合预期。
  }
}

export function clearLawhubToken(): void {
  try {
    window.localStorage.removeItem(LAWHUB_TOKEN_KEY);
  } catch {
    // 忽略
  }
}

function normalizeBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function schemeViewerUrl(baseUrl: string, id: number): string {
  return `${normalizeBase(baseUrl)}/schemes/${id}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body?.detail === "string") {
      return body.detail;
    }
  } catch {
    // 非 JSON 错误体，回落到状态码。
  }
  return `HTTP ${res.status}`;
}

export async function loginLawhub(
  baseUrl: string,
  username: string,
  password: string,
): Promise<LawhubLoginResp> {
  const res = await fetch(`${normalizeBase(baseUrl)}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new LawhubError(res.status, await parseError(res));
  }
  return (await res.json()) as LawhubLoginResp;
}

export async function publishScheme(
  baseUrl: string,
  token: string,
  body: PublishSchemeReq,
): Promise<SchemeResp> {
  if (!token) {
    throw new LawhubError(401, "未登录 lawhub，无法发布方案");
  }
  const res = await fetch(`${normalizeBase(baseUrl)}/api/schemes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new LawhubError(res.status, await parseError(res));
  }
  return (await res.json()) as SchemeResp;
}
