import Link from "next/link";
import { Icon } from "@/components/ui/IconSprite";
import { COPY } from "@/lib/constants";

export interface AppHeaderProps {
  unreadCount?: number;
}

/** poc/index.html の .app-header を移植したヘッダー(ブランド + ベル + 未読バッジ) */
export function AppHeader({ unreadCount = 0 }: AppHeaderProps) {
  const hasUnread = unreadCount > 0;
  const ariaLabel = hasUnread ? `${COPY.bellAriaLabel} 未読${unreadCount}件` : COPY.bellAriaLabel;

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="icon-circle icon-circle--sm">
          <Icon name="i-logo" />
        </span>
        <span className="app-header__title">{COPY.serviceName}</span>
      </div>
      <Link href="/notifications" className="bell" aria-label={ariaLabel}>
        <Icon name="i-bell" />
        {hasUnread ? <span className="bell__badge">{unreadCount}</span> : null}
      </Link>
    </header>
  );
}
