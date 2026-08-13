import Link from "next/link";
import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { COPY } from "@/lib/constants";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * 辞退完了画面(docs/06-implementation-plan.md フェーズ4, FR-5.6, FR-7)。
 */
export default async function MatchDeclinedPage() {
  const profile = await requireInterviewed();
  const supabase = await createClient();

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .is("read_at", null);

  return (
    <AppShell unreadCount={unreadCount ?? 0}>
      <h1 className="screen-title" tabIndex={-1}>
        {COPY.declined.title}
      </h1>
      <Card>
        <p className="text-body">{COPY.declined.body}</p>
      </Card>
      <Link href="/home" className="btn btn--primary">
        {COPY.declined.backHome}
      </Link>
    </AppShell>
  );
}
