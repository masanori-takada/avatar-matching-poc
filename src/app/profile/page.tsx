import Link from "next/link";
import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/IconSprite";
import { COPY } from "@/lib/constants";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * プロフィール画面(docs/06-implementation-plan.md フェーズ5, FR-1.5)。
 * 匿名IDと所属組織の匿名表示ラベルのみを表示する。
 * 自分の実名・所属企業名(identities)は、PoC同様ここには一切表示しない。
 */
export default async function ProfilePage() {
  const profile = await requireInterviewed();
  const supabase = await createClient();

  const [{ count: unreadCount }, { data: organization }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .is("read_at", null),
    supabase
      .from("organizations")
      .select("display_label")
      .eq("id", profile.organizationId)
      .maybeSingle(),
  ]);

  return (
    <AppShell unreadCount={unreadCount ?? 0}>
      <h1 className="screen-title" tabIndex={-1}>
        {COPY.profile.title}
      </h1>

      <Card className="profile-card">
        <span className="icon-circle icon-circle--lg">
          <Icon name="i-user" className="icon--lg" />
        </span>
        <p className="profile-card__id">
          {COPY.profile.anonymousIdLabel}: {profile.anonymousId}
        </p>
        <p className="profile-card__company">
          {COPY.profile.companyLabel}: {organization?.display_label ?? "-"}
        </p>
      </Card>

      <Card>
        <p className="text-body">{COPY.profile.note1}</p>
        <p className="text-note">{COPY.profile.note2}</p>
      </Card>

      <Link href="/privacy" className="btn btn--secondary">
        {COPY.profile.privacyLink}
      </Link>
    </AppShell>
  );
}
