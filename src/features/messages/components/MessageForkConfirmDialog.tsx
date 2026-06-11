import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import {
  CODEX_DISK_PROVIDER_PROFILE_ID,
  CODEX_DISK_PROVIDER_PROFILE_NAME,
  type CodexProviderProfileSelection,
  type CodexProviderProfileOption,
} from "../../threads/constants/codexProviderProfiles";

type MessageForkConfirmDialogProps = {
  userMessageId: string | null;
  onCancel: () => void;
  onConfirm: (
    userMessageId: string,
    options?: CodexProviderProfileSelection,
  ) => void | Promise<void>;
  providerProfiles?: CodexProviderProfileOption[];
  defaultProviderProfileId?: string | null;
  showProviderSelector?: boolean;
};

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function MessageForkConfirmDialog({
  userMessageId,
  onCancel,
  onConfirm,
  providerProfiles = [],
  defaultProviderProfileId = null,
  showProviderSelector = false,
}: MessageForkConfirmDialogProps) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedProviderProfileId, setSelectedProviderProfileId] =
    useState<string | null>(null);
  const isOpen = Boolean(userMessageId);
  const selectableProviderProfiles = useMemo(
    () => [
      {
        id: CODEX_DISK_PROVIDER_PROFILE_ID,
        name: CODEX_DISK_PROVIDER_PROFILE_NAME,
        source: "disk" as const,
      },
      ...providerProfiles.filter(
        (profile) => profile.id !== CODEX_DISK_PROVIDER_PROFILE_ID,
      ),
    ],
    [providerProfiles],
  );
  const normalizedDefaultProviderProfileId =
    defaultProviderProfileId?.trim() || CODEX_DISK_PROVIDER_PROFILE_ID;
  const defaultSelectableProviderProfileId = selectableProviderProfiles.some(
    (profile) => profile.id === normalizedDefaultProviderProfileId,
  )
    ? normalizedDefaultProviderProfileId
    : CODEX_DISK_PROVIDER_PROFILE_ID;
  const candidateProviderProfileId =
    selectedProviderProfileId ?? defaultSelectableProviderProfileId;
  const resolvedProviderProfileId = selectableProviderProfiles.some(
    (profile) => profile.id === candidateProviderProfileId,
  )
    ? candidateProviderProfileId
    : defaultSelectableProviderProfileId;
  const resolvedProviderProfile =
    selectableProviderProfiles.find((profile) => profile.id === resolvedProviderProfileId)
    ?? null;

  useEffect(() => {
    if (isOpen) {
      setSelectedProviderProfileId(null);
      setErrorMessage(null);
    }
  }, [isOpen, userMessageId, defaultSelectableProviderProfileId]);

  const handleCancel = () => {
    if (isConfirming) {
      return;
    }
    setErrorMessage(null);
    setSelectedProviderProfileId(null);
    onCancel();
  };

  const handleConfirm = async () => {
    if (!userMessageId || isConfirming) {
      return;
    }
    setIsConfirming(true);
    setErrorMessage(null);
    try {
      await onConfirm(
        userMessageId,
        showProviderSelector
          ? {
            providerProfileId: resolvedProviderProfileId,
            ...(resolvedProviderProfile
              ? { providerProfile: resolvedProviderProfile }
              : {}),
          }
          : undefined,
      );
      onCancel();
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        }
      }}
    >
      <AlertDialogPopup
        className="message-fork-confirm-dialog"
        bottomStickOnMobile={false}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("messages.forkConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("messages.forkConfirmDescription")}
          </AlertDialogDescription>
          <div className="message-fork-confirm-body">
            <p>{t("messages.forkConfirmPurpose")}</p>
            <p>{t("messages.forkConfirmUsage")}</p>
            {showProviderSelector ? (
              <label className="message-fork-provider-field">
                <span className="message-fork-provider-label">
                  {t("messages.forkProviderLabel")}
                </span>
                <select
                  className="message-fork-provider-select"
                  value={resolvedProviderProfileId}
                  onChange={(event) => {
                    setSelectedProviderProfileId(event.currentTarget.value);
                  }}
                  disabled={isConfirming}
                >
                  {selectableProviderProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {errorMessage ? (
            <p className="message-fork-confirm-error" role="alert">
              {t("messages.forkConfirmFailed", { reason: errorMessage })}
            </p>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <button
            type="button"
            className="ghost message-fork-confirm-button"
            onClick={handleCancel}
            disabled={isConfirming}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="primary message-fork-confirm-button"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={isConfirming}
          >
            {isConfirming
              ? t("messages.forkConfirmBusy")
              : t("messages.forkConfirmAction")}
          </button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
