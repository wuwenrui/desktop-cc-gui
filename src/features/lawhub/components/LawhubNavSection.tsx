import Cloud from "lucide-react/dist/esm/icons/cloud";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Presentation from "lucide-react/dist/esm/icons/presentation";
import FileText from "lucide-react/dist/esm/icons/file-text";
import ScanText from "lucide-react/dist/esm/icons/scan-text";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import BookOpen from "lucide-react/dist/esm/icons/book-open";
import Eye from "lucide-react/dist/esm/icons/eye";
import Plus from "lucide-react/dist/esm/icons/plus";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { getWorkspaceFiles, readWorkspaceFile } from "../../../services/tauri";
import { openWorkspaceIn } from "../../../services/tauri/workspaceRuntime";
import type { InstalledIndex } from "../../skill-market/api";
import {
  SKILL_INSTALLED_EVENT,
  sortInstalledSkills,
  type InstalledSkillItem,
} from "../../skill-market/installedSkills";
import { getPlatformBaseUrl } from "../../skill-market/platformConfig";
import {
  parseSkillDescription,
  summarizeDescription,
} from "../../skill-market/skillMeta";
import { openSkillMarketDialog } from "../../skill-market/skillMarketDialog";
import { SkillStructureDrawer } from "../../skill-market/SkillStructureDrawer";
import {
  clearLawhubToken,
  getLawhubToken,
  LawhubError,
  loginLawhub,
  publishScheme,
  schemeViewerUrl,
  setLawhubToken,
} from "../../scheme-publish/api";
import {
  dispatchSelectSkill,
  triggerFileToMarkdownSkill,
  triggerMakeSkillSkill,
  triggerPptSkill,
  triggerVisionOcrSkill,
} from "../pptSkill";

/**
 * 侧栏主菜单里的「lawhub」父级入口：点击在侧栏内联展开（非弹窗），分两组：
 *
 * - 「PPT」组：制作 PPT（触发 bundled skill）+ 当前工作区 *.html 产物
 *   （点文件名 → 系统默认方式打开；点「lawhub」→ 上传协作查看器，未登录就地登录）。
 *   产物按创建时间倒序；组头可折叠（localStorage 记忆）；默认露 5 条，
 *   超出走「显示全部」展开，列表自身限高内滚，不再撑爆侧栏。
 * - 「技能」组：文件转 Markdown / 视觉 OCR（bundled）+ lawhub 市场安装的 skill
 *   （按安装顺序排列；点名称注入 Composer chip；点眼睛查看本地结构）+ 「添加技能」
 *   直达 Skill 市场弹窗。
 *
 * 复用 sidebar-primary-nav 原生样式，观感与其它主菜单一致。
 * （OpenSpec change: add-lawhub-skill-group-structure-preview）
 */
function basename(p: string): string {
  const segs = p.split("/");
  return segs[segs.length - 1] || p;
}

/** 文件多时默认只露最近 N 条，其余收进「显示全部」。 */
const VISIBLE_FILE_LIMIT = 5;
const PPT_COLLAPSED_KEY = "ccgui.lawhub.pptCollapsed";

function readPptCollapsed(): boolean {
  try {
    return localStorage.getItem(PPT_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** 按创建时间倒序（取不到时间的排最后，保持原相对顺序）。 */
async function sortFilesByCreatedDesc(
  workspaceId: string,
  paths: string[],
): Promise<string[]> {
  if (paths.length <= 1) {
    return paths;
  }
  try {
    const times = await invoke<Array<number | null>>("workspace_file_times", {
      workspaceId,
      paths,
    });
    return paths
      .map((path, index) => ({ path, time: times[index] ?? 0, index }))
      .sort((a, b) => b.time - a.time || a.index - b.index)
      .map((entry) => entry.path);
  } catch {
    // 时间不可得（远程模式/旧后端）时保持原序，不阻断列表。
    return paths;
  }
}

export function LawhubNavSection({
  activeWorkspaceId,
}: {
  activeWorkspaceId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [pptCollapsed, setPptCollapsed] = useState(readPptCollapsed);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loginFor, setLoginFor] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [installedSkills, setInstalledSkills] = useState<InstalledSkillItem[]>(
    [],
  );
  const [viewingSkill, setViewingSkill] = useState<InstalledSkillItem | null>(
    null,
  );
  // 已装技能的悬浮简介（SKILL.md description），按名称懒取一次。
  const [skillTips, setSkillTips] = useState<Record<string, string>>({});
  const fetchedTipsRef = useRef<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!activeWorkspaceId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    try {
      const r = await getWorkspaceFiles(activeWorkspaceId);
      const html = r.files.filter((f) => f.toLowerCase().endsWith(".html"));
      setFiles(await sortFilesByCreatedDesc(activeWorkspaceId, html));
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  const togglePptCollapsed = useCallback(() => {
    setPptCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PPT_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // 持久化失败不影响本次交互。
      }
      return next;
    });
  }, []);

  const reloadInstalled = useCallback(async () => {
    try {
      const idx = await invoke<InstalledIndex>("market_list_installed");
      setInstalledSkills(sortInstalledSkills(idx ?? {}));
    } catch {
      // 索引不可读时按"无已装 skill"展示，不阻断其他功能。
      setInstalledSkills([]);
    }
  }, []);

  useEffect(() => {
    if (expanded) {
      void reload();
      void reloadInstalled();
    }
  }, [expanded, reload, reloadInstalled]);

  // 市场安装成功后实时刷新技能组（无需重新展开）。
  useEffect(() => {
    const onInstalled = () => void reloadInstalled();
    window.addEventListener(SKILL_INSTALLED_EVENT, onInstalled);
    return () => window.removeEventListener(SKILL_INSTALLED_EVENT, onInstalled);
  }, [reloadInstalled]);

  // 悬浮简介：展开后为每个已装技能取一次 SKILL.md 的 description。
  useEffect(() => {
    if (!expanded || installedSkills.length === 0) {
      return;
    }
    let cancelled = false;
    void (async () => {
      for (const skill of installedSkills) {
        if (fetchedTipsRef.current.has(skill.name)) {
          continue;
        }
        fetchedTipsRef.current.add(skill.name);
        try {
          const file = await invoke<{ content?: string }>("market_skill_file", {
            name: skill.name,
            relPath: "SKILL.md",
          });
          const description = parseSkillDescription(file?.content ?? "");
          if (!cancelled && description) {
            setSkillTips((prev) => ({
              ...prev,
              [skill.name]: summarizeDescription(description),
            }));
          }
        } catch {
          // 读不到就保留默认提示，不打扰。
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, installedSkills]);

  const preview = useCallback(
    async (rel: string) => {
      if (!activeWorkspaceId) return;
      try {
        // Rust 侧按系统默认程序打开（带工作区根校验），
        // 不走 JS openPath（opener:default 无 open-path 权限，必失败）。
        await invoke("open_workspace_path_default", {
          workspaceId: activeWorkspaceId,
          path: rel,
        });
      } catch {
        setStatus("打开失败");
      }
    },
    [activeWorkspaceId],
  );

  const doPublish = useCallback(
    async (rel: string, token: string) => {
      if (!activeWorkspaceId) return;
      setStatus(`发布中 ${basename(rel)}…`);
      try {
        const base = getPlatformBaseUrl();
        const { content } = await readWorkspaceFile(activeWorkspaceId, rel);
        const scheme = await publishScheme(base, token, {
          title: basename(rel),
          html: content,
        });
        await openWorkspaceIn(schemeViewerUrl(base, scheme.id), {});
        setStatus(null);
      } catch (e) {
        if (e instanceof LawhubError && e.status === 401) {
          clearLawhubToken();
          setLoginFor(rel);
          setStatus(null);
          return;
        }
        setStatus(e instanceof LawhubError ? e.message : "发布失败");
      }
    },
    [activeWorkspaceId],
  );

  const publish = useCallback(
    (rel: string) => {
      const token = getLawhubToken();
      if (!token) {
        setLoginFor(rel);
        return;
      }
      void doPublish(rel, token);
    },
    [doPublish],
  );

  const submitLogin = useCallback(async () => {
    const rel = loginFor;
    if (!rel) return;
    try {
      const base = getPlatformBaseUrl();
      const resp = await loginLawhub(base, username, password);
      setLawhubToken(resp.token);
      setLoginFor(null);
      setPassword("");
      await doPublish(rel, resp.token);
    } catch (e) {
      setStatus(e instanceof LawhubError ? e.message : "登录失败");
    }
  }, [loginFor, username, password, doPublish]);

  return (
    <>
      <button
        type="button"
        className="sidebar-primary-nav-item sidebar-primary-nav-subitem"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title="lawhub"
        data-tauri-drag-region="false"
      >
        <Cloud
          className="sidebar-primary-nav-icon"
          aria-hidden
          size={20}
          strokeWidth={1.8}
        />
        <span className="sidebar-primary-nav-text">lawhub</span>
        {expanded ? (
          <ChevronDown className="lawhub-chevron" aria-hidden size={16} />
        ) : (
          <ChevronRight className="lawhub-chevron" aria-hidden size={16} />
        )}
      </button>

      {expanded && (
        <>
          <button
            type="button"
            className="lawhub-group-label lawhub-group-toggle"
            onClick={togglePptCollapsed}
            aria-expanded={!pptCollapsed}
            title={pptCollapsed ? "展开 PPT 列表" : "收起 PPT 列表"}
            data-tauri-drag-region="false"
          >
            <span className="lawhub-group-toggle-text">PPT</span>
            {files.length > 0 && (
              <i className="lawhub-group-count">{files.length}</i>
            )}
            {pptCollapsed ? (
              <ChevronRight aria-hidden size={13} />
            ) : (
              <ChevronDown aria-hidden size={13} />
            )}
          </button>
          <button
            type="button"
            className="sidebar-primary-nav-item sidebar-primary-nav-subitem lawhub-subitem"
            onClick={() => triggerPptSkill()}
            title="用网页制作 PPT，表达力强于传统 PPT"
            data-tauri-drag-region="false"
          >
            <Presentation
              className="sidebar-primary-nav-icon"
              aria-hidden
              size={18}
              strokeWidth={1.8}
            />
            <span className="sidebar-primary-nav-text">制作 PPT</span>
          </button>

          {!pptCollapsed && (
            <>
              <div className="lawhub-file-list">
                {(showAllFiles ? files : files.slice(0, VISIBLE_FILE_LIMIT)).map(
                  (f) => (
                    <div className="lawhub-file-row" key={f}>
                      <button
                        type="button"
                        className="lawhub-file-name"
                        onClick={() => void preview(f)}
                        title={`预览 ${f}`}
                      >
                        {basename(f)}
                      </button>
                      <button
                        type="button"
                        className="lawhub-file-publish"
                        onClick={() => publish(f)}
                        title="在 lawhub 打开"
                      >
                        lawhub
                      </button>
                    </div>
                  ),
                )}
              </div>

              {files.length > VISIBLE_FILE_LIMIT && (
                <button
                  type="button"
                  className="lawhub-show-all"
                  onClick={() => setShowAllFiles((v) => !v)}
                  data-tauri-drag-region="false"
                >
                  {showAllFiles ? "收起" : `显示全部 ${files.length} 个`}
                </button>
              )}

              {!loading && files.length === 0 && (
                <div className="lawhub-hint">
                  {activeWorkspaceId
                    ? "暂无 PPT，点「制作 PPT」生成"
                    : "请先选择一个工作区"}
                </div>
              )}
            </>
          )}

          {loginFor && (
            <div className="lawhub-login">
              <input
                aria-label="lawhub 用户名"
                placeholder="lawhub 用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                aria-label="lawhub 密码"
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="lawhub-login-actions">
                <button type="button" onClick={() => void submitLogin()}>
                  登录并发布
                </button>
                <button type="button" onClick={() => setLoginFor(null)}>
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="lawhub-group-label">技能</div>
          <button
            type="button"
            className="sidebar-primary-nav-item sidebar-primary-nav-subitem lawhub-subitem"
            onClick={() => triggerFileToMarkdownSkill()}
            title="将文档、图片、截图或 PDF 转成 Markdown"
            data-tauri-drag-region="false"
          >
            <FileText
              className="sidebar-primary-nav-icon"
              aria-hidden
              size={18}
              strokeWidth={1.8}
            />
            <span className="sidebar-primary-nav-text">文件转 Markdown</span>
          </button>
          <button
            type="button"
            className="sidebar-primary-nav-item sidebar-primary-nav-subitem lawhub-subitem"
            onClick={() => triggerVisionOcrSkill()}
            title="识别图片、截图、扫描件或 PDF 页面"
            data-tauri-drag-region="false"
          >
            <ScanText
              className="sidebar-primary-nav-icon"
              aria-hidden
              size={18}
              strokeWidth={1.8}
            />
            <span className="sidebar-primary-nav-text">视觉 OCR</span>
          </button>
          <button
            type="button"
            className="sidebar-primary-nav-item sidebar-primary-nav-subitem lawhub-subitem"
            onClick={() => triggerMakeSkillSkill()}
            title="把你的工作方法、文书模板沉淀成可复用的个人技能。点击后在对话框描述想做什么即可"
            data-tauri-drag-region="false"
          >
            <Wrench
              className="sidebar-primary-nav-icon"
              aria-hidden
              size={18}
              strokeWidth={1.8}
            />
            <span className="sidebar-primary-nav-text">制作技能</span>
          </button>

          {installedSkills.map((skill) => (
            <div className="lawhub-file-row lawhub-skill-row" key={skill.name}>
              <button
                type="button"
                className="lawhub-file-name lawhub-skill-name"
                onClick={() => dispatchSelectSkill(skill.name)}
                title={
                  skillTips[skill.name]
                    ? `${skillTips[skill.name]}\n\n点击在对话框中使用`
                    : `在对话框中使用 ${skill.displayName}`
                }
              >
                <BookOpen
                  className="lawhub-skill-icon"
                  aria-hidden
                  size={15}
                  strokeWidth={1.8}
                />
                <span className="lawhub-skill-text">{skill.displayName}</span>
              </button>
              <button
                type="button"
                className="lawhub-file-publish"
                onClick={() => setViewingSkill(skill)}
                title={`查看 ${skill.displayName} 的结构`}
                aria-label={`查看 ${skill.displayName} 的结构`}
              >
                <Eye aria-hidden size={14} strokeWidth={1.8} />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="sidebar-primary-nav-item sidebar-primary-nav-subitem lawhub-subitem lawhub-add-skill"
            onClick={() => openSkillMarketDialog()}
            title="从 Skill 市场添加技能"
            data-tauri-drag-region="false"
          >
            <Plus
              className="sidebar-primary-nav-icon"
              aria-hidden
              size={18}
              strokeWidth={1.8}
            />
            <span className="sidebar-primary-nav-text">添加技能</span>
          </button>

          {status && <div className="lawhub-hint">{status}</div>}
        </>
      )}

      {viewingSkill && (
        <SkillStructureDrawer
          name={viewingSkill.name}
          displayName={viewingSkill.displayName}
          onClose={() => setViewingSkill(null)}
        />
      )}
    </>
  );
}
