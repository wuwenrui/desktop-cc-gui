import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import { useAppSettingsController } from "../../app/hooks/useAppSettingsController";
import { useCodeCssVars } from "../../app/hooks/useCodeCssVars";
import { isMacPlatform, isWindowsPlatform } from "../../../utils/platform";
import { requestBrowserContextAttachment } from "../state/browserContextAttachmentCommands";
import {
  buildBrowserAgentDockWindowTitle,
  type BrowserAgentDockSession,
} from "../browserAgentDockWindow";
import { useBrowserAgentDockSession } from "../hooks/useBrowserAgentDockSession";
import { BrowserDock } from "./BrowserDock";

function resolveBrowserAgentDockTitle(session: BrowserAgentDockSession | null): string {
  return session ? buildBrowserAgentDockWindowTitle(session) : "Browser Dock";
}

export function DetachedBrowserAgentWindow() {
  const { t } = useTranslation();
  const { appSettings, reduceTransparency } = useAppSettingsController();
  useCodeCssVars(appSettings);
  const session = useBrowserAgentDockSession();
  const menubarRef = useRef<HTMLElement | null>(null);
  const isMacDesktop = useMemo(() => isMacPlatform(), []);
  const isWindowsDesktop = useMemo(() => isWindowsPlatform(), []);
  const appClassName = useMemo(
    () => `app layout-desktop${isWindowsDesktop ? " windows-desktop" : ""}${
      isMacDesktop ? " macos-desktop" : ""
    }${reduceTransparency ? " reduced-transparency" : ""}`,
    [isMacDesktop, isWindowsDesktop, reduceTransparency],
  );
  const detachedWindowStyle = useMemo(
    () =>
      ({
        "--ui-font-family": appSettings.uiFontFamily,
        "--code-font-family": appSettings.codeFontFamily,
        "--code-font-size": `${appSettings.codeFontSize}px`,
      }) as CSSProperties,
    [appSettings.codeFontFamily, appSettings.codeFontSize, appSettings.uiFontFamily],
  );
  const workspaceId = session?.workspaceId ?? null;

  useEffect(() => {
    void getCurrentWindow()
      .setTitle(resolveBrowserAgentDockTitle(session))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!isMacDesktop) {
      return;
    }
    const menubar = menubarRef.current;
    if (!(menubar instanceof HTMLElement)) {
      return;
    }
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || event.detail > 1) {
        return;
      }
      const target = event.target;
      const interactiveTarget =
        target instanceof Element
          ? target.closest(
              [
                '[data-window-drag-ignore="true"]',
                "button",
                "a",
                "input",
                "textarea",
                "select",
                "[role='button']",
              ].join(","),
            )
          : null;
      if (interactiveTarget) {
        return;
      }
      event.preventDefault();
      void (async () => {
        try {
          const windowHandle = getCurrentWindow();
          const fullscreen =
            typeof windowHandle.isFullscreen === "function"
              ? await windowHandle.isFullscreen()
              : false;
          if (fullscreen || typeof windowHandle.startDragging !== "function") {
            return;
          }
          await windowHandle.startDragging();
        } catch {
          // Ignore in non-Tauri test/runtime cases.
        }
      })();
    };
    menubar.addEventListener("mousedown", handleMouseDown);
    return () => {
      menubar.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isMacDesktop]);

  return (
    <div className={`${appClassName} browser-agent-detached-window`} style={detachedWindowStyle}>
      <header
        ref={menubarRef}
        className="browser-agent-detached-menubar"
        data-tauri-drag-region="true"
      >
        <div className="browser-agent-detached-menubar-copy" data-tauri-drag-region="true">
          <span className="browser-agent-detached-menubar-label" data-tauri-drag-region="true">
            {t("browserAgent.dock.panelTitle")}
          </span>
          {session?.workspaceName ? (
            <strong className="browser-agent-detached-menubar-title" data-tauri-drag-region="true">
              {session.workspaceName}
            </strong>
          ) : null}
        </div>
        <div className="browser-agent-detached-menubar-actions" data-window-drag-ignore="true">
          <button
            type="button"
            className="browser-agent-center-panel-attach"
            onClick={() => requestBrowserContextAttachment({ workspaceId })}
            disabled={!workspaceId}
            data-window-drag-ignore="true"
          >
            {t("browserAgent.composer.attach")}
          </button>
        </div>
      </header>
      <main className="browser-agent-detached-main">
        {workspaceId ? (
          <BrowserDock
            workspaceId={workspaceId}
            ownerSurface="browser-agent-dock-window"
            className="browser-agent-detached-dock browser-agent-center-panel-dock"
          />
        ) : (
          <div className="browser-agent-detached-empty">
            {t("browserAgent.dock.noWorkspace")}
          </div>
        )}
      </main>
    </div>
  );
}
