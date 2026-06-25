import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import { useAppSettingsController } from "../../app/hooks/useAppSettingsController";
import { useCodeCssVars } from "../../app/hooks/useCodeCssVars";
import { buildAppTypographyCssVars } from "../../app/utils/typographyCssVars";
import { useWorkspaceFiles } from "../../workspaces/hooks/useWorkspaceFiles";
import { useWindowFocusState } from "../../layout/hooks/useWindowFocusState";
import { DEFAULT_OPEN_APP_ID, DEFAULT_OPEN_APP_TARGETS } from "../../app/constants";
import { useGitStatus } from "../../git/hooks/useGitStatus";
import { getClientStoreSync } from "../../../services/clientStorage";
import {
  clearDetachedExternalChangeMonitor,
  configureDetachedExternalChangeMonitor,
} from "../../../services/tauri";
import { loadDetachedFileExplorerStyles } from "../../../styles/featureStyleLoaders";
import type { WorkspaceInfo } from "../../../types";
import { isMacPlatform, isWindowsPlatform } from "../../../utils/platform";
import {
  buildDetachedFileExplorerWindowTitle,
} from "../detachedFileExplorer";
import { useDetachedFileExplorerSession } from "../hooks/useDetachedFileExplorerSession";
import { useDetachedFileExplorerState } from "../hooks/useDetachedFileExplorerState";
import { FileExplorerWorkspace } from "./FileExplorerWorkspace";

const EMPTY_OPEN_APP_ICON_MAP: Record<string, string> = {};

function reportDetachedExternalChangeMonitorCleanupError(error: unknown) {
  console.warn("[files] Failed to clear detached external change monitor", error);
}

function buildDetachedWorkspaceInfo(session: {
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  gitRoot?: string | null;
}): WorkspaceInfo {
  return {
    id: session.workspaceId,
    name: session.workspaceName,
    path: session.workspacePath,
    connected: true,
    settings: {
      sidebarCollapsed: false,
      gitRoot: session.gitRoot ?? null,
    },
  };
}

export function DetachedFileExplorerWindow() {
  const { t } = useTranslation();
  const { appSettings, reduceTransparency } = useAppSettingsController();
  useCodeCssVars(appSettings);
  useEffect(() => {
    void loadDetachedFileExplorerStyles();
  }, []);
  const session = useDetachedFileExplorerSession();
  const isFocused = useWindowFocusState();
  const isMacDesktop = useMemo(() => isMacPlatform(), []);
  const isWindowsDesktop = useMemo(() => isWindowsPlatform(), []);
  const appClassName = useMemo(
    () => `app layout-desktop${isWindowsDesktop ? " windows-desktop" : ""}${
      isMacDesktop ? " macos-desktop" : ""
    }${reduceTransparency ? " reduced-transparency" : ""}`,
    [isMacDesktop, isWindowsDesktop, reduceTransparency],
  );
  const { codeFontFamily, codeFontSize, uiFontFamily } = appSettings;
  const detachedWindowStyle = useMemo(
    () =>
      buildAppTypographyCssVars({
        codeFontFamily,
        codeFontSize,
        uiFontFamily,
      }) as CSSProperties,
    [codeFontFamily, codeFontSize, uiFontFamily],
  );
  const activeWorkspace = useMemo(
    () => (session ? buildDetachedWorkspaceInfo(session) : null),
    [session],
  );
  const {
    files,
    directories,
    directoryMetadata,
    sourceVersion,
    gitignoredFiles,
    gitignoredDirectories,
    isLoading,
    loadError,
    refreshFiles,
  } = useWorkspaceFiles({
    activeWorkspace,
    pollingEnabled: isFocused,
  });
  const { status: gitStatus, refresh: refreshGitStatus } = useGitStatus(activeWorkspace, {
    pollingEnabled: isFocused,
  });
  const {
    openTabs,
    activeFilePath,
    navigationTarget,
    openFile,
    activateTab,
    closeTab,
    closeAllTabs,
  } = useDetachedFileExplorerState(
    session?.workspaceId ?? null,
    session?.workspacePath ?? null,
    session?.initialFilePath ?? null,
    session?.updatedAt ?? null,
  );
  const [selectedOpenAppId, setSelectedOpenAppId] = useState(
    () => getClientStoreSync<string>("app", "openWorkspaceApp") ?? DEFAULT_OPEN_APP_ID,
  );
  const [externalChangeTransportMode, setExternalChangeTransportMode] = useState<"watcher" | "polling">(
    "polling",
  );
  const openAppIconById = EMPTY_OPEN_APP_ICON_MAP;
  const externalChangeAwarenessEnabled =
    appSettings.detachedExternalChangeAwarenessEnabled !== false;
  const externalChangeWatcherEnabled =
    appSettings.detachedExternalChangeWatcherEnabled !== false;

  useEffect(() => {
    if (!session) {
      return;
    }
    void getCurrentWindow()
      .setTitle(buildDetachedFileExplorerWindowTitle(session))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session || !isFocused) {
      return;
    }
    void refreshFiles();
    void refreshGitStatus();
  }, [isFocused, refreshFiles, refreshGitStatus, session]);

  useEffect(() => {
    if (!session) {
      return;
    }
    let active = true;
    if (!externalChangeAwarenessEnabled || !isFocused || !activeFilePath) {
      setExternalChangeTransportMode("polling");
      void clearDetachedExternalChangeMonitor(session.workspaceId)
        .catch(reportDetachedExternalChangeMonitorCleanupError);
      return () => {
        active = false;
      };
    }

    void configureDetachedExternalChangeMonitor(
      session.workspaceId,
      session.workspacePath,
      activeFilePath,
      externalChangeWatcherEnabled,
    )
      .then(() => {
        if (!active) {
          return;
        }
        setExternalChangeTransportMode("watcher");
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setExternalChangeTransportMode("polling");
      });
    return () => {
      active = false;
    };
  }, [
    activeFilePath,
    externalChangeAwarenessEnabled,
    externalChangeWatcherEnabled,
    isFocused,
    session,
  ]);

  useEffect(() => {
    return () => {
      if (!session) {
        return;
      }
      void clearDetachedExternalChangeMonitor(session.workspaceId)
        .catch(reportDetachedExternalChangeMonitorCleanupError);
    };
  }, [session]);

  const renderCompactMenubar = () => (
    <header
      className="detached-file-explorer-menubar"
      data-tauri-drag-region="true"
    >
      <div className="detached-file-explorer-menubar-copy" data-tauri-drag-region="true">
        <span className="detached-file-explorer-menubar-label" data-tauri-drag-region="true">
          {t("files.detachedExplorerTitle")}
        </span>
        {session ? (
          <strong
            className="detached-file-explorer-menubar-title"
            data-tauri-drag-region="true"
          >
            {session.workspaceName}
          </strong>
        ) : null}
      </div>
    </header>
  );

  if (!session) {
    return (
      <div className={`${appClassName} detached-file-explorer-window`} style={detachedWindowStyle}>
        {renderCompactMenubar()}
        <div className="detached-file-explorer-unavailable">
          <p className="detached-file-explorer-empty-title">
            {t("files.detachedExplorerUnavailableTitle")}
          </p>
          <p className="detached-file-explorer-empty-body">
            {t("files.detachedExplorerUnavailableBody")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${appClassName} detached-file-explorer-window`} style={detachedWindowStyle}>
      {renderCompactMenubar()}
      <FileExplorerWorkspace
        workspaceId={session.workspaceId}
        workspaceName={session.workspaceName}
        workspacePath={session.workspacePath}
        gitRoot={session.gitRoot ?? null}
        files={files}
        directories={directories}
        directoryMetadata={directoryMetadata}
        sourceVersion={sourceVersion}
        isLoading={isLoading}
        loadError={loadError}
        gitignoredFiles={gitignoredFiles}
        gitignoredDirectories={gitignoredDirectories}
        gitStatusFiles={gitStatus.files}
        openTargets={DEFAULT_OPEN_APP_TARGETS}
        openAppIconById={openAppIconById}
        selectedOpenAppId={selectedOpenAppId}
        onSelectOpenAppId={setSelectedOpenAppId}
        openTabs={openTabs}
        activeFilePath={activeFilePath}
        navigationTarget={navigationTarget}
        onOpenFile={openFile}
        onActivateTab={activateTab}
        onCloseTab={closeTab}
        onCloseAllTabs={closeAllTabs}
        onRefreshFiles={refreshFiles}
        externalChangeMonitoringEnabled={isFocused && externalChangeAwarenessEnabled}
        externalChangeTransportMode={externalChangeTransportMode}
        fileViewHeaderLayout="single-row"
        defaultSidebarCollapsed={session.defaultSidebarCollapsed === true}
      />
    </div>
  );
}
