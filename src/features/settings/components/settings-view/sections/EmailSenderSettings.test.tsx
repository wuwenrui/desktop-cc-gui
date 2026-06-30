// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, EmailMailSessionList, EmailSenderSettingsView } from "@/types";
import { EmailSenderSettings } from "./EmailSenderSettings";

const getEmailSenderSettingsMock = vi.fn();
const getEmailInboundSettingsMock = vi.fn();
const updateEmailInboundSettingsMock = vi.fn();
const checkEmailInboxMock = vi.fn();
const listEmailMailSessionsMock = vi.fn();
const mutateEmailMailSessionMock = vi.fn();
const updateEmailSenderSettingsMock = vi.fn();
const sendTestEmailMock = vi.fn();

vi.mock("@/services/tauri", () => ({
  checkEmailInbox: (...args: unknown[]) => checkEmailInboxMock(...args),
  getEmailInboundSettings: (...args: unknown[]) => getEmailInboundSettingsMock(...args),
  getEmailSenderSettings: (...args: unknown[]) => getEmailSenderSettingsMock(...args),
  listEmailMailSessions: (...args: unknown[]) => listEmailMailSessionsMock(...args),
  mutateEmailMailSession: (...args: unknown[]) => mutateEmailMailSessionMock(...args),
  updateEmailInboundSettings: (...args: unknown[]) => updateEmailInboundSettingsMock(...args),
  updateEmailSenderSettings: (...args: unknown[]) => updateEmailSenderSettingsMock(...args),
  sendTestEmail: (...args: unknown[]) => sendTestEmailMock(...args),
}));

const emailSender = {
  enabled: false,
  provider: "custom",
  senderEmail: "",
  senderName: "",
  smtpHost: "",
  smtpPort: 465,
  security: "ssl_tls",
  username: "",
  recipientEmail: "",
} as const;

const baseSettings = {
  emailSender,
  emailInbound: {
    enabled: false,
    provider: "custom",
    imapHost: "",
    imapPort: 993,
    security: "ssl_tls",
    username: "",
    mailboxFolder: "INBOX",
    allowedSenders: [],
    pollIntervalSeconds: 300,
    readOnlyMode: true,
    actionWindowHours: 24,
    debugStorageEnabled: false,
  },
} as unknown as AppSettings;

const enabledEmailSender = {
  ...emailSender,
  enabled: true,
  senderEmail: "sender@example.com",
  smtpHost: "smtp.example.com",
  username: "sender@example.com",
  recipientEmail: "to@example.com",
} as const;

function t(key: string): string {
  return key;
}

function emailView(overrides?: Partial<EmailSenderSettingsView>): EmailSenderSettingsView {
  return {
    settings: { ...emailSender },
    secretConfigured: false,
    secret: null,
    ...overrides,
  };
}

function mailSessionList(overrides?: Partial<EmailMailSessionList>): EmailMailSessionList {
  return {
    listener: {
      enabled: true,
      readOnly: true,
      connectionState: "ready",
      lastCheckedAt: null,
      nextCheckAt: null,
      acceptedCount: 0,
      queuedCount: 1,
      needsConfirmationCount: 1,
      rejectedCount: 0,
      ignoredCount: 0,
      pollingIntervalSeconds: 300,
    },
    sessions: [
      {
        sessionId: "ms_thread-1",
        workspaceId: "workspace-1",
        threadId: "thread-1",
        turnId: "turn-1",
        workspaceName: "Workspace",
        threadName: "Mail session",
        state: "enabled",
        lastEventAt: "2026-05-21T10:00:00Z",
        latestAction: "change",
        latestStatus: "needs_confirmation",
        latestRejectReason: "missing_action",
        outboundCount: 1,
        inboundCount: 1,
        queuedCount: 0,
        needsConfirmationCount: 1,
        latestSummary: "Done",
      },
    ],
    timeline: [
      {
        id: "evt-1",
        sessionId: "ms_thread-1",
        direction: "inbound",
        action: "change",
        status: "needs_confirmation",
        subject: null,
        detail: "Use backend only",
        rejectReason: "missing_action",
        occurredAt: "2026-05-21T10:00:00Z",
      },
    ],
    ...overrides,
  };
}

describe("EmailSenderSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEmailSenderSettingsMock.mockResolvedValue(emailView());
    getEmailInboundSettingsMock.mockResolvedValue({
      settings: baseSettings.emailInbound,
      readOnlyEffective: true,
    });
    listEmailMailSessionsMock.mockResolvedValue({
      listener: {
        enabled: false,
        readOnly: true,
        connectionState: "paused",
        lastCheckedAt: null,
        nextCheckAt: null,
        acceptedCount: 0,
        queuedCount: 0,
        needsConfirmationCount: 0,
        rejectedCount: 0,
        ignoredCount: 0,
        pollingIntervalSeconds: 300,
      },
      sessions: [],
      timeline: [],
    });
    updateEmailInboundSettingsMock.mockImplementation(async (request) => ({
      settings: request.settings,
      readOnlyEffective: true,
    }));
    checkEmailInboxMock.mockResolvedValue({
      checkedAt: "2026-05-21T10:00:00Z",
      readOnly: true,
      scannedCount: 0,
      acceptedCount: 0,
      queuedCount: 0,
      needsConfirmationCount: 0,
      rejectedCount: 0,
      ignoredCount: 0,
      duplicateCount: 0,
    });
    mutateEmailMailSessionMock.mockImplementation(async () => listEmailMailSessionsMock());
    updateEmailSenderSettingsMock.mockImplementation(async (request) => ({
      settings: request.settings,
      secretConfigured: Boolean(request.secret) && !request.clearSecret,
      secret: request.clearSecret ? null : request.secret ?? null,
    }));
    sendTestEmailMock.mockResolvedValue({
      provider: "custom",
      acceptedRecipients: ["to@example.com"],
      durationMs: 12,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the docs tab first with email module usage guidance", async () => {
    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const tabNames = (await screen.findAllByRole("tab")).map((tab) => tab.textContent);
    expect(tabNames).toEqual([
      "settings.emailDocsTab",
      "settings.emailSendConfigTab",
      "settings.emailInboundTab",
      "settings.emailMailSessionsTab",
    ]);

    fireEvent.click(screen.getByRole("tab", { name: "settings.emailDocsTab" }));

    expect(await screen.findByText("settings.emailDocsPurposeTitle")).toBeTruthy();
    expect(screen.getByText("settings.emailDocsPrepTitle")).toBeTruthy();
    expect(await screen.findByText("settings.emailDocsSendTitle")).toBeTruthy();
    expect(screen.getByText("settings.emailDocsInboundTitle")).toBeTruthy();
    expect(screen.getByText("settings.emailDocsAfterSetupTitle")).toBeTruthy();
    expect(screen.getByText("settings.emailDocsExamplesTitle")).toBeTruthy();
    expect(screen.getByText("settings.emailDocsExampleChange")).toBeTruthy();
    expect(screen.getByText("settings.emailDocsSafetyTitle")).toBeTruthy();
    expect(screen.getByText("settings.emailDocsSafetyHint")).toBeTruthy();
  });

  it("saves provider selection and refreshes backend preset defaults", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);
    updateEmailSenderSettingsMock.mockImplementationOnce(async (request) => ({
      settings: {
        ...request.settings,
        smtpHost: "smtp.126.com",
        smtpPort: 465,
        security: "ssl_tls",
      },
      secretConfigured: false,
      secret: null,
    }));

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={onUpdateAppSettings}
      />,
    );

    const provider = await screen.findByLabelText("settings.emailProvider");
    fireEvent.change(provider, { target: { value: "126" } });
    expect((screen.getByLabelText("settings.emailSmtpHost") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("settings.emailSenderAddress"), {
      target: { value: "sender@example.com" },
    });
    fireEvent.change(screen.getByLabelText("settings.emailUsername"), {
      target: { value: "sender@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(updateEmailSenderSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({
            provider: "126",
            smtpHost: "",
            smtpPort: 465,
            security: "ssl_tls",
          }),
        }),
      );
    });
    await waitFor(() => {
      expect((screen.getByLabelText("settings.emailSmtpHost") as HTMLInputElement).value).toBe(
        "smtp.126.com",
      );
    });
    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        emailSender: expect.objectContaining({
          provider: "126",
          smtpHost: "smtp.126.com",
        }),
      }),
    );
  });

  it("loads a saved secret into the settings input", async () => {
    getEmailSenderSettingsMock.mockResolvedValue(
      emailView({ secretConfigured: true, secret: "stored-secret" }),
    );

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const secretInput = await screen.findByLabelText("settings.emailSecret");
    await waitFor(() => {
      expect((secretInput as HTMLInputElement).value).toBe("stored-secret");
    });
    expect((secretInput as HTMLInputElement).type).toBe("password");
  });

  it("toggles secret masking from the UI only", async () => {
    getEmailSenderSettingsMock.mockResolvedValue(
      emailView({ secretConfigured: true, secret: "stored-secret" }),
    );

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const secretInput = await screen.findByLabelText("settings.emailSecret");
    expect((secretInput as HTMLInputElement).type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "settings.emailShowSecret" }));
    expect((secretInput as HTMLInputElement).type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "settings.emailHideSecret" }));
    expect((secretInput as HTMLInputElement).type).toBe("password");
  });

  it("keeps backend-loaded enabled state instead of resetting to initial app settings", async () => {
    getEmailSenderSettingsMock.mockResolvedValue(
      emailView({
        settings: { ...enabledEmailSender },
        secretConfigured: true,
        secret: "stored-secret",
      }),
    );

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const enableSwitch = await screen.findByRole("switch", {
      name: "settings.emailEnableTitle",
    });
    await waitFor(() => {
      expect(enableSwitch.getAttribute("aria-checked")).toBe("true");
    });
    expect(await screen.findByText("settings.emailTestReady")).toBeTruthy();
  });

  it("saves the recipient inbox as part of email settings", async () => {
    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.change(await screen.findByLabelText("settings.emailTestRecipient"), {
      target: { value: "to@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(updateEmailSenderSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ recipientEmail: "to@example.com" }),
        }),
      );
    });
  });

  it("shows the recipient inbox field and blocks test send until email is enabled", async () => {
    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await screen.findByLabelText("settings.emailTestRecipient");
    expect(await screen.findByText("settings.emailTestEnableFirst")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("settings.emailTestRecipient"), {
      target: { value: "to@example.com" },
    });
    const sendButton = screen.getByRole("button", { name: "settings.emailSendTest" });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(sendButton);

    expect(sendTestEmailMock).not.toHaveBeenCalled();
  });

  it("offers an inline enable-and-save action for test sending", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={onUpdateAppSettings}
      />,
    );

    const enableAndSaveButton = await screen.findByRole("button", {
      name: "settings.emailEnableAndSave",
    });
    await waitFor(() => {
      expect((enableAndSaveButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(enableAndSaveButton);

    await waitFor(() => {
      expect(updateEmailSenderSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: expect.objectContaining({ enabled: true }),
        }),
      );
    });
    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        emailSender: expect.objectContaining({ enabled: true }),
      }),
    );
    await screen.findByText("settings.emailEnabledSaved");
  });

  it("saves a new secret while keeping the input masked", async () => {
    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const secretInput = await screen.findByLabelText("settings.emailSecret");
    fireEvent.change(secretInput, { target: { value: "super-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(updateEmailSenderSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({ secret: "super-secret" }),
      );
    });
    await waitFor(() => {
      expect((secretInput as HTMLInputElement).value).toBe("super-secret");
    });
    expect((secretInput as HTMLInputElement).type).toBe("password");
  });

  it("clears a configured secret", async () => {
    getEmailSenderSettingsMock.mockResolvedValue(
      emailView({ secretConfigured: true, secret: "stored-secret" }),
    );
    updateEmailSenderSettingsMock.mockResolvedValue({
      settings: emailSender,
      secretConfigured: false,
      secret: null,
    });

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const clearButton = await screen.findByRole("button", {
      name: "settings.emailClearSecret",
    });
    await waitFor(() => {
      expect((clearButton as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(updateEmailSenderSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({ clearSecret: true }),
      );
    });
    await waitFor(() => {
      expect((screen.getByLabelText("settings.emailSecret") as HTMLInputElement).value).toBe("");
    });
  });

  it("shows structured test-send errors", async () => {
    getEmailSenderSettingsMock.mockResolvedValue(
      emailView({
        settings: { ...enabledEmailSender },
        secretConfigured: true,
        secret: "stored-secret",
      }),
    );
    sendTestEmailMock.mockRejectedValue({
      code: "invalid_recipient",
      retryable: false,
      userMessage: "bad recipient",
    });

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await screen.findByText("settings.emailTestReady");
    fireEvent.click(screen.getByRole("button", { name: "settings.emailSendTest" }));

    await waitFor(() => {
      expect(sendTestEmailMock).toHaveBeenCalledWith({});
    });
    await screen.findByText("bad recipient");
  });

  it("shows inbound listener and mail session tabs without rendering unrelated inbox mail", async () => {
    const onOpenMailSession = vi.fn();
    listEmailMailSessionsMock.mockResolvedValue(mailSessionList());

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        onOpenMailSession={onOpenMailSession}
      />,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "settings.emailInboundTab" }));
    await screen.findByText("settings.emailReadOnlyHint");
    expect(screen.queryByText("ordinary inbox subject")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "settings.emailMailSessionsTab" }));
    await screen.findByText("Mail session");
    fireEvent.click(screen.getByRole("button", { name: "settings.emailOpenSession" }));
    expect(onOpenMailSession).toHaveBeenCalledWith({
      sessionId: "ms_thread-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      turnId: "turn-1",
    });
    fireEvent.click(screen.getByRole("button", { name: "settings.emailViewTimeline" }));
    await screen.findByText("Use backend only");
  });

  it("refreshes and cleans mail sessions with visible feedback", async () => {
    listEmailMailSessionsMock.mockResolvedValue(mailSessionList());
    mutateEmailMailSessionMock.mockResolvedValue(mailSessionList({ sessions: [], timeline: [] }));

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "settings.emailMailSessionsTab" }));
    await screen.findByText("Mail session");

    listEmailMailSessionsMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "settings.emailRefreshSessions" }));
    await waitFor(() => {
      expect(listEmailMailSessionsMock).toHaveBeenCalledTimes(1);
    });
    await screen.findByText("settings.emailMailSessionsRefreshed");

    fireEvent.click(screen.getByRole("button", { name: "settings.emailCleanupProcessed" }));
    await waitFor(() => {
      expect(mutateEmailMailSessionMock).toHaveBeenCalledWith({
        sessionId: "__all__",
        action: "cleanup",
      });
    });
    await screen.findByText("settings.emailCleanupProcessedDone");
  });

  it("shows mail details above the list with selected row state and close action", async () => {
    listEmailMailSessionsMock.mockResolvedValue(mailSessionList());

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "settings.emailMailSessionsTab" }));
    await screen.findByText("Mail session");
    fireEvent.click(screen.getByRole("button", { name: "settings.emailViewTimeline" }));

    const detailPanel = await screen.findByTestId("mail-session-detail-panel");
    const table = screen.getByRole("table", { name: "settings.emailMailSessionsTitle" });
    expect(Boolean(detailPanel.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(detailPanel.querySelector(".settings-mail-detail-scroll")).toBeTruthy();
    expect(screen.getByText("Use backend only")).toBeTruthy();

    const selectedRow = screen
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("Mail session"));
    expect(selectedRow?.classList.contains("is-selected")).toBe(true);
    expect(selectedRow?.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "settings.emailCloseTimeline" }));
    expect(screen.queryByTestId("mail-session-detail-panel")).toBeNull();
  });

  it("deletes only mail records through the typed mutation and closes stale detail", async () => {
    listEmailMailSessionsMock.mockResolvedValue(mailSessionList());
    mutateEmailMailSessionMock.mockResolvedValue(mailSessionList({ sessions: [], timeline: [] }));

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "settings.emailMailSessionsTab" }));
    await screen.findByText("Mail session");
    fireEvent.click(screen.getByRole("button", { name: "settings.emailViewTimeline" }));
    await screen.findByText("Use backend only");

    fireEvent.click(screen.getByRole("button", { name: "settings.emailDeleteMailRecords" }));
    await waitFor(() => {
      expect(mutateEmailMailSessionMock).toHaveBeenCalledWith({
        sessionId: "ms_thread-1",
        action: "delete_mail_records",
      });
    });
    await screen.findByText("settings.emailDeleteMailRecordsDone");
    expect(screen.queryByTestId("mail-session-detail-panel")).toBeNull();
  });

  it("keeps the current mail list visible when deleting mail records fails", async () => {
    listEmailMailSessionsMock.mockResolvedValue(mailSessionList());
    mutateEmailMailSessionMock.mockRejectedValue(new Error("delete failed"));

    render(
      <EmailSenderSettings
        t={t}
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "settings.emailMailSessionsTab" }));
    await screen.findByText("Mail session");
    fireEvent.click(screen.getByRole("button", { name: "settings.emailDeleteMailRecords" }));

    await screen.findByText("delete failed");
    expect(screen.getByText("Mail session")).toBeTruthy();
  });
});
