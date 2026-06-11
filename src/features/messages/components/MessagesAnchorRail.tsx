type MessageAnchor = {
  id: string;
  role: string;
  position: number;
};

type MessagesAnchorRailProps = {
  activeAnchorId: string | null;
  anchors: MessageAnchor[];
  anchorNavigationLabel: string;
  getJumpLabel: (index: number) => string;
  getTitle: (index: number) => string;
  onScrollToAnchor: (messageId: string) => void;
};

export function MessagesAnchorRail({
  activeAnchorId,
  anchors,
  anchorNavigationLabel,
  getJumpLabel,
  getTitle,
  onScrollToAnchor,
}: MessagesAnchorRailProps) {
  if (anchors.length <= 1) {
    return null;
  }
  return (
    <div
      className="messages-anchor-rail"
      role="navigation"
      aria-label={anchorNavigationLabel}
    >
      <div className="messages-anchor-track" aria-hidden />
      {anchors.map((anchor, index) => {
        const isActive = activeAnchorId === anchor.id;
        return (
          <div
            key={anchor.id}
            role="button"
            tabIndex={0}
            className={`messages-anchor-dot${isActive ? " is-active" : ""}`}
            style={{ top: `${anchor.position * 100}%` }}
            onClick={() => onScrollToAnchor(anchor.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onScrollToAnchor(anchor.id);
              }
            }}
            aria-label={getJumpLabel(index)}
            title={getTitle(index)}
          />
        );
      })}
    </div>
  );
}
