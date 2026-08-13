import Link from "next/link";
import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/IconSprite";
import { COPY } from "@/lib/constants";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * 日程送信完了画面(docs/06-implementation-plan.md フェーズ5, poc/index.html data-screen="done")。
 */
export default async function MatchDonePage() {
  const profile = await requireInterviewed();
  const supabase = await createClient();

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .is("read_at", null);

  return (
    <AppShell unreadCount={unreadCount ?? 0}>
      <div className="card done-card">
        <span className="icon-circle icon-circle--lg">
          <Icon name="i-check" className="icon--lg" />
        </span>
        <h1 className="screen-title" tabIndex={-1}>
          {COPY.done.title}
        </h1>
        <p className="text-body">{COPY.done.body}</p>
      </div>
      <Link href="/home" className="btn btn--primary">
        {COPY.done.backHome}
      </Link>
    </AppShell>
  );
}
