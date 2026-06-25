// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "@/types";
import {
  createWechatBridgeManualSubscriptionOrder,
  getNewapiEntitlementAccount,
  getNewapiEntitlements,
  getWechatBridgeSubscriptionPlans,
  getWechatBridgeStatus,
  runWechatBridgeDiagnostics,
  saveNewapiEntitlementAccount,
  resetWechatBridgeLogin,
  sendWechatBridgeVerificationPrompt,
  startWechatBridge,
  stopWechatBridge,
  type NewapiEntitlements,
  type WeChatBridgeStatus,
} from "@/services/tauri";
import { WeChatBridgeSettings } from "./WeChatBridgeSettings";

vi.mock("@/services/tauri", () => ({
  createWechatBridgeManualSubscriptionOrder: vi.fn(),
  getNewapiEntitlementAccount: vi.fn(),
  getNewapiEntitlements: vi.fn(),
  getWechatBridgeSubscriptionPlans: vi.fn(),
  getWechatBridgeStatus: vi.fn(),
  runWechatBridgeDiagnostics: vi.fn(),
  saveNewapiEntitlementAccount: vi.fn(),
  resetWechatBridgeLogin: vi.fn(),
  sendWechatBridgeVerificationPrompt: vi.fn(),
  startWechatBridge: vi.fn(),
  stopWechatBridge: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("antd", () => ({
  QRCode: ({ value }: { value: string }) => (
    <div data-testid="wechat-login-qrcode" data-value={value} />
  ),
}));

const copyTextMock = vi.fn();

const t = (key: string) =>
  ({
    "settings.wechatBridgeTitle": "WeChat connection",
    "settings.wechatBridgeDescription": "Connect a local WeChat test account and route messages through the current workspace.",
      "settings.wechatBridgeEntitlementActive": "WeChat advanced feature active",
      "settings.wechatBridgeEntitlementInactive": "WeChat advanced feature inactive",
      "settings.wechatBridgeEntitlementExpiresAt": "Expires",
      "settings.wechatBridgeEntitlementRequestFailedHelp": "Could not connect to the model site. Refresh and try again.",
      "settings.wechatBridgeNoSubscriptionPlan": "No available plan",
      "settings.wechatBridgeAccountTitle": "Model-site account",
      "settings.wechatBridgeAccountConfigured": "Configured from {{source}} · {{token}}",
      "settings.wechatBridgeAccountMissing": "Configure the model-site key for subscription and entitlement checks. This does not switch Claude providers.",
      "settings.wechatBridgeAccountSourceExplicit": "Advanced Features",
      "settings.wechatBridgeAccountSourceProvider": "Model Provider",
      "settings.wechatBridgeAccountSourceClaudeSettings": "Claude Settings",
      "settings.wechatBridgeConfigureModelSiteKey": "Configure model-site key",
      "settings.wechatBridgeChangeModelSiteKey": "Change key",
      "settings.wechatBridgeModelSiteBaseUrl": "Model-site URL",
      "settings.wechatBridgeModelSiteApiKey": "API key",
      "settings.wechatBridgeSaveModelSiteKey": "Save and refresh",
      "settings.wechatBridgeSavingModelSiteKey": "Saving...",
      "settings.wechatBridgeModelSiteKeySaved": "Model-site key saved.",
      "settings.wechatBridgeModelSiteKeySaveFailed": "Save failed",
      "settings.wechatBridgeNewapiMissingHelp": "Model site key is not configured. Configure it before creating an order.",
      "settings.wechatBridgeSubscribe": "Subscribe WeChat advanced feature",
      "settings.wechatBridgeSubscriptionOrderTitle": "Subscription order",
    "settings.wechatBridgeSubscriptionOrderHelp": "Pay with the QR code, then wait for admin confirmation.",
    "settings.wechatBridgeSubscriptionQrAlt": "Payment QR code",
    "settings.wechatBridgeSubscriptionTradeNo": "Order number",
    "settings.wechatBridgeSubscriptionMoney": "Amount",
    "settings.wechatBridgeSubscriptionPaidCheck": "I have paid, refresh status",
    "settings.wechatBridgeSubscriptionChecking": "Checking...",
    "settings.wechatBridgeSubscriptionPendingConfirm": "Payment is still waiting for manual confirmation.",
    "settings.wechatBridgeSubscriptionConfirmed": "Payment confirmed. WeChat advanced feature is active.",
    "settings.wechatBridgeKeepOnlineTitle": "Keep WeChat online",
    "settings.wechatBridgeKeepOnlineDescription": "Automatically restore the WeChat channel when the desktop app is open.",
    "settings.wechatBridgeStart": "Start WeChat",
    "settings.wechatBridgeStop": "Stop WeChat",
    "settings.wechatBridgeRebind": "Rebind WeChat",
    "settings.wechatBridgeRebindConfirm": "Clear the current WeChat login and show a new QR code?",
    "settings.wechatBridgeSendProbe": "Send verification to WeChat",
    "settings.wechatBridgeSendProbeConfirm": "Send a verification message to the WeChat account used for scan?",
    "settings.wechatBridgeProbeSent": "Verification message sent. Reply from WeChat in that chat.",
    "settings.wechatBridgeBoundReady": "WeChat is already bound. Send verification to that chat.",
    "settings.wechatBridgeBoundMissing": "No bound WeChat account found. Rebind WeChat and scan again.",
    "settings.wechatBridgeBoundAccount": "Bound WeChat",
    "settings.wechatBridgeBoundUnknown": "Bound account detected",
    "settings.wechatBridgeTargetWorkspace": "Controls workspace",
    "settings.wechatBridgeNoBoundAccount": "Scan to bind WeChat",
    "settings.wechatBridgeRecentMessage": "Recent message",
    "settings.wechatBridgeNoRecentMessage": "No WeChat message yet",
    "settings.wechatBridgeAdvanced": "Connection details",
    "settings.wechatBridgeCopyLoginLink": "Copy login link",
    "settings.wechatBridgeQrTitle": "Scan login",
    "settings.wechatBridgeTestTitle": "Final check",
    "settings.wechatBridgeTestWaitingScan": "Scan the QR code, then send the test message from WeChat.",
    "settings.wechatBridgeTestRunning": "Send the test message from WeChat. A correct route replies OK.",
    "settings.wechatBridgeTestIdle": "Start the connection, scan the QR code, then send the test message.",
    "settings.wechatBridgeTestMessageLabel": "Test message",
    "settings.wechatBridgeCopyTestMessage": "Copy test message",
    "settings.wechatBridgeBoundaryTitle": "Use boundary",
    "settings.wechatBridgeBoundaryText": "Text, voice, images, files, and quoted messages are forwarded to the desktop agent.",
    "settings.wechatBridgeBoundaryRisk": "Use a test account first; WeChat account policy risk is not controlled by this app.",
    "settings.wechatBridgeActivityTitle": "Recent WeChat message",
    "settings.wechatBridgeActivityEmpty": "No WeChat message has reached this app yet.",
    "settings.wechatBridgeActivityAllow": "WeChat message received and replied.",
    "settings.wechatBridgeActivityDeny": "WeChat message reached the app but was blocked for safety.",
    "settings.wechatBridgeActivityError": "WeChat message reached the app, but the desktop reply failed.",
    "settings.wechatBridgeActivitySmokeOnly": "Local self-check passed. Waiting for a real WeChat message.",
    "settings.wechatBridgeActivityTime": "Last update",
    "settings.wechatBridgeMediaTitle": "Recent media",
    "settings.wechatBridgeMediaEmpty": "No real WeChat image or file has reached this app yet.",
    "settings.wechatBridgeMediaSaved": "Image or file reached the app and was saved for desktop analysis.",
    "settings.wechatBridgeMediaFailed": "Image or file reached the WeChat component, but saving failed. Run diagnostics.",
    "settings.wechatBridgeMediaSkipped": "A non-text WeChat message was skipped by the current route. Restart WeChat connection and resend it.",
    "settings.wechatBridgeMediaUnsupported": "A WeChat image or file reached the component, but its message shape is not supported yet. Run diagnostics.",
    "settings.wechatBridgeMediaTime": "Media time",
    "settings.wechatBridgeQuoteTitle": "Recent quote",
    "settings.wechatBridgeQuoteEmpty": "No quoted WeChat message has reached this app yet.",
    "settings.wechatBridgeQuoteParsed": "Quoted message reached the app and was forwarded as context.",
    "settings.wechatBridgeQuoteUnparsed": "A quoted WeChat message reached the component, but its reference fields need support.",
    "settings.wechatBridgeQuoteShape": "A WeChat message with extra fields reached the component. Run diagnostics if quote parsing is missing.",
    "settings.wechatBridgeQuoteTime": "Quote time",
    "settings.wechatBridgeVerificationTitle": "Real WeChat check",
    "settings.wechatBridgeVerificationWaiting": "Waiting for the test message after scan.",
    "settings.wechatBridgeVerificationSmokeOnly": "Local self-check passed. Real WeChat check is still pending.",
    "settings.wechatBridgeVerificationPassed": "Verified: real WeChat message reached the app and got a reply.",
    "settings.wechatBridgeVerificationNeedsAction": "Real WeChat message reached the app, but the reply did not complete.",
    "settings.wechatBridgeVerificationChecklistTitle": "Acceptance checklist",
    "settings.wechatBridgeVerificationTextTitle": "Text reply",
    "settings.wechatBridgeVerificationTextWaiting": "Send any text from WeChat and wait for a reply.",
    "settings.wechatBridgeVerificationTextDone": "Text reached the app and got a reply.",
    "settings.wechatBridgeVerificationMediaTitle": "Image or file input",
    "settings.wechatBridgeVerificationMediaWaiting": "Send one image or file from WeChat.",
    "settings.wechatBridgeVerificationMediaDone": "Image or file reached the app and was saved.",
    "settings.wechatBridgeVerificationQuoteTitle": "Quoted message",
    "settings.wechatBridgeVerificationQuoteWaiting": "Quote a previous WeChat message and ask a follow-up.",
    "settings.wechatBridgeVerificationQuoteDone": "Quoted message reached the app as context.",
    "settings.wechatBridgeCopied": "Copied",
    "settings.wechatBridgeCopyFailed": "Copy failed",
    "settings.wechatBridgeNoWorkspace": "No workspace selected",
    "settings.wechatBridgePhaseNotReady": "Connection component required",
    "settings.wechatBridgePhaseStopped": "Stopped",
    "settings.wechatBridgePhaseStarting": "Starting",
    "settings.wechatBridgePhaseWaitingScan": "Waiting for scan",
    "settings.wechatBridgePhaseRunning": "Running",
    "settings.wechatBridgePhaseError": "Connection error",
    "settings.wechatBridgeDaemon": "Local daemon",
    "settings.wechatBridgeBridge": "Message bridge",
    "settings.wechatBridgeWeclaw": "WeChat component",
    "settings.wechatBridgeComponentMissing": "Missing",
    "settings.wechatBridgeComponentRunning": "Running",
    "settings.wechatBridgeComponentStopped": "Stopped",
    "settings.wechatBridgeInstallGuide": "Install WeChat component",
    "settings.wechatBridgeInstallHelp": "Install the missing WeChat connection component, then refresh this panel.",
    "settings.wechatBridgeDiagnostics": "Run diagnostics",
    "settings.wechatBridgeDiagnosticsPassed": "Passed",
    "settings.wechatBridgeDiagnosticsNeedsAction": "Needs action",
    "settings.wechatBridgeDiagnosticComponent": "Connection components",
    "settings.wechatBridgeDiagnosticDaemon": "Local background",
    "settings.wechatBridgeDiagnosticBridge": "Message route",
    "settings.wechatBridgeDiagnosticWeclaw": "WeChat login",
    "settings.wechatBridgeDiagnosticWeclawSync": "WeChat message polling",
    "settings.wechatBridgeDiagnosticScan": "Scan status",
    "settings.wechatBridgeSyncFresh": "WeChat connector is online and polling. Waiting for a real WeChat message.",
    "settings.wechatBridgeSyncStale": "WeChat connector is running, but message polling has not refreshed recently.",
    "settings.refresh": "Refresh",
    "settings.running": "Running...",
    "settings.copy": "Copy",
  })[key] ?? key;

const workspace: WorkspaceInfo = {
  id: "ws-a",
  name: "Workspace A",
  path: "/tmp/ws-a",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function status(overrides: Partial<WeChatBridgeStatus>): WeChatBridgeStatus {
  return {
    phase: "stopped",
    bridgeRunning: false,
    weclawRunning: false,
    daemonRunning: false,
    bridgeAvailable: true,
    weclawAvailable: true,
    daemonHost: "127.0.0.1:4732",
    bridgeEndpoint: "http://127.0.0.1:18012/v1/chat/completions",
    qrText: null,
    loginUrl: null,
    logPath: null,
    lastError: null,
    lastActivity: null,
    hasLocalSmokeActivity: false,
    lastMediaActivity: null,
    lastQuoteActivity: null,
    wechatBound: false,
    weclawSyncFresh: false,
    weclawSyncAgeSecs: null,
    ...overrides,
  };
}

async function clickEnabledButton(name: string) {
  const button = await screen.findByRole("button", { name });
  await waitFor(() => {
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
  fireEvent.click(button);
}

describe("WeChatBridgeSettings", () => {
  beforeEach(() => {
      vi.mocked(createWechatBridgeManualSubscriptionOrder).mockReset();
      vi.mocked(getNewapiEntitlementAccount).mockReset();
      vi.mocked(getNewapiEntitlements).mockReset();
      vi.mocked(getWechatBridgeSubscriptionPlans).mockReset();
    vi.mocked(getWechatBridgeStatus).mockReset();
      vi.mocked(runWechatBridgeDiagnostics).mockReset();
      vi.mocked(saveNewapiEntitlementAccount).mockReset();
    vi.mocked(resetWechatBridgeLogin).mockReset();
    vi.mocked(sendWechatBridgeVerificationPrompt).mockReset();
    vi.mocked(startWechatBridge).mockReset();
    vi.mocked(stopWechatBridge).mockReset();
    vi.mocked(openUrl).mockReset();
      copyTextMock.mockReset();
      vi.mocked(getNewapiEntitlementAccount).mockResolvedValue({
        baseUrl: "https://model.codingrui.work",
        hasToken: true,
        tokenPreview: "sk-...1234",
        source: "provider",
      });
      vi.mocked(getNewapiEntitlements).mockResolvedValue({
      features: { wechat_bridge: true },
      entitlements: {
        wechat_bridge: {
          feature_key: "wechat_bridge",
          active: true,
          expires_at: 1_800_000_000,
          plan_id: 1,
          plan_title: "WeChat Pro",
        },
      },
    });
    vi.mocked(getWechatBridgeSubscriptionPlans).mockResolvedValue([]);
    Object.assign(navigator, {
      clipboard: { writeText: copyTextMock.mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders missing component state without starting partial work", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({ phase: "not_ready", weclawAvailable: false }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("Connection component required")).toBeTruthy();
    expect(screen.getByText("Install WeChat component")).toBeTruthy();
    expect(screen.queryByText("WeChat component")).toBeNull();
  });

  it("opens the install guide when the WeChat component is missing", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({ phase: "not_ready", weclawAvailable: false }),
    );
    vi.mocked(openUrl).mockResolvedValue(undefined);

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    await screen.findByText("Connection component required");
    fireEvent.click(screen.getByRole("button", { name: "Install WeChat component" }));

    await waitFor(() => {
      expect(openUrl).toHaveBeenCalledWith(
        "https://github.com/fastclaw-ai/weclaw/blob/main/README_CN.md#快速开始",
      );
    });
  });

  it("creates a WeChat advanced feature subscription order when inactive", async () => {
    vi.mocked(getNewapiEntitlements).mockResolvedValue({
      features: { wechat_bridge: false },
      entitlements: {},
    });
    vi.mocked(getWechatBridgeSubscriptionPlans).mockResolvedValue([
      { plan: { id: 7, title: "WeChat Pro", price_amount: 199 } },
    ]);
    vi.mocked(createWechatBridgeManualSubscriptionOrder).mockResolvedValue({
      trade_no: "SUBMAN7",
      money: 199,
      payment_method: "manual_wechat",
      payment_name: "WeChat",
      qr_url: "https://pay.example/qr.png",
      instructions: "Pay and wait for confirmation.",
      plan: { id: 7 },
    });
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    await clickEnabledButton("Subscribe WeChat advanced feature");

    await waitFor(() => {
      expect(createWechatBridgeManualSubscriptionOrder).toHaveBeenCalledWith({
        planId: 7,
        paymentMethod: "manual_wechat",
      });
    });
    expect(await screen.findByText("Subscription order")).toBeTruthy();
    expect(screen.getByText("SUBMAN7")).toBeTruthy();
  });

  it("checks the pending manual payment and hides the payment card after confirmation", async () => {
    let paymentConfirmed = false;
    const inactiveEntitlements: NewapiEntitlements = {
      features: { wechat_bridge: false },
      entitlements: {},
    };
    const activeEntitlements: NewapiEntitlements = {
      features: { wechat_bridge: true },
      entitlements: {
        wechat_bridge: {
          feature_key: "wechat_bridge",
          active: true,
          expires_at: 1_800_000_000,
          plan_id: 7,
          plan_title: "WeChat Pro",
        },
      },
    };
    vi.mocked(getNewapiEntitlements).mockImplementation(async () =>
      paymentConfirmed ? activeEntitlements : inactiveEntitlements,
    );
    vi.mocked(getWechatBridgeSubscriptionPlans).mockResolvedValue([
      { plan: { id: 7, title: "WeChat Pro", price_amount: 199 } },
    ]);
    vi.mocked(createWechatBridgeManualSubscriptionOrder).mockResolvedValue({
      trade_no: "SUBMAN7",
      money: 199,
      payment_method: "manual_wechat",
      payment_name: "WeChat",
      qr_url: "https://pay.example/qr.png",
      instructions: "Pay and wait for confirmation.",
      plan: { id: 7 },
    });
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    await clickEnabledButton("Subscribe WeChat advanced feature");
    expect(await screen.findByText("SUBMAN7")).toBeTruthy();

    paymentConfirmed = true;
    await clickEnabledButton("I have paid, refresh status");

    expect(await screen.findByText("Payment confirmed. WeChat advanced feature is active.")).toBeTruthy();
    expect(screen.getByText("WeChat advanced feature active")).toBeTruthy();
    expect(screen.queryByText("SUBMAN7")).toBeNull();
  });

  it("keeps the pending payment card when manual payment is not confirmed yet", async () => {
    vi.mocked(getNewapiEntitlements).mockResolvedValue({
      features: { wechat_bridge: false },
      entitlements: {},
    });
    vi.mocked(getWechatBridgeSubscriptionPlans).mockResolvedValue([
      { plan: { id: 7, title: "WeChat Pro", price_amount: 199 } },
    ]);
    vi.mocked(createWechatBridgeManualSubscriptionOrder).mockResolvedValue({
      trade_no: "SUBMAN7",
      money: 199,
      payment_method: "manual_wechat",
      payment_name: "WeChat",
      qr_url: "https://pay.example/qr.png",
      instructions: "Pay and wait for confirmation.",
      plan: { id: 7 },
    });
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    await clickEnabledButton("Subscribe WeChat advanced feature");
    expect(await screen.findByText("SUBMAN7")).toBeTruthy();

    await clickEnabledButton("I have paid, refresh status");

    expect(await screen.findByText("Payment is still waiting for manual confirmation.")).toBeTruthy();
    expect(screen.getByText("SUBMAN7")).toBeTruthy();
  });

  it("lets users start the connection in inactive mode so WeChat can receive the upgrade prompt", async () => {
    vi.mocked(getNewapiEntitlements).mockResolvedValue({
      features: { wechat_bridge: false },
      entitlements: {},
    });
    vi.mocked(getWechatBridgeSubscriptionPlans).mockResolvedValue([
      { plan: { id: 7, title: "WeChat Pro", price_amount: 199 } },
    ]);
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));
    vi.mocked(startWechatBridge).mockResolvedValue(
      status({ phase: "running", bridgeRunning: true, weclawRunning: true }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    const startButton = await screen.findByRole("button", { name: "Start WeChat" });
    await waitFor(() => {
      expect((startButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(startWechatBridge).toHaveBeenCalledWith({ workspaceId: "ws-a" });
    });
  });

  it("shows a retry state instead of no-plan copy when entitlement request fails", async () => {
    vi.mocked(getNewapiEntitlements).mockRejectedValue(
      new Error("请求权益接口失败: error sending request"),
    );
    vi.mocked(getWechatBridgeSubscriptionPlans).mockRejectedValue(
      new Error("请求权益接口失败: error sending request"),
    );
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("Could not connect to the model site. Refresh and try again.")).toBeTruthy();
    expect(screen.getByText("请求权益接口失败: error sending request")).toBeTruthy();
    expect(screen.queryByText("No available plan")).toBeNull();
    expect(screen.queryByRole("button", { name: "Subscribe WeChat advanced feature" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Refresh" }).length).toBeGreaterThan(0);
  });

    it("lets users configure the model-site key in place when new-api is not configured", async () => {
      vi.mocked(getNewapiEntitlementAccount).mockResolvedValue({
        baseUrl: "https://model.codingrui.work",
        hasToken: false,
        tokenPreview: null,
        source: "missing",
      });
      vi.mocked(getNewapiEntitlements).mockRejectedValue(new Error("未配置 new-api"));
      vi.mocked(getWechatBridgeSubscriptionPlans).mockRejectedValue(new Error("未配置 new-api"));
      vi.mocked(saveNewapiEntitlementAccount).mockResolvedValue({
        baseUrl: "https://model.codingrui.work",
        hasToken: true,
        tokenPreview: "sk-...abcd",
        source: "explicit",
      });
      vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));

      render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    await waitFor(() => {
      expect(getNewapiEntitlements).toHaveBeenCalled();
    });
      expect(
        await screen.findByText("Model site key is not configured. Configure it before creating an order."),
      ).toBeTruthy();
      const configureButton = screen.getByRole("button", { name: "Configure model-site key" });
      expect((configureButton as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(configureButton);
      fireEvent.change(screen.getByLabelText("API key"), {
        target: { value: "sk-newapi" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save and refresh" }));

      await waitFor(() => {
        expect(saveNewapiEntitlementAccount).toHaveBeenCalledWith({
          baseUrl: "https://model.codingrui.work",
          apiKey: "sk-newapi",
        });
      });
      expect(await screen.findByText("Model-site key saved.")).toBeTruthy();
      expect(createWechatBridgeManualSubscriptionOrder).not.toHaveBeenCalled();
    });

    it("shows an imported model-site key without switching providers", async () => {
      vi.mocked(getNewapiEntitlementAccount).mockResolvedValue({
        baseUrl: "https://model.codingrui.work",
        hasToken: true,
        tokenPreview: "sk-...1234",
        source: "provider",
      });
      vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));

      render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

      expect(await screen.findByText("Model-site account")).toBeTruthy();
      expect(
        await screen.findByText("Configured from Model Provider · sk-...1234"),
      ).toBeTruthy();
      expect(saveNewapiEntitlementAccount).not.toHaveBeenCalled();
    });

  it("shows scan QR text and copies it", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "waiting_scan",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        qrText: "████\n█  █\n████",
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("Waiting for scan")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(copyTextMock).toHaveBeenCalledWith("████\n█  █\n████");
    });
  });

  it("renders a scannable QR code when a login URL is available", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "waiting_scan",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        loginUrl: "https://wechat.example.test/login/abc",
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    const qrCode = await screen.findByTestId("wechat-login-qrcode");
    expect(qrCode.getAttribute("data-value")).toBe(
      "https://wechat.example.test/login/abc",
    );
  });

  it("shows the WeChat test message while waiting for scan and copies it", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "waiting_scan",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        qrText: "████",
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("Scan the QR code, then send the test message from WeChat.")).toBeTruthy();
    expect(screen.getByText("Final check")).toBeTruthy();
    expect(screen.getByText("连接测试：请只回复 OK。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy test message" }));

    await waitFor(() => {
      expect(copyTextMock).toHaveBeenCalledWith("连接测试：请只回复 OK。");
    });
  });

  it("keeps product boundaries out of the default pairing view", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByRole("button", { name: "Start WeChat" })).toBeTruthy();
    expect(
      screen.queryByText(
        "Text, voice, images, files, and quoted messages are forwarded to the desktop agent.",
      ),
    ).toBeNull();
    expect(
      screen.queryByText(
        "Use a test account first; WeChat account policy risk is not controlled by this app.",
      ),
    ).toBeNull();
  });

  it("shows the latest real WeChat activity without message text", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        lastActivity: {
          tsSecs: 1718000000,
          wxid: "local-wechat",
          workspace: "ws-a",
          decision: "allow",
        },
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat message received and replied.")).toBeTruthy();
    expect(screen.queryByText("连接测试：请只回复 OK。 secret")).toBeNull();
  });

  it("shows local self-check state without marking WeChat activity as replied", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        hasLocalSmokeActivity: true,
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(
      await screen.findByText("Local self-check passed. Waiting for a real WeChat message."),
    ).toBeTruthy();
    expect(screen.queryByText("WeChat message received and replied.")).toBeNull();
  });

  it("shows polling evidence when WeChat is online but no real message has arrived", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        weclawSyncFresh: true,
        weclawSyncAgeSecs: 12,
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("Running")).toBeTruthy();
    expect(
      screen.queryByText(
        "WeChat connector is online and polling. Waiting for a real WeChat message.",
      ),
    ).toBeNull();
    expect(screen.getByText("No WeChat message yet")).toBeTruthy();
  });

  it("shows the bound WeChat account and keeps debug details hidden by default", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        wechatBound: true,
        weclawSyncFresh: true,
        boundWechatUserId: "o9cq808fuofzCLps1bvs8I6-5hYA@im.wechat",
        lastActivity: {
          tsSecs: 1718000000,
          wxid: "wxid_real",
          workspace: "ws-a",
          decision: "allow",
        },
        lastMediaActivity: {
          ts: "2026/06/24 01:15:02",
          wxid: "wxid_real",
          kind: "image",
          status: "saved",
        },
        lastQuoteActivity: {
          ts: "2026/06/24 01:16:03",
          wxid: "wxid_real",
        },
      } as Partial<WeChatBridgeStatus>),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat connection")).toBeTruthy();
    await waitFor(() => {
      expect(getWechatBridgeStatus).toHaveBeenCalled();
    });
    expect(screen.queryAllByText("o9cq808fuofzCLps1bvs8I6-5hYA@im.wechat")).toHaveLength(1);
    expect(screen.getByText("Controls workspace")).toBeTruthy();
    expect(screen.getByText("Workspace A")).toBeTruthy();
    expect(screen.queryByText("Final check")).toBeNull();
    expect(screen.queryByText("Acceptance checklist")).toBeNull();
    expect(screen.queryByText("Local daemon")).toBeNull();
    expect(screen.queryByText("Use boundary")).toBeNull();
  });

  it("lets the user rebind WeChat when polling is healthy but real messages never arrive", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        wechatBound: true,
        weclawSyncFresh: true,
        weclawSyncAgeSecs: 8,
      }),
    );
    vi.mocked(resetWechatBridgeLogin).mockResolvedValue(
      status({
        phase: "waiting_scan",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        loginUrl: "https://wechat.example/rebind",
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    fireEvent.click(await screen.findByText("Rebind WeChat"));

    await waitFor(() => {
      expect(resetWechatBridgeLogin).toHaveBeenCalledWith({ workspaceId: "ws-a" });
    });
    expect(confirmSpy).toHaveBeenCalledWith(
      "Clear the current WeChat login and show a new QR code?",
    );
    expect(await screen.findByText("Waiting for scan")).toBeTruthy();
    confirmSpy.mockRestore();
  });

  it("keeps the current WeChat login when rebind confirmation is canceled", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        wechatBound: true,
        weclawSyncFresh: true,
        weclawSyncAgeSecs: 8,
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    fireEvent.click(await screen.findByText("Rebind WeChat"));

    expect(resetWechatBridgeLogin).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("sends a verification message to the bound WeChat account so the user knows which chat to reply in", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        wechatBound: true,
        weclawSyncFresh: true,
        weclawSyncAgeSecs: 8,
      }),
    );
    vi.mocked(sendWechatBridgeVerificationPrompt).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        wechatBound: true,
        weclawSyncFresh: true,
        weclawSyncAgeSecs: 4,
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    fireEvent.click(await screen.findByText("Send verification to WeChat"));

    await waitFor(() => {
      expect(sendWechatBridgeVerificationPrompt).toHaveBeenCalledWith({ workspaceId: "ws-a" });
    });
    expect(confirmSpy).toHaveBeenCalledWith(
      "Send a verification message to the WeChat account used for scan?",
    );
    expect(
      await screen.findByText("Verification message sent. Reply from WeChat in that chat."),
    ).toBeTruthy();
    confirmSpy.mockRestore();
  });

  it("shows bound-account guidance when WeChat is already logged in and no QR is shown", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        wechatBound: true,
        weclawSyncFresh: true,
        weclawSyncAgeSecs: 8,
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat connection")).toBeTruthy();
    expect(screen.queryAllByText("Bound account detected").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("wechat-login-qrcode")).toBeNull();
  });

  it("does not send a verification message when the user cancels", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        wechatBound: true,
        weclawSyncFresh: true,
        weclawSyncAgeSecs: 8,
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    fireEvent.click(await screen.findByText("Send verification to WeChat"));

    expect(sendWechatBridgeVerificationPrompt).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("keeps real WeChat media details out of the default pairing view", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        lastMediaActivity: {
          ts: "2026/06/24 01:15:02",
          wxid: "wxid_real",
          kind: "image",
          status: "saved",
          path: "/Users/demo/secret-client-image.jpg",
          bytes: 2048,
        },
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat connection")).toBeTruthy();
    expect(screen.queryByText("Recent media")).toBeNull();
    expect(screen.queryByText("/Users/demo/secret-client-image.jpg")).toBeNull();
  });

  it("keeps unsupported media diagnostics hidden until diagnostics are requested", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        lastMediaActivity: {
          ts: "2026/06/24 01:18:03",
          wxid: "wxid_real",
          kind: "image",
          status: "unsupported",
          detail: "items=[type=2 keys=mysteryImagePayload,type]",
        },
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat connection")).toBeTruthy();
    expect(screen.queryByText("Recent media")).toBeNull();
    expect(screen.queryByText("mysteryImagePayload")).toBeNull();
  });

  it("keeps quoted message status out of the default pairing view", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        lastQuoteActivity: {
          ts: "2026/06/24 01:16:03",
          wxid: "wxid_real",
        },
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat connection")).toBeTruthy();
    expect(screen.queryByText("Recent quote")).toBeNull();
    expect(screen.queryByText("quoted body")).toBeNull();
  });

  it("keeps unparsed quoted-message diagnostics hidden by default", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        lastQuoteActivity: {
          ts: "2026/06/24 01:16:03",
          wxid: "wxid_real",
          status: "unparsed",
          detail: "item[0].quotePayload keys=unknownText",
        },
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat connection")).toBeTruthy();
    expect(screen.queryByText("item[0].quotePayload keys=unknownText")).toBeNull();
    expect(screen.queryByText("quoted body")).toBeNull();
  });

  it("does not show the old quote acceptance checklist for unparsed quote diagnostics", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        lastActivity: {
          tsSecs: 1718000000,
          wxid: "wxid_real",
          workspace: "ws-a",
          decision: "allow",
        },
        lastMediaActivity: {
          ts: "2026/06/24 01:15:02",
          wxid: "wxid_real",
          kind: "image",
          status: "saved",
        },
        lastQuoteActivity: {
          ts: "2026/06/24 01:16:03",
          wxid: "wxid_real",
          status: "unparsed",
          detail: "item[0].quotePayload keys=unknownText",
        },
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat message received and replied.")).toBeTruthy();
    expect(screen.queryByText("Quote a previous WeChat message and ask a follow-up.")).toBeNull();
    expect(screen.queryByText("Quoted message reached the app as context.")).toBeNull();
  });

  it("shows recent-message state in the compact summary", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValueOnce(
      status({
        hasLocalSmokeActivity: true,
      }),
    );

    const first = render(
      <WeChatBridgeSettings t={t} activeWorkspace={workspace} />,
    );

    expect(
      await screen.findByText(
        "Local self-check passed. Waiting for a real WeChat message.",
      ),
    ).toBeTruthy();
    first.unmount();

    vi.mocked(getWechatBridgeStatus).mockResolvedValueOnce(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        lastActivity: {
          tsSecs: 1718000000,
          wxid: "wxid_real",
          workspace: "ws-a",
          decision: "allow",
        },
      }),
    );

    const second = render(
      <WeChatBridgeSettings t={t} activeWorkspace={workspace} />,
    );

    expect(await screen.findByText("WeChat message received and replied.")).toBeTruthy();
    second.unmount();

    vi.mocked(getWechatBridgeStatus).mockResolvedValueOnce(
      status({
        lastActivity: {
          tsSecs: 1718000001,
          wxid: "wxid_real",
          workspace: "ws-a",
          decision: "error",
        },
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(
      await screen.findByText("WeChat message reached the app, but the desktop reply failed."),
    ).toBeTruthy();
  });

  it("does not show the per-channel acceptance checklist by default", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat connection")).toBeTruthy();
    expect(screen.queryByText("Acceptance checklist")).toBeNull();
    expect(screen.queryByText("Text reply")).toBeNull();
    expect(screen.queryByText("Image or file input")).toBeNull();
    expect(screen.queryByText("Quoted message")).toBeNull();
  });

  it("shows completed text activity without exposing hidden media content", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({
        phase: "running",
        bridgeRunning: true,
        weclawRunning: true,
        daemonRunning: true,
        lastActivity: {
          tsSecs: 1718000000,
          wxid: "wxid_real",
          workspace: "ws-a",
          decision: "allow",
        },
        lastMediaActivity: {
          ts: "2026/06/24 01:15:02",
          wxid: "wxid_real",
          kind: "image",
          status: "saved",
          path: "/Users/demo/secret-client-image.jpg",
          bytes: 2048,
        },
        lastQuoteActivity: {
          ts: "2026/06/24 01:16:03",
          wxid: "wxid_real",
        },
      }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("WeChat message received and replied.")).toBeTruthy();
    expect(screen.queryByText("Image or file reached the app and was saved.")).toBeNull();
    expect(screen.queryByText("Quoted message reached the app as context.")).toBeNull();
    expect(screen.queryByText("/Users/demo/secret-client-image.jpg")).toBeNull();
  });

  it("keeps refreshing while running real WeChat acceptance is incomplete", async () => {
    vi.mocked(getWechatBridgeStatus)
      .mockResolvedValueOnce(
        status({
          phase: "running",
          bridgeRunning: true,
          weclawRunning: true,
          daemonRunning: true,
        }),
      )
      .mockResolvedValueOnce(
        status({
          phase: "running",
          bridgeRunning: true,
          weclawRunning: true,
          daemonRunning: true,
          lastActivity: {
            tsSecs: 1718000000,
            wxid: "wxid_real",
            workspace: "ws-a",
            decision: "allow",
          },
          lastMediaActivity: {
            ts: "2026/06/24 01:15:02",
            wxid: "wxid_real",
            kind: "image",
            status: "saved",
          },
          lastQuoteActivity: {
            ts: "2026/06/24 01:16:03",
            wxid: "wxid_real",
          },
        }),
      );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("No WeChat message yet")).toBeTruthy();

    await waitFor(
      () => {
        expect(getWechatBridgeStatus).toHaveBeenCalledTimes(2);
      },
      { timeout: 3500 },
    );
    expect(await screen.findByText("WeChat message received and replied.")).toBeTruthy();
  }, 5000);

  it("refreshes waiting scan status until the connection is running", async () => {
    vi.mocked(getWechatBridgeStatus)
      .mockResolvedValueOnce(
        status({
          phase: "waiting_scan",
          bridgeRunning: true,
          weclawRunning: true,
          daemonRunning: true,
          qrText: "████",
        }),
      )
      .mockResolvedValueOnce(
        status({
          phase: "running",
          bridgeRunning: true,
          weclawRunning: true,
          daemonRunning: true,
          qrText: null,
        }),
      );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    expect(await screen.findByText("Waiting for scan")).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByText("Waiting for scan")).toBeNull();
    });
    expect(getWechatBridgeStatus).toHaveBeenCalledTimes(2);
  }, 5000);

  it("starts with the active workspace id", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));
    vi.mocked(startWechatBridge).mockResolvedValue(
      status({ phase: "running", bridgeRunning: true, weclawRunning: true }),
    );

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    const startButton = await screen.findByRole("button", { name: "Start WeChat" });
    await waitFor(() => {
      expect((startButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(startWechatBridge).toHaveBeenCalledWith({ workspaceId: "ws-a" });
    });
  });

  it("enables keep-online and starts the connection", async () => {
    const onKeepOnlineChange = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(status({}));
    vi.mocked(startWechatBridge).mockResolvedValue(
      status({ phase: "running", bridgeRunning: true, weclawRunning: true }),
    );

    render(
      <WeChatBridgeSettings
        t={t}
        activeWorkspace={workspace}
        keepOnlineEnabled={false}
        onKeepOnlineChange={onKeepOnlineChange}
      />,
    );

    fireEvent.click(await screen.findByRole("checkbox", { name: "Keep WeChat online" }));

    await waitFor(() => {
      expect(onKeepOnlineChange).toHaveBeenCalledWith(true);
      expect(startWechatBridge).toHaveBeenCalledWith({ workspaceId: "ws-a" });
    });
  });

  it("disables keep-online without stopping the current connection", async () => {
    const onKeepOnlineChange = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({ phase: "running", bridgeRunning: true, weclawRunning: true }),
    );

    render(
      <WeChatBridgeSettings
        t={t}
        activeWorkspace={workspace}
        keepOnlineEnabled={true}
        onKeepOnlineChange={onKeepOnlineChange}
      />,
    );

    fireEvent.click(await screen.findByRole("checkbox", { name: "Keep WeChat online" }));

    await waitFor(() => {
      expect(onKeepOnlineChange).toHaveBeenCalledWith(false);
      expect(stopWechatBridge).not.toHaveBeenCalled();
    });
  });

  it("stops a running connection", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({ phase: "running", bridgeRunning: true, weclawRunning: true }),
    );
    vi.mocked(stopWechatBridge).mockResolvedValue(status({ phase: "stopped" }));

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    fireEvent.click(await screen.findByRole("button", { name: "Stop WeChat" }));

    await waitFor(() => {
      expect(stopWechatBridge).toHaveBeenCalled();
    });
  });

  it("runs diagnostics from the settings panel and renders actionable checks", async () => {
    vi.mocked(getWechatBridgeStatus).mockResolvedValue(
      status({ phase: "running", bridgeRunning: true, weclawRunning: true }),
    );
    vi.mocked(runWechatBridgeDiagnostics).mockResolvedValue({
      ok: false,
      status: status({ phase: "running", bridgeRunning: true, weclawRunning: true }),
      checks: [
        {
          key: "component",
          state: "pass",
          detail: "components available",
        },
        {
          key: "bridge",
          state: "fail",
          detail: "bridge chat probe failed",
        },
        {
          key: "weclawSync",
          state: "pass",
          detail: "sync age 12s",
        },
      ],
    });

    render(<WeChatBridgeSettings t={t} activeWorkspace={workspace} />);

    fireEvent.click(await screen.findByRole("button", { name: "Run diagnostics" }));

    await waitFor(() => {
      expect(runWechatBridgeDiagnostics).toHaveBeenCalled();
    });
    expect(await screen.findByText("Connection components")).toBeTruthy();
    expect(screen.getAllByText("Passed").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Message route")).toBeTruthy();
    expect(screen.getByText("Needs action")).toBeTruthy();
    expect(screen.getByText("bridge chat probe failed")).toBeTruthy();
    expect(screen.getByText("WeChat message polling")).toBeTruthy();
    expect(screen.getByText("sync age 12s")).toBeTruthy();
  });
});
