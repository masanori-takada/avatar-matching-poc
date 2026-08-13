import Link from "next/link";
import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { COPY } from "@/lib/constants";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * プライバシー説明画面(docs/06-implementation-plan.md フェーズ5, FR-8.2)。
 * poc/index.html data-screen="privacy" の文言を移植。ただし localStorage/デモへの
 * 言及は、実際の保存先である Supabase(RLS)の説明に置き換えている。
 */
export default async function PrivacyPage() {
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
        {COPY.privacy.title}
      </h1>

      {COPY.privacy.cards.map((card) => (
        <div className="card doc" key={card.heading}>
          <h2 className="doc__heading">{card.heading}</h2>
          <p className="text-body">{card.body}</p>
        </div>
      ))}

      <Link href="/settings" className="btn btn--secondary">
        {COPY.privacy.openSettings}
      </Link>
    </AppShell>
  );
}
