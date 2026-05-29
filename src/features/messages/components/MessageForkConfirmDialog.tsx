import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";

type MessageForkConfirmDialogProps = {
  userMessageId: string | null;
  onCancel: () => void;
  onConfirm: (userMessageId: string) => void | Promise<void>;
};

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function MessageForkConfirmDialog({
  userMessageId,
  onCancel,
  onConfirm,
}: MessageForkConfirmDialogProps) {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isOpen = Boolean(userMessageId);

  const handleCancel = () => {
    if (isConfirming) {
      return;
    }
    setErrorMessage(null);
    onCancel();
  };

  const handleConfirm = async () => {
    if (!userMessageId || isConfirming) {
      return;
    }
    setIsConfirming(true);
    setErrorMessage(null);
    try {
      await onConfirm(userMessageId);
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
