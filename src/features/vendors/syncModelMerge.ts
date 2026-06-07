import type { SiteModel } from "../../services/tauri/vendors";
import type { CodexCustomModel } from "./types";

/**
 * 把"Sync Models from Site"弹窗的勾选结果并入管理模型列表。
 *
 * 安全双向 diff：仅作用于本次站点返回的模型（fetchedIds）。
 * - 站点未返回的现有模型一律保留，永不误删手动添加的模型。
 * - 命中的现有模型保留原对象，不覆盖用户自定义的 label/description。
 * - 取消勾选且本次返回的模型被移除；新勾选的以 id 作为默认 label 加入。
 */
export function mergeSyncedModels(
  current: readonly CodexCustomModel[],
  fetchedIds: ReadonlySet<string>,
  selectedIds: ReadonlySet<string>,
): CodexCustomModel[] {
  const kept = current.filter(
    (m) => !fetchedIds.has(m.id) || selectedIds.has(m.id),
  );
  const keptIds = new Set(kept.map((m) => m.id));
  const added = [...selectedIds]
    .filter((id) => !keptIds.has(id))
    .map((id): CodexCustomModel => ({ id, label: id }));
  return [...kept, ...added];
}

/** 弹窗打开时的预勾选集合：已维护且本次站点返回的模型 id。 */
export function initialSelectedIds(
  fetched: readonly SiteModel[],
  ownedIds: ReadonlySet<string>,
): Set<string> {
  return new Set(fetched.filter((m) => ownedIds.has(m.id)).map((m) => m.id));
}
