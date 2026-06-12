import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dispatchSelectSkill } from "../lawhub/pptSkill";
import type { SkillFileContentResp } from "./previewApi";
import {
  deriveCapabilities,
  deriveSubSkillIntro,
  extractExamplePhrases,
  parseSkillDescription,
  type SkillCapability,
} from "./skillMeta";
import type { SkillFileEntry } from "./skillTree";

/**
 * 已装 skill 的查看抽屉：只展示用户语言的「能做什么 / 怎么用」概览
 * （简介 = SKILL.md frontmatter description；能力清单 = sub-skills 文件名清洗，
 * 点击能力卡展开对应子技能的介绍；示例说法 = description 引号内的触发例句）。
 * 不展示文件树——律师用户只需要知道有哪些能力、怎么用。
 *
 * 数据全部来自本地磁盘（Rust `market_skill_tree` / `market_skill_file`），
 * 离线可用、不依赖平台（OpenSpec add-lawhub-skill-group-structure-preview Decision 2）。
 * 「用」动作复用 `ccgui:select-skill` 注入 Composer chip 后关闭抽屉。
 *
 * 新增文件（fork-friendly）。
 */

type TreeState =
  | { status: "loading" }
  | { status: "ready"; entries: SkillFileEntry[] }
  | { status: "error"; message: string };

type Props = {
  /** skill 目录名（= 平台 name，~/.claude/skills/<name>/）。 */
  name: string;
  /** 展示名，缺省回落 name。 */
  displayName?: string;
  onClose: () => void;
};

export function SkillStructureDrawer({ name, displayName, onClose }: Props) {
  const [tree, setTree] = useState<TreeState>({ status: "loading" });
  const [description, setDescription] = useState<string | null>(null);
  // 当前展开介绍的能力卡（子技能路径）；介绍内容按路径缓存。
  const [activeCapPath, setActiveCapPath] = useState<string | null>(null);
  const [capIntros, setCapIntros] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setTree({ status: "loading" });
    setDescription(null);
    setActiveCapPath(null);
    setCapIntros({});
    invoke<SkillFileEntry[]>("market_skill_tree", { name })
      .then((entries) => {
        if (!cancelled) {
          setTree({ status: "ready", entries: entries ?? [] });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setTree({ status: "error", message });
        }
      });
    // 概览简介：读 SKILL.md frontmatter description；失败仅隐藏简介区。
    invoke<SkillFileContentResp>("market_skill_file", {
      name,
      relPath: "SKILL.md",
    })
      .then((file) => {
        if (!cancelled) {
          setDescription(parseSkillDescription(file?.content ?? ""));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDescription(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const useSkill = useCallback(() => {
    dispatchSelectSkill(name);
    onClose();
  }, [name, onClose]);

  const capabilities = useMemo(
    () => (tree.status === "ready" ? deriveCapabilities(tree.entries) : []),
    [tree],
  );
  const examples = useMemo(
    () => (description ? extractExamplePhrases(description) : []),
    [description],
  );

  const toggleCapability = useCallback(
    (capability: SkillCapability) => {
      setActiveCapPath((prev) =>
        prev === capability.path ? null : capability.path,
      );
      if (capIntros[capability.path] !== undefined) {
        return;
      }
      void invoke<SkillFileContentResp>("market_skill_file", {
        name,
        relPath: capability.path,
      })
        .then((file) => {
          setCapIntros((prev) => ({
            ...prev,
            [capability.path]: deriveSubSkillIntro(file?.content ?? ""),
          }));
        })
        .catch(() => {
          setCapIntros((prev) => ({ ...prev, [capability.path]: "" }));
        });
    },
    [capIntros, name],
  );

  const activeCapability = useMemo(
    () =>
      activeCapPath
        ? capabilities.find((c) => c.path === activeCapPath) ?? null
        : null,
    [activeCapPath, capabilities],
  );

  return (
    <div
      className="skill-structure-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`技能结构：${displayName || name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="skill-structure-drawer">
        <div className="skill-structure-drawer-head">
          <div className="skill-structure-drawer-titles">
            <span className="skill-structure-drawer-title">
              {displayName || name}
              <span className="skill-structure-source-tag">lawhub</span>
            </span>
            <span className="skill-structure-drawer-path">
              ~/.claude/skills/{name}/
            </span>
          </div>
          <button
            type="button"
            className="skill-structure-use-btn"
            onClick={useSkill}
          >
            在对话框中使用
          </button>
          <button
            type="button"
            className="skill-structure-close"
            aria-label="关闭"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        {tree.status === "loading" && (
          <p className="skill-structure-hint">读取本地技能目录…</p>
        )}
        {tree.status === "error" && (
          <p className="skill-structure-error">读取失败：{tree.message}</p>
        )}
        {tree.status === "ready" && (
          <div className="skill-overview">
            {description && (
              <section className="skill-overview-section">
                <h4>什么时候用</h4>
                <p className="skill-overview-desc">{description}</p>
              </section>
            )}
            {capabilities.length > 0 && (
              <section className="skill-overview-section">
                <h4>能做什么</h4>
                <ul className="skill-overview-caps">
                  {capabilities.map((capability) => (
                    <li key={capability.path}>
                      <button
                        type="button"
                        className={
                          activeCapPath === capability.path ? "is-active" : ""
                        }
                        aria-expanded={activeCapPath === capability.path}
                        onClick={() => toggleCapability(capability)}
                      >
                        {capability.label}
                      </button>
                    </li>
                  ))}
                </ul>
                {activeCapability && (
                  <div className="skill-overview-cap-detail">
                    <strong>{activeCapability.label}</strong>
                    <p>
                      {capIntros[activeCapability.path] === undefined
                        ? "读取介绍…"
                        : capIntros[activeCapability.path] ||
                          "暂无介绍。可直接在对话框中使用，说明你的需求即可。"}
                    </p>
                  </div>
                )}
              </section>
            )}
            <section className="skill-overview-section">
              <h4>怎么用</h4>
              <p className="skill-overview-desc">
                点右上角「在对话框中使用」，回到对话框发送你的材料和要求即可；
                也可以在输入框输入 $ 选择本技能。
              </p>
              {examples.length > 0 && (
                <ul className="skill-overview-examples">
                  {examples.map((phrase) => (
                    <li key={phrase}>「{phrase}」</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
