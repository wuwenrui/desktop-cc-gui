import type { EngineType, RuntimeLifecycleState, RuntimePoolRow } from "../../../types";

export function resolveRuntimeLifecycleForComposer(
  rows: readonly RuntimePoolRow[] | undefined,
  workspaceId: string | null,
  engine: EngineType | undefined,
): RuntimeLifecycleState | null {
  if (!workspaceId || !engine || !rows) {
    return null;
  }
  return (
    rows.find((row) => row.workspaceId === workspaceId && row.engine === engine)
      ?.lifecycleState ?? null
  );
}
