type ThreadHoverPreviewCardProps = {
  engineLabel: string;
  isActive: boolean;
  isPinned: boolean;
  kindLabel: string;
  pinnedLabel: string;
  activeLabel: string;
  statusLabel: string | null;
  statusTitle: string;
  threadName: string;
  updatedLabel: string | null;
  engineTitle: string;
  workspaceLabel: string;
  workspacePath: string | null;
};

export function ThreadHoverPreviewCard({
  engineLabel,
  isActive,
  isPinned,
  kindLabel,
  pinnedLabel,
  activeLabel,
  statusLabel,
  statusTitle,
  threadName,
  updatedLabel,
  engineTitle,
  workspaceLabel,
  workspacePath,
}: ThreadHoverPreviewCardProps) {
  return (
    <div className="thread-hover-preview-card">
      <div className="thread-hover-preview-header">
        <span className="thread-hover-preview-kind">{kindLabel}</span>
        <div className="thread-hover-preview-badges" aria-hidden>
          {isActive ? <span>{activeLabel}</span> : null}
          {isPinned ? <span>{pinnedLabel}</span> : null}
        </div>
      </div>
      <div className="thread-hover-preview-title">{threadName}</div>
      <div className="thread-hover-preview-grid">
        {statusLabel ? (
          <>
            <span>{statusTitle}</span>
            <strong>{statusLabel}</strong>
          </>
        ) : null}
        <span>{engineTitle}</span>
        <strong>{engineLabel}</strong>
      </div>
      {updatedLabel ? (
        <div className="thread-hover-preview-updated">{updatedLabel}</div>
      ) : null}
      {workspacePath ? (
        <div className="thread-hover-preview-workspace">
          <span>{workspaceLabel}</span>
          <strong title={workspacePath}>{workspacePath}</strong>
        </div>
      ) : null}
    </div>
  );
}
