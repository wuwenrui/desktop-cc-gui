/**
 * lawhub skill 装前预览 HTTP 客户端。
 *
 * 与 lawhub 后端契约对齐（skills 模块预览 API）：
 * - `GET /api/skills/{id}/versions/{v}/files`        → `{files: [{path, size, is_dir}]}`
 * - `GET /api/skills/{id}/versions/{v}/files/{path}` → `{path, content, size, truncated}`
 *
 * 服务端在内存解析 zip，前端不落盘；权限与下载一致（公开匿名可读）。
 *
 * 新增文件（fork-friendly）：仅浏览器 fetch。
 */

import { parseError } from "./api";
import type { SkillFileEntry } from "./skillTree";

export type SkillFilesResp = {
  files: SkillFileEntry[];
};

export type SkillFileContentResp = {
  path: string;
  content: string;
  size: number;
  truncated: boolean;
};

/** 列 skill 某版本 zip 内的文件清单。 */
export async function fetchSkillFiles(params: {
  baseUrl: string;
  skillId: number;
  version: number;
  signal?: AbortSignal;
}): Promise<SkillFilesResp> {
  const { baseUrl, skillId, version, signal } = params;
  const res = await fetch(
    `${baseUrl}/api/skills/${skillId}/versions/${version}/files`,
    { method: "GET", signal },
  );
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return (await res.json()) as SkillFilesResp;
}

/** 读 skill 某版本 zip 内单个文本文件的内容。 */
export async function fetchSkillFileContent(params: {
  baseUrl: string;
  skillId: number;
  version: number;
  path: string;
  signal?: AbortSignal;
}): Promise<SkillFileContentResp> {
  const { baseUrl, skillId, version, path, signal } = params;
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const res = await fetch(
    `${baseUrl}/api/skills/${skillId}/versions/${version}/files/${encoded}`,
    { method: "GET", signal },
  );
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return (await res.json()) as SkillFileContentResp;
}
