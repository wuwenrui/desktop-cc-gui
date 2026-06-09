import Cloud from "lucide-react/dist/esm/icons/cloud";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Presentation from "lucide-react/dist/esm/icons/presentation";
import { useCallback, useEffect, useState } from "react";
import { getWorkspaceFiles, readWorkspaceFile } from "../../../services/tauri";
import { openWorkspaceIn } from "../../../services/tauri/workspaceRuntime";
import { getPlatformBaseUrl } from "../../skill-market/platformConfig";
import {
  clearLawhubToken,
  getLawhubToken,
  LawhubError,
  loginLawhub,
  publishScheme,
  schemeViewerUrl,
  setLawhubToken,
} from "../../scheme-publish/api";
import { triggerPptSkill } from "../pptSkill";

/**
 * 侧栏主菜单里的「lawhub」父级入口：点击在侧栏内联展开（非弹窗），下挂 PPT：
 * - 制作 PPT：触发 bundled skill `制作PPT`（附加 skill chip，不暴露提示词正文）
 * - 列出当前工作区的 *.html：点文件名 → 系统浏览器本地预览；点「发布」→ 上传到
 *   lawhub 并打开协作查看器（首次未登录时就地展开紧凑登录表单）
 *
 * 复用 sidebar-primary-nav 原生样式，观感与其它主菜单一致。
 */
function basename(p: string): string {
  const segs = p.split("/");
  return segs[segs.length - 1] || p;
}

function joinPath(root: string, rel: string): string {
  return `${root.replace(/\/+$/, "")}/${rel.replace(/^\/+/, "")}`;
}

export function LawhubNavSection({
  activeWorkspaceId,
  workspacePath,
}: {
  activeWorkspaceId: string | null;
  workspacePath: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loginFor, setLoginFor] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const reload = useCallback(async () => {
    if (!activeWorkspaceId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    try {
      const r = await getWorkspaceFiles(activeWorkspaceId);
      setFiles(r.files.filter((f) => f.toLowerCase().endsWith(".html")));
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (expanded) void reload();
  }, [expanded, reload]);

  const preview = useCallback(
    (rel: string) => {
      if (workspacePath) void openWorkspaceIn(joinPath(workspacePath, rel), {});
    },
    [workspacePath],
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

          {files.map((f) => (
            <div className="lawhub-file-row" key={f}>
              <button
                type="button"
                className="lawhub-file-name"
                onClick={() => preview(f)}
                title={`预览 ${f}`}
              >
                {basename(f)}
              </button>
              <button
                type="button"
                className="lawhub-file-publish"
                onClick={() => publish(f)}
                title="发布到 lawhub 协作批注"
              >
                发布
              </button>
            </div>
          ))}

          {!loading && files.length === 0 && (
            <div className="lawhub-hint">
              {activeWorkspaceId
                ? "暂无 PPT，点「制作 PPT」生成"
                : "请先选择一个工作区"}
            </div>
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

          {status && <div className="lawhub-hint">{status}</div>}
        </>
      )}
    </>
  );
}
