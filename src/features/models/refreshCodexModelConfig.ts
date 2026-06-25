type RefreshCodexModelConfigOptions = {
  refreshModels: () => Promise<void> | void;
};

export async function refreshCodexModelConfig({
  refreshModels,
}: RefreshCodexModelConfigOptions): Promise<void> {
  await refreshModels();
}
