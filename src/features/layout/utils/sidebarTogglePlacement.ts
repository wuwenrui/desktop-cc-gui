type SidebarTogglePlacementArgs = {
  isCompact: boolean;
  isMacDesktop: boolean;
  isSoloMode: boolean;
  sidebarCollapsed: boolean;
};

export function shouldShowSidebarTopbarSidebarToggle({
  isCompact,
  isSoloMode,
  sidebarCollapsed,
}: SidebarTogglePlacementArgs): boolean {
  return !isCompact && !isSoloMode && !sidebarCollapsed;
}

export function shouldShowMainTopbarSidebarToggle({
  isCompact,
  isSoloMode,
  sidebarCollapsed,
}: SidebarTogglePlacementArgs): boolean {
  return !isCompact && !isSoloMode && sidebarCollapsed;
}

export function shouldShowFloatingTitlebarSidebarToggle({
  showHome,
  showMainTopbarSidebarToggle,
}: {
  showHome: boolean;
  showMainTopbarSidebarToggle: boolean;
}): boolean {
  return showHome && showMainTopbarSidebarToggle;
}
