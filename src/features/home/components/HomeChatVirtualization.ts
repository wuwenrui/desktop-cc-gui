/**
 * HomeChat workspace picker virtualization helpers.
 *
 * The picker switches to `@tanstack/react-virtual` once the filtered workspace
 * count crosses the documented threshold. This module owns the threshold
 * constant and key derivation so the policy is unit-testable without
 * rendering the Popover content (which is portal-based and tricky in jsdom).
 */

export const HOME_CHAT_WORKSPACE_VIRTUALIZATION_MIN_ROWS = 100;

export function shouldVirtualizeWorkspaceList(rowCount: number): boolean {
  return rowCount >= HOME_CHAT_WORKSPACE_VIRTUALIZATION_MIN_ROWS;
}

type WorkspaceLike = { id: string; name?: string };

export function resolveWorkspaceVirtualItemKey(
  workspaces: ReadonlyArray<WorkspaceLike>,
  index: number,
): string {
  const workspace = workspaces[index];
  if (workspace) {
    return workspace.id;
  }
  return `workspace-fallback-${index}`;
}
