import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/IconSprite";
import { Steps } from "@/components/ui/Steps";
import { COPY } from "@/lib/constants";
import { currentStepIndex, loadHomeState } from "@/lib/status";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * アバター会話中(待機)画面(docs/06-implementation-plan.md フェーズ4)。
 */
export default async function WaitingPage() {
  const profile = await requireInterviewed();
  const supabase = await createClient();

  const [{ count: unreadCount }, state] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .is("read_at", null),
    loadHomeState(supabase, profile.id),
  ]);

  const stepIndex = currentStepIndex(state);

  return (
    <AppShell unreadCount={unreadCount ?? 0}>
      <div className="hero">
        <div className="hero__text">
          <h1 className="hero-title" tabIndex={-1}>
            {COPY.waiting.title}
          </h1>
          <p className="hero__lead">{COPY.waiting.lead}</p>
        </div>
        <div className="hero__art">
          <Icon name="i-avatar-pair" className="hero__icon" />
        </div>
      </div>

      <Card className="status-card">
        <div className="status-card__head">
          <span className="icon-circle status-card__pulse">
            <Icon name="i-avatar-pair" />
          </span>
          <div>
            <p className="card-title">{COPY.waiting.cardTitle}</p>
            <p className="text-body">{COPY.waiting.cardBody}</p>
          </div>
        </div>
        <Steps currentIndex={stepIndex} />
      </Card>

      <p className="text-note">{COPY.waiting.note}</p>
    </AppShell>
  );
}
