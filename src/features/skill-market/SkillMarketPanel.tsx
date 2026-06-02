import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import {
  type InstalledIndex,
  type SkillResp,
  fetchPublicSkills,
} from "./api";
import {
  getPlatformBaseUrl,
  setPlatformBaseUrl,
} from "./platformConfig";

/**
 * Skill 市场面板：浏览平台公开 skill、搜索、一键添加/更新到 ~/.claude/skills。
 *
 * 新增文件（fork-friendly）：用上游已有的 `invoke` 调本 fork 的
 * `market_add_skill` / `market_list_installed`，列表走平台 fetch，不依赖
 * 任何上游业务组件。
 *
 * 添加 vs 更新判定：对比本地已装版本（`market_list_installed`）与平台
 * `latest_version`，本地无 → "添加"；本地版本 < 最新 → "有更新"；相等 → "已是最新"。
 */

type ListState =
  | { status: "loading" }
  | { status: "ready"; items: SkillResp[]; total: number }
  | { status: "error"; message: string };

/** 单条 skill 的添加/更新进行中状态。 */
type RowBusy = Record<number, boolean>;

function decideAction(
  skill: SkillResp,
  installed: InstalledIndex,
): "add" | "update" | "up-to-date" {
  const entry = installed[skill.name];
  if (!entry) {
    return "add";
  }
  return entry.version < skill.latest_version ? "update" : "up-to-date";
}

export function SkillMarketPanel() {
  const [baseUrl, setBaseUrl] = useState<string>(() => getPlatformBaseUrl());
  const [baseUrlDraft, setBaseUrlDraft] = useState<string>(baseUrl);
  const [query, setQuery] = useState<string>("");
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [installed, setInstalled] = useState<InstalledIndex>({});
  const [busy, setBusy] = useState<RowBusy>({});
  const [rowError, setRowError] = useState<Record<number, string>>({});

  const loadInstalled = useCallback(async () => {
    try {
      const idx = await invoke<InstalledIndex>("market_list_installed");
      setInstalled(idx ?? {});
    } catch {
      // 已装索引读失败不阻断浏览：全部按"未装"处理。
      setInstalled({});
    }
  }, []);

  const loadList = useCallback(
    async (signal?: AbortSignal) => {
      setList({ status: "loading" });
      try {
        const resp = await fetchPublicSkills({ baseUrl, q: query, signal });
        setList({ status: "ready", items: resp.items, total: resp.total });
      } catch (error) {
        if (signal?.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : "加载失败";
        setList({ status: "error", message });
      }
    },
    [baseUrl, query],
  );

  useEffect(() => {
    void loadInstalled();
  }, [loadInstalled]);

  useEffect(() => {
    const controller = new AbortController();
    void loadList(controller.signal);
    return () => controller.abort();
  }, [loadList]);

  const handleApplyBaseUrl = useCallback(() => {
    const next = setPlatformBaseUrl(baseUrlDraft);
    setBaseUrlDraft(next);
    setBaseUrl(next);
  }, [baseUrlDraft]);

  const handleAdd = useCallback(
    async (skill: SkillResp) => {
      setBusy((prev) => ({ ...prev, [skill.id]: true }));
      setRowError((prev) => {
        const next = { ...prev };
        delete next[skill.id];
        return next;
      });
      try {
        await invoke("market_add_skill", {
          baseUrl,
          skillId: skill.id,
          version: skill.latest_version,
          name: skill.name,
        });
        await loadInstalled();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setRowError((prev) => ({ ...prev, [skill.id]: message }));
      } finally {
        setBusy((prev) => ({ ...prev, [skill.id]: false }));
      }
    },
    [baseUrl, loadInstalled],
  );

  return (
    <div className="skill-market-panel">
      <div className="skill-market-config">
        <input
          aria-label="平台地址"
          className="skill-market-baseurl"
          value={baseUrlDraft}
          onChange={(e) => setBaseUrlDraft(e.target.value)}
          placeholder="http://47.239.143.243:8100"
        />
        <button type="button" onClick={handleApplyBaseUrl}>
          应用地址
        </button>
      </div>

      <form
        className="skill-market-search"
        onSubmit={(e) => {
          e.preventDefault();
          void loadList();
        }}
      >
        <input
          aria-label="搜索 skill"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索公开 skill"
        />
        <button type="button" onClick={() => void loadList()}>
          搜索
        </button>
      </form>

      {list.status === "loading" && <p className="skill-market-hint">加载中…</p>}

      {list.status === "error" && (
        <p className="skill-market-error">加载失败：{list.message}</p>
      )}

      {list.status === "ready" && list.items.length === 0 && (
        <p className="skill-market-hint">暂无公开 skill</p>
      )}

      {list.status === "ready" && list.items.length > 0 && (
        <ul className="skill-market-list">
          {list.items.map((skill) => {
            const action = decideAction(skill, installed);
            const isBusy = Boolean(busy[skill.id]);
            const err = rowError[skill.id];
            return (
              <li key={skill.id} className="skill-market-item">
                <div className="skill-market-item-main">
                  <span className="skill-market-item-name">
                    {skill.display_name || skill.name}
                  </span>
                  <span className="skill-market-item-version">
                    v{skill.latest_version}
                  </span>
                  <p className="skill-market-item-desc">{skill.description}</p>
                </div>
                <div className="skill-market-item-actions">
                  {action === "up-to-date" ? (
                    <span className="skill-market-uptodate">已是最新</span>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleAdd(skill)}
                    >
                      {isBusy
                        ? "处理中…"
                        : action === "update"
                          ? "有更新"
                          : "添加"}
                    </button>
                  )}
                  {err && <span className="skill-market-error">{err}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
