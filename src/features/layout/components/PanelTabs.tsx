import { memo, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Folder from "lucide-react/dist/esm/icons/folder";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import Globe2 from "lucide-react/dist/esm/icons/globe-2";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Brain from "lucide-react/dist/esm/icons/brain";
import Search from "lucide-react/dist/esm/icons/search";
import Activity from "lucide-react/dist/esm/icons/activity";
import LayoutList from "lucide-react/dist/esm/icons/layout-list";
import NotebookPen from "lucide-react/dist/esm/icons/notebook-pen";
import PenLine from "lucide-react/dist/esm/icons/pen-line";
import {
  ResponsiveIconToolbar,
  type ResponsiveIconToolbarItem,
} from "../../../components/ui/responsive-icon-toolbar";

export type PanelTabId =
  | "radar"
  | "git"
  | "files"
  | "search"
  | "notes"
  | "prompts"
  | "memory"
  | "activity";

export type PanelToolbarTabId = PanelTabId | "projectMap" | "intentCanvas";

type PanelTab = {
  id: PanelToolbarTabId;
  label: string;
  icon: ReactNode;
};

type PanelTabsProps = {
  active: PanelToolbarTabId;
  onSelect: (id: PanelToolbarTabId) => void;
  tabs?: PanelTab[];
  liveStates?: Partial<Record<PanelToolbarTabId, boolean>>;
  visibleTabs?: Partial<Record<PanelToolbarTabId, boolean>>;
};

// Toggle to show/hide prompts tab (set to true to re-enable)
const SHOW_PROMPTS_TAB = false;
// Toggle to show/hide git tab
const SHOW_GIT_TAB = true;

const tabIds: PanelToolbarTabId[] = ([
  "activity",
  "projectMap",
  "intentCanvas",
  "radar",
  "git",
  "files",
  "search",
  "notes",
  "prompts",
] as const).filter(
  (id) =>
    (id !== "prompts" || SHOW_PROMPTS_TAB) &&
    (id !== "git" || SHOW_GIT_TAB)
);

const tabIcons: Record<PanelToolbarTabId, ReactNode> = {
  radar: <LayoutList aria-hidden />,
  git: <GitBranch aria-hidden />,
  files: <Folder aria-hidden />,
  search: <Search aria-hidden />,
  notes: <NotebookPen aria-hidden />,
  memory: <Brain aria-hidden />,
  projectMap: <Globe2 aria-hidden />,
  intentCanvas: <PenLine aria-hidden />,
  activity: <Activity aria-hidden />,
  prompts: <ScrollText aria-hidden />,
};

const tabI18nKeys: Record<PanelToolbarTabId, string> = {
  radar: "panels.radar",
  git: "panels.git",
  files: "panels.files",
  search: "panels.search",
  notes: "panels.notes",
  memory: "panels.memory",
  projectMap: "panels.projectMap",
  intentCanvas: "panels.intentCanvas",
  activity: "panels.activity",
  prompts: "panels.prompts",
};

function PanelTabsImpl({
  active,
  onSelect,
  tabs,
  liveStates,
  visibleTabs,
}: PanelTabsProps) {
  const { t } = useTranslation();
  const resolvedTabs = useMemo(
    () =>
      tabs ??
      tabIds.map((id) => ({
        id,
        label: t(tabI18nKeys[id]),
        icon: tabIcons[id],
      })),
    [tabs, t],
  );
  const visibleResolvedTabs = useMemo(
    () => resolvedTabs.filter((tab) => visibleTabs?.[tab.id] !== false),
    [resolvedTabs, visibleTabs],
  );
  const toolbarItems = useMemo<ResponsiveIconToolbarItem[]>(
    () =>
      visibleResolvedTabs.map((tab, index) => {
        const isActive = active === tab.id;
        const isLive = Boolean(liveStates?.[tab.id]);
        return {
          id: tab.id,
          label: tab.label,
          icon: tab.icon,
          onSelect: () => onSelect(tab.id),
          priority: index,
          keepVisible: isActive || isLive,
          ariaCurrent: isActive ? "page" : undefined,
          buttonClassName: `panel-tab${isActive ? " is-active" : ""}${isLive ? " is-live" : ""}`,
          iconClassName: `panel-tab-icon${isLive ? " is-live" : ""}`,
          menuItemClassName: `panel-tab-menu-item${isActive ? " is-active" : ""}${isLive ? " is-live" : ""}`,
        };
      }),
    [active, liveStates, onSelect, visibleResolvedTabs],
  );
  if (toolbarItems.length === 0) {
    return null;
  }

  return (
    <ResponsiveIconToolbar
      className="panel-tabs"
      role="tablist"
      ariaLabel="Panel"
      items={toolbarItems}
      overflowLabel={t("common.moreActions")}
      itemWidth={29}
      overflowButtonWidth={30}
      collapseInactiveItems
    />
  );
}

export const PanelTabs = memo(PanelTabsImpl);
PanelTabs.displayName = "PanelTabs";
