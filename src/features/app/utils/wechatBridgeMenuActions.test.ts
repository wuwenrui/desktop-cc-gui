import { describe, expect, it, vi } from "vitest";
import { startWeChatBridgeFromMenu } from "./wechatBridgeMenuActions";

describe("wechatBridgeMenuActions", () => {
  it("opens the WeChat panel and starts the bridge for the active workspace", async () => {
    const openSettings = vi.fn();
    const startBridge = vi.fn().mockResolvedValue({});
    const pushErrorToast = vi.fn();

    await startWeChatBridgeFromMenu({
      workspaceId: "ws-1",
      openSettings,
      startBridge,
      pushErrorToast,
      errorTitle: "微信连接",
    });

      expect(openSettings).toHaveBeenCalledWith(
        "advanced-features",
        "wechat-bridge",
      );
    expect(startBridge).toHaveBeenCalledWith({ workspaceId: "ws-1" });
    expect(pushErrorToast).not.toHaveBeenCalled();
  });

  it("opens the WeChat panel without starting when no workspace is active", async () => {
    const openSettings = vi.fn();
    const startBridge = vi.fn().mockResolvedValue({});
    const pushErrorToast = vi.fn();

    await startWeChatBridgeFromMenu({
      workspaceId: null,
      openSettings,
      startBridge,
      pushErrorToast,
      errorTitle: "微信连接",
    });

      expect(openSettings).toHaveBeenCalledWith(
        "advanced-features",
        "wechat-bridge",
      );
    expect(startBridge).not.toHaveBeenCalled();
    expect(pushErrorToast).not.toHaveBeenCalled();
  });

  it("surfaces start failures without hiding the panel", async () => {
    const openSettings = vi.fn();
    const startBridge = vi.fn().mockRejectedValue(new Error("daemon down"));
    const pushErrorToast = vi.fn();

    await startWeChatBridgeFromMenu({
      workspaceId: "ws-1",
      openSettings,
      startBridge,
      pushErrorToast,
      errorTitle: "微信连接",
    });

      expect(openSettings).toHaveBeenCalledWith(
        "advanced-features",
        "wechat-bridge",
      );
    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "微信连接",
      message: "daemon down",
    });
  });
});
