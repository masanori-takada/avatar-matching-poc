import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { COPY } from "@/lib/constants";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * よくある質問画面(docs/06-implementation-plan.md フェーズ5, FR-8.2)。
 * poc/index.html data-screen="faq" の文言をそのまま移植。
 */
export default async function FaqPage() {
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
        {COPY.faq.title}
      </h1>

      {COPY.faq.items.map((item) => (
        <details className="card faq" key={item.question}>
          <summary className="faq__q">{item.question}</summary>
          <p className="text-body faq__a">{item.answer}</p>
        </details>
      ))}
    </AppShell>
  );
}
