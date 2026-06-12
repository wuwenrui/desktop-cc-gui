import "./skill-market.css";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import {
  type InstalledIndex,
  type SkillResp,
  fetchPublicSkills,
} from "./api";
import { notifySkillInstalled } from "./installedSkills";
import {
  getPlatformBaseUrl,
  setPlatformBaseUrl,
} from "./platformConfig";
import { fetchSkillFileContent, fetchSkillFiles } from "./previewApi";
import { SkillStructureView } from "./SkillStructureView";
import type { SkillFileEntry } from "./skillTree";

/**
 * Skill 市场面板：浏览平台公开 skill、搜索、装前预览、一键添加/更新到 ~/.claude/skills。
 *
 * 新增文件（fork-friendly）：用上游已有的 `invoke` 调本 fork 的
 * `market_add_skill` / `market_list_installed`，列表走平台 fetch，不依赖
 * 任何上游业务组件。
 *
 * 添加 vs 更新判定：对比本地已装版本（`market_list_installed`）与平台
 * `latest_version`，本地无 → "添加"；本地版本 < 最新 → "有更新"；相等 → "已是最新"。
 *
 * 装前预览（OpenSpec add-lawhub-skill-group-structure-preview）：点击条目
 * 调 lawhub 预览 API 在线渲染文件树与内容，不落盘；安装成功后广播
 * `ccgui:skill-market-installed` 供侧栏技能组刷新。
 */

type ListState =
  | { status: "loading" }
  | { status: "ready"; items: SkillResp[]; total: number }
  | { status: "error"; message: string };

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; entries: SkillFileEntry[] }
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
  const [selected, setSelected] = useState<SkillResp | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });

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

  // 装前预览：选中条目后在线拉文件清单（不落盘）。
  useEffect(() => {
    if (!selected) {
      setPreview({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setPreview({ status: "loading" });
    fetchSkillFiles({
      baseUrl,
      skillId: selected.id,
      version: selected.latest_version,
      signal: controller.signal,
    })
      .then((resp) => setPreview({ status: "ready", entries: resp.files }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setPreview({ status: "error", message });
      });
    return () => controller.abort();
  }, [selected, baseUrl]);

  const loadPreviewFile = useCallback(
    (path: string) => {
      if (!selected) {
        return Promise.reject(new Error("未选择 skill"));
      }
      return fetchSkillFileContent({
        baseUrl,
        skillId: selected.id,
        version: selected.latest_version,
        path,
      });
    },
    [baseUrl, selected],
  );

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
          displayName: skill.display_name || null,
        });
        await loadInstalled();
        notifySkillInstalled(skill.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setRowError((prev) => ({ ...prev, [skill.id]: message }));
      } finally {
        setBusy((prev) => ({ ...prev, [skill.id]: false }));
      }
    },
    [baseUrl, loadInstalled],
  );

  const renderAction = (skill: SkillResp) => {
    const action = decideAction(skill, installed);
    const isBusy = Boolean(busy[skill.id]);
    if (action === "up-to-date") {
      return <span className="skill-market-uptodate">已是最新</span>;
    }
    return (
      <button
        type="button"
        disabled={isBusy}
        onClick={(e) => {
          // 不冒泡到条目选中，避免添加时触发一次预览加载。
          e.stopPropagation();
          void handleAdd(skill);
        }}
      >
        {isBusy ? "处理中…" : action === "update" ? "有更新" : "添加"}
      </button>
    );
  };

  return (
    <div className="skill-market-panel skill-market-panel-split">
      <div className="skill-market-config">
        <input
          aria-label="平台地址"
          className="skill-market-baseurl"
          value={baseUrlDraft}
          onChange={(e) => setBaseUrlDraft(e.target.value)}
          placeholder="https://lawhub.codingrui.work"
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
        <div className="skill-market-body">
          <ul className="skill-market-list">
            {list.items.map((skill) => {
              const err = rowError[skill.id];
              return (
                <li
                  key={skill.id}
                  className={`skill-market-item${
                    selected?.id === skill.id ? " is-selected" : ""
                  }`}
                  onClick={() => setSelected(skill)}
                >
                  <div className="skill-market-item-main">
                    <span className="skill-market-item-name">
                      {skill.display_name || skill.name}
                    </span>
                    <span className="skill-market-item-version">
                      v{skill.latest_version}
                    </span>
                    <span className="skill-market-item-author">
                      作者：{skill.author || "未知"}
                    </span>
                    <p className="skill-market-item-desc">{skill.description}</p>
                  </div>
                  <div className="skill-market-item-actions">
                    {renderAction(skill)}
                    {err && <span className="skill-market-error">{err}</span>}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="skill-market-preview">
            {!selected && (
              <p className="skill-market-hint">点击左侧技能查看装前预览</p>
            )}
            {selected && (
              <>
                <div className="skill-market-preview-head">
                  <span className="skill-market-preview-title">
                    {selected.display_name || selected.name}
                  </span>
                  <span className="skill-market-item-version">
                    v{selected.latest_version}
                  </span>
                  {renderAction(selected)}
                </div>
                {preview.status === "loading" && (
                  <p className="skill-market-hint">在线解析 skill 内容…</p>
                )}
                {preview.status === "error" && (
                  <p className="skill-market-error">
                    在线预览不可用：{preview.message}
                  </p>
                )}
                {preview.status === "ready" && (
                  <SkillStructureView
                    entries={preview.entries}
                    loadFile={loadPreviewFile}
                  />
                )}
                <p className="skill-market-preview-note">
                  装前预览 · 内容由平台在线解析，未写入本地
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
