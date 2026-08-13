import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotificationList } from "@/components/feature/NotificationList";
import { COPY } from "@/lib/constants";
import type { NotificationItem } from "@/types/domain";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * お知らせ一覧画面(docs/06-implementation-plan.md フェーズ4, FR-4)。
 */
export default async function NotificationsPage() {
  const profile = await requireInterviewed();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("notifications")
    .select("id, kind, title, body, match_id, read_at, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  const items: NotificationItem[] = (rows ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    matchId: r.match_id,
    readAt: r.read_at,
    createdAt: r.created_at,
  }));

  const unreadCount = items.filter((i) => !i.readAt).length;

  return (
    <AppShell unreadCount={unreadCount}>
      <h1 className="screen-title" tabIndex={-1}>
        {COPY.notifications.title}
      </h1>
      {items.length === 0 ? (
        <EmptyState icon="i-bell" message={COPY.notifications.empty} />
      ) : (
        <NotificationList items={items} />
      )}
    </AppShell>
  );
}
