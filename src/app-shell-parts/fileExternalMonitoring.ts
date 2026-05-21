type MainFileExternalMonitoringOptions = {
  activeWorkspace: unknown;
  activeEditorFilePath: string | null | undefined;
};

export function shouldEnableMainFileExternalChangeMonitoring({
  activeWorkspace,
  activeEditorFilePath,
}: MainFileExternalMonitoringOptions): boolean {
  return Boolean(activeWorkspace && activeEditorFilePath);
}
