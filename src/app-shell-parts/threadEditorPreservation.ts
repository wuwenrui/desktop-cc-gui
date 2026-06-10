export function shouldPreserveEditorOnThreadSelect({
  isCompact,
  centerMode,
  activeWorkspaceId,
  targetWorkspaceId,
  activeEditorFilePath,
}: {
  isCompact: boolean;
  centerMode: "chat" | "diff" | "editor" | "memory" | "projectMap" | "intentCanvas";
  activeWorkspaceId: string | null | undefined;
  targetWorkspaceId: string;
  activeEditorFilePath: string | null | undefined;
}) {
  return Boolean(
    !isCompact &&
      centerMode === "editor" &&
      activeEditorFilePath &&
      activeWorkspaceId === targetWorkspaceId,
  );
}

export function getThreadSelectDiffCleanupAction(preserveEditor: boolean) {
  return preserveEditor ? "clear-selected-diff" : "exit-diff-view";
}

export function shouldCollapseRightPanelOnThreadSelect({
  preserveEditor,
  requestedCollapse,
}: {
  preserveEditor: boolean;
  requestedCollapse: boolean;
}) {
  return requestedCollapse && !preserveEditor;
}
