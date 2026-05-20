type MainFileExternalMonitoringOptions = {
  activeWorkspace: unknown;
  activeEditorFilePath: string | null | undefined;
  liveEditPreviewEnabled: boolean;
};

export function shouldEnableMainFileExternalChangeMonitoring({
  activeWorkspace,
  activeEditorFilePath,
  liveEditPreviewEnabled,
}: MainFileExternalMonitoringOptions): boolean {
  return Boolean(liveEditPreviewEnabled && activeWorkspace && activeEditorFilePath);
}

