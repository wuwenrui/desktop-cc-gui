import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookOpen from "lucide-react/dist/esm/icons/book-open";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import Inbox from "lucide-react/dist/esm/icons/inbox";
import Mail from "lucide-react/dist/esm/icons/mail";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Send from "lucide-react/dist/esm/icons/send";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import X from "lucide-react/dist/esm/icons/x";
import type {
  AppSettings,
  EmailInboundSettings,
  EmailMailSessionList,
  EmailMailSessionRow,
  EmailSendError,
  EmailSenderSettings as EmailSenderSettingsModel,
  EmailSenderProvider,
} from "@/types";
import {
  checkEmailInbox,
  getEmailInboundSettings,
  getEmailSenderSettings,
  listEmailMailSessions,
  mutateEmailMailSession,
  sendTestEmail,
  updateEmailInboundSettings,
  updateEmailSenderSettings,
} from "@/services/tauri";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type EmailSenderSettingsProps = {
  t: (key: string) => string;
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onOpenMailSession?: (target: EmailMailSessionNavigationTarget) => void;
};

type ActionState = "load" | "save" | "clear" | "test" | null;
type EmailSettingsTab = "docs" | "send" | "inbound" | "sessions";

const EMAIL_DOCS_PREP_STEP_KEYS = [
  "settings.emailDocsPrepStepEmail",
  "settings.emailDocsPrepStepProtocol",
  "settings.emailDocsPrepStepPassword",
  "settings.emailDocsPrepStepRecipient",
] as const;

const EMAIL_DOCS_SEND_STEP_KEYS = [
  "settings.emailDocsSendStepProvider",
  "settings.emailDocsSendStepAddress",
  "settings.emailDocsSendStepServer",
  "settings.emailDocsSendStepSecret",
  "settings.emailDocsSendStepSave",
] as const;

const EMAIL_DOCS_INBOUND_STEP_KEYS = [
  "settings.emailDocsInboundStepServer",
  "settings.emailDocsInboundStepFolder",
  "settings.emailDocsInboundStepAllowlist",
  "settings.emailDocsInboundStepPolling",
  "settings.emailDocsInboundStepCheck",
] as const;

const EMAIL_DOCS_USAGE_STEP_KEYS = [
  "settings.emailDocsUsageStepEnableSend",
  "settings.emailDocsUsageStepEnableSession",
  "settings.emailDocsUsageStepReply",
  "settings.emailDocsUsageStepTrack",
] as const;

const EMAIL_DOCS_SAFETY_STEP_KEYS = [
  "settings.emailDocsSafetyStepNoInbox",
  "settings.emailDocsSafetyStepAction",
  "settings.emailDocsSafetyStepSignature",
  "settings.emailDocsSafetyStepReadOnly",
] as const;

export type EmailMailSessionNavigationTarget = {
  sessionId: string;
  workspaceId: string;
  threadId: string;
  turnId: string;
};

function defaultEmailSenderSettings(): EmailSenderSettingsModel {
  return {
    enabled: false,
    provider: "custom",
    senderEmail: "",
    senderName: "",
    smtpHost: "",
    smtpPort: 465,
    security: "ssl_tls",
    username: "",
    recipientEmail: "",
  };
}

function defaultEmailInboundSettings(): EmailInboundSettings {
  return {
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
  };
}

function areEmailSenderSettingsEqual(
  left: EmailSenderSettingsModel,
  right: EmailSenderSettingsModel,
): boolean {
  return (
    left.enabled === right.enabled &&
    left.provider === right.provider &&
    left.senderEmail === right.senderEmail &&
    left.senderName === right.senderName &&
    left.smtpHost === right.smtpHost &&
    left.smtpPort === right.smtpPort &&
    left.security === right.security &&
    left.username === right.username &&
    left.recipientEmail === right.recipientEmail
  );
}

function isEmailSendError(value: unknown): value is EmailSendError {
  return Boolean(
    value &&
      typeof value === "object" &&
      "code" in value &&
      "userMessage" in value,
  );
}

function humanizeEmailError(t: (key: string) => string, error: unknown): string {
  if (isEmailSendError(error)) {
    const key = `settings.emailError.${error.code}`;
    const translated = t(key);
    return translated === key ? error.userMessage : translated;
  }
  return error instanceof Error ? error.message : String(error);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function sessionTitle(session: EmailMailSessionRow): string {
  return session.threadName?.trim() || session.threadId || session.sessionId;
}

export function EmailSenderSettings({
  t,
  appSettings,
  onUpdateAppSettings,
  onOpenMailSession,
}: EmailSenderSettingsProps) {
  const [draft, setDraft] = useState<EmailSenderSettingsModel>(
    appSettings.emailSender ?? defaultEmailSenderSettings(),
  );
  const [savedSettings, setSavedSettings] = useState<EmailSenderSettingsModel>(
    appSettings.emailSender ?? defaultEmailSenderSettings(),
  );
  const [secretDraft, setSecretDraft] = useState("");
  const [savedSecret, setSavedSecret] = useState("");
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<EmailSettingsTab>("send");
  const [inboundDraft, setInboundDraft] = useState<EmailInboundSettings>(
    appSettings.emailInbound ?? defaultEmailInboundSettings(),
  );
  const [mailSessions, setMailSessions] = useState<EmailMailSessionList | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [action, setAction] = useState<ActionState>(null);
  const [inboundAction, setInboundAction] = useState<"save" | "check" | null>(null);
  const [refreshingMailSessions, setRefreshingMailSessions] = useState(false);
  const [cleaningMailSessions, setCleaningMailSessions] = useState(false);
  const [deletingMailSessionId, setDeletingMailSessionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const didRunInitialAppSettingsSyncRef = useRef(false);

  useEffect(() => {
    let active = true;
    setAction("load");
    getEmailSenderSettings()
      .then(async (view) => {
        if (!active) {
          return;
        }
        setDraft(view.settings);
        setSavedSettings(view.settings);
        setSecretConfigured(view.secretConfigured);
        setSecretDraft(view.secret ?? "");
        setSavedSecret(view.secret ?? "");
        setError(null);

        const [inboundView, sessionView] = await Promise.all([
          getEmailInboundSettings(),
          listEmailMailSessions(),
        ]);
        if (!active) {
          return;
        }
        setInboundDraft(inboundView.settings);
        setMailSessions(sessionView);
      })
      .catch((loadError) => {
        if (active) {
          setError(humanizeEmailError(t, loadError));
        }
      })
      .finally(() => {
        if (active) {
          setAction(null);
        }
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!didRunInitialAppSettingsSyncRef.current) {
      didRunInitialAppSettingsSyncRef.current = true;
      return;
    }
    const nextSettings = appSettings.emailSender ?? defaultEmailSenderSettings();
    setDraft(nextSettings);
    setSavedSettings(nextSettings);
    setInboundDraft(appSettings.emailInbound ?? defaultEmailInboundSettings());
  }, [appSettings.emailInbound, appSettings.emailSender]);

  const smtpFieldsDisabled = draft.provider !== "custom";
  const hasUnsavedChanges =
    !areEmailSenderSettingsEqual(draft, savedSettings) || secretDraft.trim() !== savedSecret;
  const canSave = useMemo(() => {
    if (action !== null) {
      return false;
    }
    if (draft.provider !== "custom") {
      return true;
    }
    return draft.smtpPort > 0 && draft.smtpPort <= 65535;
  }, [action, draft.provider, draft.smtpPort]);

  const updateDraft = useCallback((patch: Partial<EmailSenderSettingsModel>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setNotice(null);
    setError(null);
  }, []);

  const updateSecretDraft = useCallback((secret: string) => {
    setSecretDraft(secret);
    setNotice(null);
    setError(null);
  }, []);

  const testSendDisabledReason = useMemo(() => {
    if (!draft.enabled) {
      return t("settings.emailTestEnableFirst");
    }
    if (hasUnsavedChanges) {
      return t("settings.emailTestSaveFirst");
    }
    if (!draft.recipientEmail.trim()) {
      return t("settings.emailRecipientFirst");
    }
    if (!secretConfigured) {
      return t("settings.emailTestSecretFirst");
    }
    return null;
  }, [draft.enabled, draft.recipientEmail, hasUnsavedChanges, secretConfigured, t]);
  const canSendTest = action === null && !testSendDisabledReason;
  const selectedTimeline = useMemo(() => {
    if (!mailSessions || !selectedSessionId) {
      return [];
    }
    return mailSessions.timeline.filter((event) => event.sessionId === selectedSessionId);
  }, [mailSessions, selectedSessionId]);
  const selectedSession = useMemo(() => {
    if (!mailSessions || !selectedSessionId) {
      return null;
    }
    return mailSessions.sessions.find((session) => session.sessionId === selectedSessionId) ?? null;
  }, [mailSessions, selectedSessionId]);

  const refreshMailSessions = useCallback(async () => {
    const next = await listEmailMailSessions();
    setMailSessions(next);
    return next;
  }, []);

  const handleRefreshMailSessions = useCallback(async () => {
    setRefreshingMailSessions(true);
    setError(null);
    setNotice(null);
    try {
      await refreshMailSessions();
      setNotice(t("settings.emailMailSessionsRefreshed"));
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setRefreshingMailSessions(false);
    }
  }, [refreshMailSessions, t]);

  const handleSave = useCallback(async () => {
    setAction("save");
    setError(null);
    setNotice(null);
    try {
      const view = await updateEmailSenderSettings({
        settings: draft,
        secret: secretDraft.trim() || null,
      });
      setDraft(view.settings);
      setSavedSettings(view.settings);
      setSecretDraft(view.secret ?? "");
      setSavedSecret(view.secret ?? "");
      setSecretConfigured(view.secretConfigured);
      await onUpdateAppSettings({
        ...appSettings,
        emailSender: view.settings,
      });
      setNotice(t("settings.emailSaved"));
    } catch (saveError) {
      setError(humanizeEmailError(t, saveError));
    } finally {
      setAction(null);
    }
  }, [appSettings, draft, onUpdateAppSettings, secretDraft, t]);

  const handleEnableAndSave = useCallback(async () => {
    setAction("save");
    setError(null);
    setNotice(null);
    const enabledSettings = { ...draft, enabled: true };
    try {
      const view = await updateEmailSenderSettings({
        settings: enabledSettings,
        secret: secretDraft.trim() || null,
      });
      setDraft(view.settings);
      setSavedSettings(view.settings);
      setSecretDraft(view.secret ?? "");
      setSavedSecret(view.secret ?? "");
      setSecretConfigured(view.secretConfigured);
      await onUpdateAppSettings({
        ...appSettings,
        emailSender: view.settings,
      });
      setNotice(t("settings.emailEnabledSaved"));
    } catch (saveError) {
      setError(humanizeEmailError(t, saveError));
    } finally {
      setAction(null);
    }
  }, [appSettings, draft, onUpdateAppSettings, secretDraft, t]);

  const handleClearSecret = useCallback(async () => {
    setAction("clear");
    setError(null);
    setNotice(null);
    try {
      const view = await updateEmailSenderSettings({
        settings: draft,
        clearSecret: true,
      });
      const clearedSecret = view.secretConfigured ? (view.secret ?? "") : "";
      setDraft(view.settings);
      setSavedSettings(view.settings);
      setSecretDraft(clearedSecret);
      setSavedSecret(clearedSecret);
      setSecretConfigured(view.secretConfigured);
      await onUpdateAppSettings({
        ...appSettings,
        emailSender: view.settings,
      });
      setNotice(t("settings.emailSecretCleared"));
    } catch (clearError) {
      setError(humanizeEmailError(t, clearError));
    } finally {
      setAction(null);
    }
  }, [appSettings, draft, onUpdateAppSettings, t]);

  const handleTestSend = useCallback(async () => {
    setAction("test");
    setError(null);
    setNotice(null);
    try {
      await sendTestEmail({});
      setNotice(t("settings.emailTestSent"));
    } catch (testError) {
      setError(humanizeEmailError(t, testError));
    } finally {
      setAction(null);
    }
  }, [t]);

  const handleInboundSave = useCallback(async () => {
    setInboundAction("save");
    setError(null);
    setNotice(null);
    try {
      const view = await updateEmailInboundSettings({ settings: inboundDraft });
      setInboundDraft(view.settings);
      await onUpdateAppSettings({
        ...appSettings,
        emailInbound: view.settings,
      });
      await refreshMailSessions();
      setNotice(t("settings.emailInboundSaved"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setInboundAction(null);
    }
  }, [appSettings, inboundDraft, onUpdateAppSettings, refreshMailSessions, t]);

  const handleManualCheck = useCallback(async () => {
    setInboundAction("check");
    setError(null);
    setNotice(null);
    try {
      const result = await checkEmailInbox({});
      await refreshMailSessions();
      setNotice(t("settings.emailInboundCheckDone").replace("{{count}}", String(result.scannedCount)));
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : String(checkError));
    } finally {
      setInboundAction(null);
    }
  }, [refreshMailSessions, t]);

  const handleCleanupMailSessions = useCallback(async () => {
    setCleaningMailSessions(true);
    setError(null);
    setNotice(null);
    try {
      const next = await mutateEmailMailSession({ sessionId: "__all__", action: "cleanup" });
      setMailSessions(next);
      setNotice(t("settings.emailCleanupProcessedDone"));
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
    } finally {
      setCleaningMailSessions(false);
    }
  }, [t]);

  const handleDeleteMailRecords = useCallback(
    async (sessionId: string) => {
      setDeletingMailSessionId(sessionId);
      setError(null);
      setNotice(null);
      try {
        const next = await mutateEmailMailSession({ sessionId, action: "delete_mail_records" });
        setMailSessions(next);
        setSelectedSessionId((current) => (current === sessionId ? null : current));
        setNotice(t("settings.emailDeleteMailRecordsDone"));
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
      } finally {
        setDeletingMailSessionId(null);
      }
    },
    [t],
  );

  const handleOpenMailSession = useCallback(
    (session: EmailMailSessionRow) => {
      if (!onOpenMailSession) {
        setNotice(t("settings.emailOpenSessionUnavailable"));
        return;
      }
      onOpenMailSession({
        sessionId: session.sessionId,
        workspaceId: session.workspaceId,
        threadId: session.threadId,
        turnId: session.turnId,
      });
    },
    [onOpenMailSession, t],
  );

  const updateInboundDraft = useCallback((patch: Partial<EmailInboundSettings>) => {
    setInboundDraft((current) => ({ ...current, ...patch, readOnlyMode: true }));
    setNotice(null);
    setError(null);
  }, []);

  return (
    <div className="settings-email-section">
      <div className="settings-section-title">{t("settings.emailTitle")}</div>
      <div className="settings-section-subtitle">{t("settings.emailDescription")}</div>

      <div className="settings-basic-tabs" role="tablist" aria-label={t("settings.emailTitle")}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "docs"}
          className={`settings-basic-tab ${activeTab === "docs" ? "active" : ""}`}
          onClick={() => setActiveTab("docs")}
        >
          <BookOpen className="settings-basic-tab-icon" aria-hidden />
          {t("settings.emailDocsTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "send"}
          className={`settings-basic-tab ${activeTab === "send" ? "active" : ""}`}
          onClick={() => setActiveTab("send")}
        >
          <Send className="settings-basic-tab-icon" aria-hidden />
          {t("settings.emailSendConfigTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "inbound"}
          className={`settings-basic-tab ${activeTab === "inbound" ? "active" : ""}`}
          onClick={() => setActiveTab("inbound")}
        >
          <Inbox className="settings-basic-tab-icon" aria-hidden />
          {t("settings.emailInboundTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "sessions"}
          className={`settings-basic-tab ${activeTab === "sessions" ? "active" : ""}`}
          onClick={() => setActiveTab("sessions")}
        >
          <Mail className="settings-basic-tab-icon" aria-hidden />
          {t("settings.emailMailSessionsTab")}
        </button>
      </div>

      {activeTab === "docs" ? (
        <Card className="settings-basic-group-card settings-basic-shadcn-card settings-email-card">
          <CardHeader>
            <CardTitle className="settings-toggle-title">{t("settings.emailDocsTitle")}</CardTitle>
            <CardDescription>{t("settings.emailDocsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="settings-basic-sounds-card-content">
            <div className="settings-form-grid">
              <div className="settings-field">
                <div className="settings-toggle-title">{t("settings.emailDocsPurposeTitle")}</div>
                <div className="settings-help">{t("settings.emailDocsPurposeBody")}</div>
              </div>
              <div className="settings-field">
                <div className="settings-toggle-title">{t("settings.emailDocsPrepTitle")}</div>
                <ol className="settings-help">
                  {EMAIL_DOCS_PREP_STEP_KEYS.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ol>
              </div>
              <div className="settings-field">
                <div className="settings-toggle-title">{t("settings.emailDocsSendTitle")}</div>
                <ol className="settings-help">
                  {EMAIL_DOCS_SEND_STEP_KEYS.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ol>
              </div>
              <div className="settings-field">
                <div className="settings-toggle-title">{t("settings.emailDocsInboundTitle")}</div>
                <ol className="settings-help">
                  {EMAIL_DOCS_INBOUND_STEP_KEYS.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ol>
              </div>
              <div className="settings-field">
                <div className="settings-toggle-title">{t("settings.emailDocsAfterSetupTitle")}</div>
                <ol className="settings-help">
                  {EMAIL_DOCS_USAGE_STEP_KEYS.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ol>
              </div>
              <div className="settings-field">
                <div className="settings-toggle-title">{t("settings.emailDocsExamplesTitle")}</div>
                <pre className="settings-help settings-sound-hint settings-sound-hint-shadcn">
                  <code>{t("settings.emailDocsExampleNext")}</code>
                </pre>
                <pre className="settings-help settings-sound-hint settings-sound-hint-shadcn">
                  <code>{t("settings.emailDocsExampleChange")}</code>
                </pre>
                <pre className="settings-help settings-sound-hint settings-sound-hint-shadcn">
                  <code>{t("settings.emailDocsExampleStatus")}</code>
                </pre>
                <div className="settings-help">{t("settings.emailDocsExamplesBody")}</div>
              </div>
              <div className="settings-field">
                <div className="settings-toggle-title">{t("settings.emailDocsSafetyTitle")}</div>
                <ol className="settings-help">
                  {EMAIL_DOCS_SAFETY_STEP_KEYS.map((key) => (
                    <li key={key}>{t(key)}</li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="settings-help settings-sound-hint settings-sound-hint-shadcn">
              {t("settings.emailDocsSafetyHint")}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "send" ? (
      <Card className={`settings-basic-group-card settings-basic-shadcn-card settings-email-card${draft.enabled ? " is-enabled" : ""}`}>
        <CardHeader className="settings-card-switch-header">
          <div className="settings-card-switch-meta">
            <CardTitle className="settings-toggle-title">
              <span className="settings-proxy-card-title">
                <Mail size={16} aria-hidden />
                {t("settings.emailEnableTitle")}
              </span>
            </CardTitle>
            <CardDescription className="settings-toggle-subtitle">
              {t("settings.emailEnableDesc")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="settings-basic-sounds-card-content">
          <div className="settings-form-grid">
            <div className="settings-field">
              <Label htmlFor="email-enabled">{t("settings.emailEnableTitle")}</Label>
              <div className="settings-proxy-input-row">
                <Switch
                  id="email-enabled"
                  checked={draft.enabled}
                  onCheckedChange={(enabled) => updateDraft({ enabled })}
                  aria-label={t("settings.emailEnableTitle")}
                />
              </div>
            </div>
            <div className="settings-field">
              <Label htmlFor="email-provider">{t("settings.emailProvider")}</Label>
              <select
                id="email-provider"
                className="settings-select"
                value={draft.provider}
                onChange={(event) => updateDraft({ provider: event.target.value as EmailSenderProvider })}
              >
                <option value="126">126</option>
                <option value="163">163</option>
                <option value="qq">QQ</option>
                <option value="custom">{t("settings.emailProviderCustom")}</option>
              </select>
            </div>
            <div className="settings-field">
              <Label htmlFor="email-sender-address">{t("settings.emailSenderAddress")}</Label>
              <Input
                id="email-sender-address"
                value={draft.senderEmail}
                onChange={(event) => updateDraft({ senderEmail: event.target.value })}
                placeholder="name@example.com"
              />
            </div>
            <div className="settings-field">
              <Label htmlFor="email-sender-name">{t("settings.emailSenderName")}</Label>
              <Input
                id="email-sender-name"
                value={draft.senderName}
                onChange={(event) => updateDraft({ senderName: event.target.value })}
                placeholder="Moss"
              />
            </div>
            <div className="settings-field">
              <Label htmlFor="email-username">{t("settings.emailUsername")}</Label>
              <Input
                id="email-username"
                value={draft.username}
                onChange={(event) => updateDraft({ username: event.target.value })}
                placeholder="name@example.com"
              />
            </div>
            <div className="settings-field">
              <Label htmlFor="email-smtp-host">{t("settings.emailSmtpHost")}</Label>
              <Input
                id="email-smtp-host"
                value={draft.smtpHost}
                onChange={(event) => updateDraft({ smtpHost: event.target.value })}
                disabled={smtpFieldsDisabled}
              />
            </div>
            <div className="settings-field">
              <Label htmlFor="email-smtp-port">{t("settings.emailSmtpPort")}</Label>
              <Input
                id="email-smtp-port"
                value={String(draft.smtpPort)}
                onChange={(event) => updateDraft({ smtpPort: Number.parseInt(event.target.value, 10) || 0 })}
                disabled={smtpFieldsDisabled}
                inputMode="numeric"
              />
            </div>
            <div className="settings-field">
              <Label htmlFor="email-security">{t("settings.emailSecurity")}</Label>
              <select
                id="email-security"
                className="settings-select"
                value={draft.security}
                onChange={(event) => updateDraft({ security: event.target.value as EmailSenderSettingsModel["security"] })}
                disabled={smtpFieldsDisabled}
              >
                <option value="ssl_tls">SSL/TLS</option>
                <option value="start_tls">STARTTLS</option>
                <option value="none">{t("settings.emailSecurityNone")}</option>
              </select>
            </div>
            <div className="settings-field">
              <Label htmlFor="email-secret">{t("settings.emailSecret")}</Label>
              <div className="settings-secret-input-wrap">
                <Input
                  id="email-secret"
                  className="settings-secret-input"
                  type={secretVisible ? "text" : "password"}
                  value={secretDraft}
                  onChange={(event) => updateSecretDraft(event.target.value)}
                  placeholder={secretConfigured ? t("settings.emailSecretConfigured") : t("settings.emailSecretPlaceholder")}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="settings-secret-toggle"
                  onClick={() => setSecretVisible((current) => !current)}
                  aria-label={secretVisible ? t("settings.emailHideSecret") : t("settings.emailShowSecret")}
                  title={secretVisible ? t("settings.emailHideSecret") : t("settings.emailShowSecret")}
                >
                  {secretVisible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
            </div>
            <div className="settings-field">
              <Label htmlFor="email-recipient-inbox">{t("settings.emailTestRecipient")}</Label>
              <Input
                id="email-recipient-inbox"
                value={draft.recipientEmail}
                onChange={(event) => updateDraft({ recipientEmail: event.target.value })}
                placeholder="to@example.com"
                inputMode="email"
              />
            </div>
          </div>

          <div className="settings-help settings-sound-hint settings-sound-hint-shadcn">
            {secretConfigured ? t("settings.emailSecretConfigured") : t("settings.emailSecretMissing")}
          </div>

          <div className="settings-button-row">
            <Button type="button" onClick={() => void handleSave()} disabled={!canSave}>
              {action === "save" ? t("settings.emailSaving") : t("common.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleClearSecret()}
              disabled={action !== null || !secretConfigured}
            >
              <Trash2 size={14} aria-hidden />
              {t("settings.emailClearSecret")}
            </Button>
          </div>

          <div className="settings-divider" />

          <div className="settings-field">
            {!draft.enabled ? (
              <div className="settings-button-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleEnableAndSave()}
                  disabled={action !== null || !canSave}
                >
                  <Mail size={14} aria-hidden />
                  {action === "save" ? t("settings.emailSaving") : t("settings.emailEnableAndSave")}
                </Button>
              </div>
            ) : null}
            <div className="settings-button-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleTestSend()}
                disabled={!canSendTest}
                title={testSendDisabledReason ?? undefined}
              >
                <Send size={14} aria-hidden />
                {action === "test" ? t("settings.emailTesting") : t("settings.emailSendTest")}
              </Button>
            </div>
            <div className="settings-help settings-sound-hint settings-sound-hint-shadcn">
              {testSendDisabledReason ?? t("settings.emailTestReady")}
            </div>
          </div>

          {notice ? <div className="settings-inline-success" role="status">{notice}</div> : null}
          {error ? <div className="settings-inline-error" role="alert">{error}</div> : null}
        </CardContent>
      </Card>
      ) : null}

      {activeTab === "inbound" ? (
        <Card className="settings-basic-group-card settings-basic-shadcn-card settings-email-card">
          <CardHeader className="settings-card-switch-header">
            <div className="settings-card-switch-meta">
              <CardTitle className="settings-toggle-title">
                <span className="settings-proxy-card-title">
                  <Inbox size={16} aria-hidden />
                  {t("settings.emailInboundTitle")}
                </span>
              </CardTitle>
              <CardDescription className="settings-toggle-subtitle">
                {t("settings.emailInboundDesc")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="settings-basic-sounds-card-content">
            <div className="settings-form-grid">
              <div className="settings-field">
                <Label htmlFor="email-inbound-enabled">{t("settings.emailInboundEnabled")}</Label>
                <div className="settings-proxy-input-row">
                  <Switch
                    id="email-inbound-enabled"
                    checked={inboundDraft.enabled}
                    onCheckedChange={(enabled) => updateInboundDraft({ enabled })}
                    aria-label={t("settings.emailInboundEnabled")}
                  />
                </div>
              </div>
              <div className="settings-field">
                <Label htmlFor="email-inbound-provider">{t("settings.emailProvider")}</Label>
                <select
                  id="email-inbound-provider"
                  className="settings-select"
                  value={inboundDraft.provider}
                  onChange={(event) => updateInboundDraft({ provider: event.target.value as EmailSenderProvider })}
                >
                  <option value="126">126</option>
                  <option value="163">163</option>
                  <option value="qq">QQ</option>
                  <option value="custom">{t("settings.emailProviderCustom")}</option>
                </select>
              </div>
              <div className="settings-field">
                <Label htmlFor="email-imap-host">{t("settings.emailImapHost")}</Label>
                <Input
                  id="email-imap-host"
                  value={inboundDraft.imapHost}
                  onChange={(event) => updateInboundDraft({ imapHost: event.target.value })}
                  disabled={inboundDraft.provider !== "custom"}
                />
              </div>
              <div className="settings-field">
                <Label htmlFor="email-imap-port">{t("settings.emailImapPort")}</Label>
                <Input
                  id="email-imap-port"
                  value={String(inboundDraft.imapPort)}
                  onChange={(event) => updateInboundDraft({ imapPort: Number.parseInt(event.target.value, 10) || 0 })}
                  disabled={inboundDraft.provider !== "custom"}
                  inputMode="numeric"
                />
              </div>
              <div className="settings-field">
                <Label htmlFor="email-inbound-username">{t("settings.emailUsername")}</Label>
                <Input
                  id="email-inbound-username"
                  value={inboundDraft.username}
                  onChange={(event) => updateInboundDraft({ username: event.target.value })}
                  placeholder="name@example.com"
                />
              </div>
              <div className="settings-field">
                <Label htmlFor="email-mailbox-folder">{t("settings.emailMailboxFolder")}</Label>
                <Input
                  id="email-mailbox-folder"
                  value={inboundDraft.mailboxFolder}
                  onChange={(event) => updateInboundDraft({ mailboxFolder: event.target.value })}
                />
              </div>
              <div className="settings-field">
                <Label htmlFor="email-allowed-senders">{t("settings.emailAllowedSenders")}</Label>
                <Input
                  id="email-allowed-senders"
                  value={inboundDraft.allowedSenders.join(", ")}
                  onChange={(event) => updateInboundDraft({
                    allowedSenders: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                  })}
                  placeholder="you@example.com"
                />
              </div>
              <div className="settings-field">
                <Label htmlFor="email-poll-interval">{t("settings.emailPollInterval")}</Label>
                <Input
                  id="email-poll-interval"
                  value={String(inboundDraft.pollIntervalSeconds)}
                  onChange={(event) => updateInboundDraft({ pollIntervalSeconds: Number.parseInt(event.target.value, 10) || 300 })}
                  inputMode="numeric"
                  min={10}
                />
              </div>
            </div>
            <div className="settings-help settings-sound-hint settings-sound-hint-shadcn">
              {t("settings.emailReadOnlyHint")}
            </div>
            <div className="settings-button-row">
              <Button
                type="button"
                onClick={() => void handleInboundSave()}
                disabled={inboundAction !== null}
              >
                {inboundAction === "save" ? t("settings.emailSaving") : t("common.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleManualCheck()}
                disabled={inboundAction !== null || !inboundDraft.enabled}
              >
                <RefreshCw size={14} aria-hidden />
                {inboundAction === "check" ? t("settings.emailInboundChecking") : t("settings.emailInboundCheckNow")}
              </Button>
            </div>
            {mailSessions ? (
              <div className="settings-help settings-sound-hint settings-sound-hint-shadcn">
                {t("settings.emailInboundStatus")
                  .replace("{{state}}", mailSessions.listener.connectionState)
                  .replace("{{queued}}", String(mailSessions.listener.queuedCount))
                  .replace("{{confirm}}", String(mailSessions.listener.needsConfirmationCount))
                  .replace("{{rejected}}", String(mailSessions.listener.rejectedCount))}
              </div>
            ) : null}
            {notice ? <div className="settings-inline-success" role="status">{notice}</div> : null}
            {error ? <div className="settings-inline-error" role="alert">{error}</div> : null}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "sessions" ? (
        <Card className="settings-basic-group-card settings-basic-shadcn-card settings-email-card">
          <CardHeader>
            <CardTitle className="settings-toggle-title">{t("settings.emailMailSessionsTitle")}</CardTitle>
            <CardDescription>{t("settings.emailMailSessionsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="settings-basic-sounds-card-content">
            <div className="settings-button-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleRefreshMailSessions()}
                disabled={refreshingMailSessions}
              >
                <RefreshCw
                  size={14}
                  aria-hidden
                  className={refreshingMailSessions ? "is-spin" : undefined}
                />
                {refreshingMailSessions
                  ? t("settings.emailRefreshingSessions")
                  : t("settings.emailRefreshSessions")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCleanupMailSessions()}
                disabled={cleaningMailSessions}
              >
                <Trash2 size={14} aria-hidden />
                {cleaningMailSessions
                  ? t("settings.emailCleaningProcessed")
                  : t("settings.emailCleanupProcessed")}
              </Button>
            </div>
            {selectedSessionId ? (
              <div className="settings-mail-detail-panel" data-testid="mail-session-detail-panel">
                <div className="settings-mail-detail-header">
                  <div>
                    <div className="settings-section-title">{t("settings.emailTimelineTitle")}</div>
                    <div className="settings-help">
                      {selectedSession ? sessionTitle(selectedSession) : selectedSessionId}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedSessionId(null)}
                    aria-label={t("settings.emailCloseTimeline")}
                    title={t("settings.emailCloseTimeline")}
                  >
                    <X size={14} aria-hidden />
                  </Button>
                </div>
                <div className="settings-mail-detail-scroll">
                  {selectedTimeline.length === 0 ? (
                    <div className="settings-help">{t("settings.emailTimelineEmpty")}</div>
                  ) : (
                    selectedTimeline.map((event) => (
                      <div key={event.id} className="settings-mail-timeline-row">
                        <div className="settings-mail-session-main">
                          <strong>
                            {event.direction === "outbound"
                              ? t("settings.emailTimelineOutbound")
                              : t("settings.emailTimelineInbound")}
                          </strong>
                          <div className="settings-help">
                            {event.action ?? event.subject ?? event.status} · {event.status} ·{" "}
                            {formatDateTime(event.occurredAt)}
                          </div>
                          {event.detail ? <div className="settings-help">{event.detail}</div> : null}
                          {event.rejectReason ? (
                            <div className="settings-inline-error">{event.rejectReason}</div>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
            <div className="settings-session-table" role="table" aria-label={t("settings.emailMailSessionsTitle")}>
              {(mailSessions?.sessions ?? []).length === 0 ? (
                <div className="settings-help settings-sound-hint settings-sound-hint-shadcn">
                  {t("settings.emailNoMailSessions")}
                </div>
              ) : (
                (mailSessions?.sessions ?? []).map((session) => (
                  <div
                    key={session.sessionId}
                    className={`settings-mail-session-row ${
                      selectedSessionId === session.sessionId ? "is-selected" : ""
                    }`}
                    role="row"
                    aria-selected={selectedSessionId === session.sessionId}
                  >
                    <div className="settings-mail-session-main" role="cell">
                      <strong>{sessionTitle(session)}</strong>
                      <div className="settings-help">
                        {session.workspaceName ?? session.workspaceId} · {session.state} · {formatDateTime(session.lastEventAt)}
                      </div>
                      <div className="settings-help">
                        {t("settings.emailSessionCounts")
                          .replace("{{outbound}}", String(session.outboundCount))
                          .replace("{{inbound}}", String(session.inboundCount))
                          .replace("{{queued}}", String(session.queuedCount))
                          .replace("{{confirm}}", String(session.needsConfirmationCount))}
                      </div>
                    </div>
                    <div className="settings-mail-session-actions" role="cell">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSelectedSessionId(session.sessionId)}
                      >
                        <Mail size={14} aria-hidden />
                        {t("settings.emailViewTimeline")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="settings-mail-danger-action"
                        title={t("settings.emailDeleteMailRecordsHint")}
                        onClick={() => void handleDeleteMailRecords(session.sessionId)}
                        disabled={deletingMailSessionId !== null}
                      >
                        <Trash2 size={14} aria-hidden />
                        {deletingMailSessionId === session.sessionId
                          ? t("settings.emailDeletingMailRecords")
                          : t("settings.emailDeleteMailRecords")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        title={session.threadId || undefined}
                        onClick={() => handleOpenMailSession(session)}
                      >
                        <ExternalLink size={14} aria-hidden />
                        {t("settings.emailOpenSession")}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {notice ? <div className="settings-inline-success" role="status">{notice}</div> : null}
            {error ? <div className="settings-inline-error" role="alert">{error}</div> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
