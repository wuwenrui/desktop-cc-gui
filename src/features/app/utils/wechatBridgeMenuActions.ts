type OpenSettings = (
  section: "advanced-features",
  highlightTarget: "wechat-bridge",
) => void;

type StartBridge = (options: { workspaceId: string | null }) => Promise<unknown>;

type PushErrorToast = (input: { title: string; message: string }) => unknown;

type StartWeChatBridgeFromMenuOptions = {
  workspaceId: string | null | undefined;
  openSettings: OpenSettings;
  startBridge: StartBridge;
  pushErrorToast: PushErrorToast;
  errorTitle: string;
};

export async function startWeChatBridgeFromMenu({
  workspaceId,
  openSettings,
  startBridge,
  pushErrorToast,
  errorTitle,
}: StartWeChatBridgeFromMenuOptions) {
  openSettings("advanced-features", "wechat-bridge");

  if (!workspaceId) {
    return;
  }

  try {
    await startBridge({ workspaceId });
  } catch (error) {
    pushErrorToast({
      title: errorTitle,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
