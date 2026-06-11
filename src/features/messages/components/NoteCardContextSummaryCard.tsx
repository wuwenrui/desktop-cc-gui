import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import { ImagePreviewOverlay } from "../../../components/common/ImagePreviewOverlay";
import { LocalImage } from "./LocalImage";
import { Markdown } from "./Markdown";
import { normalizeMessageImageSrc } from "./messagesRenderUtils";
import type { NoteCardContextSummary } from "./messagesNoteCardContext";

const COLLAPSED_NOTE_CARD_IMAGE_PREVIEW_COUNT = 1;
const COLLAPSED_NOTE_CARD_BODY_PREVIEW_MAX_CHARS = 96;

function buildNoteCardBodyPreview(bodyMarkdown: string) {
  const normalized = bodyMarkdown
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[>\-*\d.\s#]+/gm, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > COLLAPSED_NOTE_CARD_BODY_PREVIEW_MAX_CHARS
    ? `${normalized.slice(0, COLLAPSED_NOTE_CARD_BODY_PREVIEW_MAX_CHARS).trimEnd()}...`
    : normalized;
}

export const NoteCardContextSummaryCard = memo(function NoteCardContextSummaryCard({
  summary,
  workspaceId = null,
  codeBlockCopyUseModifier,
  onOpenFileLink,
  onOpenFileLinkMenu,
}: {
  summary: NoteCardContextSummary;
  workspaceId?: string | null;
  codeBlockCopyUseModifier?: boolean;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    localPath: string;
    alt: string;
  } | null>(null);
  const summarySignature = useMemo(
    () =>
      summary.notes
        .map((note) =>
          [
            note.title,
            note.archived ? "1" : "0",
            note.bodyMarkdown,
            note.attachments.map((attachment) => attachment.absolutePath).join("|"),
          ].join("::"),
        )
        .join("###"),
    [summary.notes],
  );

  useEffect(() => {
    setIsExpanded(false);
  }, [summarySignature]);

  return (
    <>
      <div className="note-card-context-summary-card">
        <div className="note-card-context-summary-head">
          <div className="note-card-context-summary-head-copy">
            <span className="note-card-context-summary-title">
              {t("messages.noteCardContextSummary")}
            </span>
            <span className="note-card-context-summary-count">
              {t("messages.noteCardContextSummaryCount", {
                count: summary.notes.length,
              })}
            </span>
          </div>
          <button
            type="button"
            className="note-card-context-summary-toggle"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? t("messages.noteCardContextCollapse")
                : t("messages.noteCardContextExpand")
            }
            title={
              isExpanded
                ? t("messages.noteCardContextCollapse")
                : t("messages.noteCardContextExpand")
            }
          >
            <span className="note-card-context-summary-toggle-label">
              {isExpanded
                ? t("messages.noteCardContextCollapse")
                : t("messages.noteCardContextExpand")}
            </span>
            <span className="note-card-context-summary-toggle-icon" aria-hidden>
              {isExpanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </span>
          </button>
        </div>
        <div className="note-card-context-summary-list">
          {summary.notes.map((note, index) => {
            const noteTitle = note.title.trim() || t("noteCards.untitled");
            const bodyPreview = buildNoteCardBodyPreview(note.bodyMarkdown);
            const visibleAttachments = isExpanded
              ? note.attachments
              : note.attachments.slice(0, COLLAPSED_NOTE_CARD_IMAGE_PREVIEW_COUNT);
            return (
              <article
                key={`${noteTitle}-${index}`}
                className={`note-card-context-summary-note${isExpanded ? " is-expanded" : " is-collapsed"}`}
              >
                <div className="note-card-context-summary-note-head">
                  <strong>{noteTitle}</strong>
                  <span className="note-card-context-summary-note-meta">
                    {note.archived ? (
                      <span className="note-card-context-summary-note-badge">
                        {t("composer.noteCardArchivedBadge")}
                      </span>
                    ) : null}
                    {note.attachments.length > 0 ? (
                      <span className="note-card-context-summary-note-badge">
                        {t("noteCards.imageCount", { count: note.attachments.length })}
                      </span>
                    ) : null}
                  </span>
                </div>
                {isExpanded ? (
                  note.bodyMarkdown ? (
                    <Markdown
                      value={note.bodyMarkdown}
                      className="markdown note-card-context-summary-markdown"
                      workspaceId={workspaceId}
                      codeBlockStyle="message"
                      codeBlockCopyUseModifier={codeBlockCopyUseModifier}
                      onOpenFileLink={onOpenFileLink}
                      onOpenFileLinkMenu={onOpenFileLinkMenu}
                    />
                  ) : null
                ) : bodyPreview ? (
                  <p className="note-card-context-summary-preview">{bodyPreview}</p>
                ) : null}
                {visibleAttachments.length > 0 ? (
                  <div className="note-card-context-summary-images" role="list">
                    {visibleAttachments.map((attachment, attachmentIndex) => {
                      const src =
                        normalizeMessageImageSrc(attachment.absolutePath)
                        || attachment.absolutePath;
                      const alt =
                        attachment.fileName || `${noteTitle} image ${attachmentIndex + 1}`;
                      return (
                        <button
                          key={`${noteTitle}-${attachment.absolutePath}-${attachmentIndex}`}
                          type="button"
                          className="note-card-context-summary-image"
                          role="listitem"
                          onClick={() =>
                            setImagePreview({
                              src,
                              localPath: attachment.absolutePath,
                              alt,
                            })
                          }
                          aria-label={alt}
                          title={alt}
                        >
                          <LocalImage
                            src={src}
                            localPath={attachment.absolutePath}
                            workspaceId={workspaceId}
                            alt={alt}
                            loading="lazy"
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
      {imagePreview ? (
        <ImagePreviewOverlay
          src={imagePreview.src}
          localPath={imagePreview.localPath}
          workspaceId={workspaceId}
          alt={imagePreview.alt}
          onClose={() => setImagePreview(null)}
        />
      ) : null}
    </>
  );
});
