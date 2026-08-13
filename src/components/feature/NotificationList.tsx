"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/app/actions/notifications";
import { Icon, type IconName } from "@/components/ui/IconSprite";
import type { NotificationItem } from "@/types/domain";

const NOTICE_ICON: Record<NotificationItem["kind"], IconName> = {
  match_found: "i-bell",
  report_ready: "i-doc",
  schedule_confirmed: "i-calendar",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}日前`;
}

export interface NotificationListProps {
  items: NotificationItem[];
}

/**
 * お知らせ一覧(docs/06-implementation-plan.md フェーズ4, FR-4)。
 * タップで既読化 + 遷移するため 'use client'。
 */
export function NotificationList({ items }: NotificationListProps) {
  const router = useRouter();
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.readAt).map((i) => i.id)),
  );
  const [, startTransition] = useTransition();

  function handleClick(item: NotificationItem) {
    if (!readIds.has(item.id)) {
      setReadIds((prev) => new Set(prev).add(item.id));
      startTransition(() => {
        void markNotificationRead(item.id);
      });
    }
    router.push(item.matchId ? `/matches/${item.matchId}` : "/notifications");
  }

  return (
    <div>
      {items.map((item) => {
        const unread = !readIds.has(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={unread ? "card notice is-unread" : "card notice"}
            onClick={() => handleClick(item)}
          >
            <span className="icon-circle">
              <Icon name={NOTICE_ICON[item.kind]} />
            </span>
            <span className="notice__body">
              <span className="notice__title">
                {unread ? (
                  <>
                    <span className="notice__dot" aria-hidden="true" />
                    <span className="sr-only">未読</span>
                  </>
                ) : null}
                {item.title}
              </span>
              <span className="notice__text">{item.body}</span>
              <span className="notice__time">{formatRelativeTime(item.createdAt)}</span>
            </span>
            <Icon name="i-chevron" className="notice__chevron" />
          </button>
        );
      })}
    </div>
  );
}
