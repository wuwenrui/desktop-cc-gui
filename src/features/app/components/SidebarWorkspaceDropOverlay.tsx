type SidebarWorkspaceDropOverlayProps = {
  isActive: boolean;
  text: string;
  t: (key: string) => string;
};

export function SidebarWorkspaceDropOverlay({
  isActive,
  text,
  t,
}: SidebarWorkspaceDropOverlayProps) {
  return (
    <div
      className={`workspace-drop-overlay${isActive ? " is-active" : ""}`}
      aria-hidden
    >
      <div
        className={`workspace-drop-overlay-text${
          text === "Adding Project..." ? " is-busy" : ""
        }`}
      >
        {text === "Drop Project Here" && (
          <span className="codicon codicon-folder-opened workspace-drop-overlay-icon" aria-hidden />
        )}
        {text === "Drop Project Here"
          ? t("sidebar.dropProjectHere")
          : text === "Adding Project..."
            ? t("sidebar.addingProject")
            : text}
      </div>
    </div>
  );
}
