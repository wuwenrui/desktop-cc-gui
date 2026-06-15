import type { ComponentProps } from "react";
import { GitHistoryPanel as GitHistoryPanelImpl } from "./git-history-panel/components";
import {
  buildFileTreeItems,
  getDefaultColumnWidths,
} from "./git-history-panel/utils";
import { loadGitHistoryStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";

export function GitHistoryPanel(props: ComponentProps<typeof GitHistoryPanelImpl>) {
  const stylesReady = useFeatureStylesReady(loadGitHistoryStyles);
  if (!stylesReady) {
    return null;
  }

  return <GitHistoryPanelImpl {...props} />;
}

export { buildFileTreeItems, getDefaultColumnWidths };
