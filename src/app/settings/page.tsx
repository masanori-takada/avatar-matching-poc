import Link from "next/link";
import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/IconSprite";
import { SettingsControls } from "@/components/feature/SettingsControls";
import { COPY } from "@/lib/constants";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * 設定画面(docs/06-implementation-plan.md フェーズ5, FR-8.3〜8.4)。
 */
export default async function SettingsPage() {
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
        {COPY.settings.title}
      </h1>

      <SettingsControls initialNotificationsEnabled={profile.notificationsEnabled} />

      <div className="card list">
        <Link href="/privacy" className="list__item">
          <span>{COPY.settings.privacyLink}</span>
          <Icon name="i-chevron" className="notice__chevron" />
        </Link>
        <Link href="/faq" className="list__item">
          <span>{COPY.settings.faqLink}</span>
          <Icon name="i-chevron" className="notice__chevron" />
        </Link>
      </div>
    </AppShell>
  );
}
