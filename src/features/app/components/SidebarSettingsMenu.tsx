import Brain from "lucide-react/dist/esm/icons/brain";
import BriefcaseBusiness from "lucide-react/dist/esm/icons/briefcase-business";
import FileText from "lucide-react/dist/esm/icons/file-text";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import Lock from "lucide-react/dist/esm/icons/lock";
import Settings from "lucide-react/dist/esm/icons/settings";
import Wrench from "lucide-react/dist/esm/icons/wrench";
import type { RefObject } from "react";
import type { AppMode } from "../../../types";

type SidebarSettingsMenuProps = {
  isOpen: boolean;
  appMode: AppMode;
  menuRef: RefObject<HTMLDivElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  t: (key: string) => string;
  onToggleOpen: () => void;
  onClose: () => void;
  onOpenSkillsComingSoon: () => void;
  onLockPanel?: () => void;
  onOpenSpecHub: () => void;
  onOpenProjectMemory: () => void;
  onOpenEnvironment: () => void;
  onOpenReleaseNotes: () => void;
  onOpenSettings: () => void;
  onAppModeChange: (mode: AppMode) => void;
};

export function SidebarSettingsMenu({
  isOpen,
  appMode,
  menuRef,
  buttonRef,
  t,
  onToggleOpen,
  onClose,
  onOpenSkillsComingSoon,
  onLockPanel,
  onOpenSpecHub,
  onOpenProjectMemory,
  onOpenEnvironment,
  onOpenReleaseNotes,
  onOpenSettings,
  onAppModeChange,
}: SidebarSettingsMenuProps) {
  return (
    <div className="sidebar-settings-dropdown-wrapper">
      {isOpen && (
        <div
          className="sidebar-settings-dropdown"
          ref={menuRef}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            disabled
            onClick={() => {
              onClose();
              onOpenSkillsComingSoon();
            }}
          >
            <BriefcaseBusiness size={14} aria-hidden />
            <span>{t("sidebar.quickSkills")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onLockPanel?.();
            }}
          >
            <Lock size={14} aria-hidden />
            <span>{t("lockScreen.lock")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onOpenSpecHub();
            }}
          >
            <LayoutDashboard size={14} aria-hidden />
            <span>{t("sidebar.specHub")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onOpenProjectMemory();
            }}
          >
            <Brain size={14} aria-hidden />
            <span>{t("panels.memory")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={`sidebar-settings-dropdown-item${appMode === "gitHistory" ? " is-active" : ""}`}
            onClick={() => {
              onClose();
              onAppModeChange(appMode === "gitHistory" ? "chat" : "gitHistory");
            }}
          >
            <GitBranch size={14} aria-hidden />
            <span>{t("git.logMode")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onOpenEnvironment();
            }}
          >
            <Wrench size={14} aria-hidden />
            <span>{t("sidebar.environmentDependencies")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onOpenReleaseNotes();
            }}
          >
            <FileText size={14} aria-hidden />
            <span>{t("sidebar.releaseNotes")}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="sidebar-settings-dropdown-item"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          >
            <Settings size={14} aria-hidden />
            <span>{t("settings.title")}</span>
          </button>
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        className={`sidebar-primary-nav-item sidebar-primary-nav-item-bottom${isOpen ? " is-active" : ""}`}
        onClick={onToggleOpen}
        title={t("settings.title")}
        aria-label={t("settings.title")}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-tauri-drag-region="false"
      >
        <Settings className="sidebar-primary-nav-icon" aria-hidden />
      </button>
    </div>
  );
}
