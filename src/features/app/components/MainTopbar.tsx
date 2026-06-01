import type { ReactNode } from "react";
// Lawyer copilot: always-visible new-api balance/usage badge
import { UsageBadge } from "../../usage/UsageBadge";

type MainTopbarProps = {
  leftNode: ReactNode;
  actionsNode?: ReactNode;
  className?: string;
};

export function MainTopbar({ leftNode, actionsNode, className }: MainTopbarProps) {
  const classNames = ["main-topbar", className].filter(Boolean).join(" ");
  return (
    <div className={classNames} data-tauri-drag-region>
      <div className="main-topbar-left">{leftNode}</div>
      <div className="actions">
        <UsageBadge />
        {actionsNode ?? null}
      </div>
    </div>
  );
}
