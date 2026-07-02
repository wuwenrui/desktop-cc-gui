import { useCollapsibleFloater } from "../hooks/useCollapsibleFloater";

type MessageAnchor = {
  id: string;
  role: string;
  title?: string;
};

type MessagesAnchorRailProps = {
  activeAnchorId: string | null;
  anchors: MessageAnchor[];
  anchorNavigationLabel: string;
  getFallbackTitle: (index: number) => string;
  onScrollToAnchor: (messageId: string) => void;
};

export function MessagesAnchorRail({
  activeAnchorId,
  anchors,
  anchorNavigationLabel,
  getFallbackTitle,
  onScrollToAnchor,
}: MessagesAnchorRailProps) {
  const { state, expand, scheduleCollapse } = useCollapsibleFloater();

  if (anchors.length <= 1) {
    return null;
  }

  const isExpanded = state !== "collapsed";

  const handleJump = (messageId: string) => {
    onScrollToAnchor(messageId);
    scheduleCollapse();
  };

  return (
    <div
      className="messages-anchor-rail"
      data-state={state}
      role="navigation"
      aria-label={anchorNavigationLabel}
      onMouseEnter={expand}
      onMouseLeave={scheduleCollapse}
    >
      {/* Collapsed: compact dash ruler — evenly stacked from the top,
          so its height tracks the message count instead of filling the
          whole viewport. */}
      <div className="messages-anchor-ruler" aria-hidden={isExpanded}>
        {anchors.map((anchor) => {
          const isActive = activeAnchorId === anchor.id;
          return (
            <span
              key={anchor.id}
              className={`messages-anchor-dash${isActive ? " is-active" : ""}`}
            />
          );
        })}
      </div>

      {/* Expanded: full outline panel flying out to the right. */}
      {isExpanded ? (
        <div className="messages-anchor-panel" role="menu">
          <ul className="messages-anchor-list">
            {anchors.map((anchor, index) => {
              const isActive = activeAnchorId === anchor.id;
              const label = anchor.title?.trim() || getFallbackTitle(index);
              return (
                <li key={anchor.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className={`messages-anchor-row${isActive ? " is-active" : ""}`}
                    onClick={() => handleJump(anchor.id)}
                    aria-current={isActive ? "true" : undefined}
                    title={label}
                    data-testid="messages-anchor-row"
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
