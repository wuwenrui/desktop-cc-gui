import { loadSpecHubStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import { SpecHubOrchestrator } from "./spec-hub/orchestration/SpecHubOrchestrator";
import type { SpecHubProps } from "./SpecHub.presentational";

export function SpecHub(props: SpecHubProps) {
  const stylesReady = useFeatureStylesReady(loadSpecHubStyles);
  if (!stylesReady) {
    return null;
  }

  return <SpecHubOrchestrator {...props} />;
}
