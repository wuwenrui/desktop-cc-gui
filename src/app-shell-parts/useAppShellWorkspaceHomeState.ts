import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceInfo } from "../types";
import {
  getHomeWorkspaceOptions,
  resolveHomeWorkspaceId,
} from "../features/home/utils/homeWorkspaceOptions";
import { recordStartupMilestone } from "../features/startup-orchestration/utils/startupTrace";
import { recordStartupPerfMarker } from "../services/perfBaseline/startupMarkers";

type WorkspaceHomeStateParams = {
  activeWorkspaceId: string | null;
  appSettingsLoading: boolean;
  groupedWorkspaces: Parameters<typeof getHomeWorkspaceOptions>[0];
  hasLoaded: boolean;
  workspaces: WorkspaceInfo[];
};

export function useAppShellWorkspaceHomeState({
  activeWorkspaceId,
  appSettingsLoading,
  groupedWorkspaces,
  hasLoaded,
  workspaces,
}: WorkspaceHomeStateParams) {
  const inputReadyMilestoneRecordedRef = useRef(false);

  useEffect(() => {
    if (inputReadyMilestoneRecordedRef.current || appSettingsLoading || !hasLoaded) {
      return;
    }
    inputReadyMilestoneRecordedRef.current = true;
    recordStartupMilestone("input-ready");
    recordStartupPerfMarker("first-interactive");
  }, [appSettingsLoading, hasLoaded]);

  const workspacesById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces],
  );
  const workspacesByPath = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.path, workspace])),
    [workspaces],
  );
  const [homeOpen, setHomeOpen] = useState(true);
  const homeWorkspaceOptions = useMemo(
    () => getHomeWorkspaceOptions(groupedWorkspaces, workspaces),
    [groupedWorkspaces, workspaces],
  );
  const homeWorkspaceDefaultId = homeWorkspaceOptions[0]?.id ?? null;
  const homeWorkspaceSelectedId = useMemo(
    () => resolveHomeWorkspaceId(activeWorkspaceId, homeWorkspaceOptions),
    [activeWorkspaceId, homeWorkspaceOptions],
  );

  return {
    homeOpen,
    homeWorkspaceDefaultId,
    homeWorkspaceSelectedId,
    setHomeOpen,
    workspacesById,
    workspacesByPath,
  };
}
