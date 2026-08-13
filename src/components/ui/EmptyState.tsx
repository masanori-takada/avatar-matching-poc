import type { ReactNode } from "react";
import { Icon, type IconName } from "./IconSprite";
import { Card } from "./Card";

export interface EmptyStateProps {
  icon?: IconName;
  message: string;
  children?: ReactNode;
}

/** poc/style.css の .empty を移植した空状態カード */
export function EmptyState({ icon = "i-bell", message, children }: EmptyStateProps) {
  return (
    <Card className="empty">
      <span className="icon-circle">
        <Icon name={icon} />
      </span>
      <p className="text-body">{message}</p>
      {children}
    </Card>
  );
}
