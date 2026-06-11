import type { RefObject } from "react";
import type { TFunction } from "i18next";

export type RenamePromptState = {
  path: string;
  kind: "file" | "folder";
  currentName: string;
};

export function FileTreeRenamePrompt({
  prompt,
  draftName,
  inputRef,
  t,
  onDraftNameChange,
  onCancel,
  onConfirm,
}: {
  prompt: RenamePromptState;
  draftName: string;
  inputRef: RefObject<HTMLInputElement | null>;
  t: TFunction;
  onDraftNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="new-file-prompt" role="dialog" aria-modal="true">
      <div className="new-file-prompt-backdrop" onClick={onCancel} />
      <div className="new-file-prompt-card">
        <div className="new-file-prompt-title">{t("files.renameItem")}</div>
        <div className="new-file-prompt-path">{prompt.currentName}</div>
        <input
          id="rename-file-tree-item"
          ref={inputRef}
          className="new-file-prompt-input"
          value={draftName}
          onChange={(event) => onDraftNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onConfirm();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          placeholder={t("files.renameNamePlaceholder")}
          aria-label={t("files.renameNamePlaceholder")}
        />
        <div className="new-file-prompt-actions">
          <button type="button" onClick={onCancel}>
            {t("files.cancel")}
          </button>
          <button type="button" onClick={onConfirm}>
            {t("files.renameItem")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FileTreeNewFilePrompt({
  parent,
  name,
  inputRef,
  t,
  onNameChange,
  onCancel,
  onConfirm,
}: {
  parent: string;
  name: string;
  inputRef: RefObject<HTMLInputElement | null>;
  t: TFunction;
  onNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="new-file-prompt" role="dialog" aria-modal="true">
      <div className="new-file-prompt-backdrop" onClick={onCancel} />
      <div className="new-file-prompt-card">
        <div className="new-file-prompt-title">{t("files.newFile")}</div>
        {parent && (
          <div className="new-file-prompt-path">{parent}/</div>
        )}
        <input
          id="new-file-name"
          ref={inputRef}
          className="new-file-prompt-input"
          placeholder={t("files.newFileNamePlaceholder")}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
            if (event.key === "Enter" && name.trim()) {
              event.preventDefault();
              onConfirm();
            }
          }}
        />
        <div className="new-file-prompt-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            {t("files.cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!name.trim()}
            onClick={onConfirm}
          >
            {t("files.newFile")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FileTreeNewFolderPrompt({
  parent,
  name,
  inputRef,
  t,
  onNameChange,
  onCancel,
  onConfirm,
}: {
  parent: string;
  name: string;
  inputRef: RefObject<HTMLInputElement | null>;
  t: TFunction;
  onNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="new-file-prompt" role="dialog" aria-modal="true">
      <div className="new-file-prompt-backdrop" onClick={onCancel} />
      <div className="new-file-prompt-card">
        <div className="new-file-prompt-title">{t("files.newFolder")}</div>
        {parent && (
          <div className="new-file-prompt-path">{parent}/</div>
        )}
        <input
          id="new-folder-name"
          ref={inputRef}
          className="new-file-prompt-input"
          placeholder={t("files.newFolderNamePlaceholder")}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
            if (event.key === "Enter" && name.trim()) {
              event.preventDefault();
              onConfirm();
            }
          }}
        />
        <div className="new-file-prompt-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            {t("files.cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!name.trim()}
            onClick={onConfirm}
          >
            {t("files.newFolder")}
          </button>
        </div>
      </div>
    </div>
  );
}
