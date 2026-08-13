import { redirect } from "next/navigation";
import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/IconSprite";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ConversationLog } from "@/components/feature/ConversationLog";
import { ReportAxes } from "@/components/feature/ReportAxes";
import { DecisionPanel } from "@/components/feature/DecisionPanel";
import { COPY } from "@/lib/constants";
import type { ConversationTurn, ReportAxis } from "@/types/domain";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

interface MatchPageProps {
  params: Promise<{ matchId: string }>;
}

/**
 * 会話ログ・相性レポート画面(docs/06-implementation-plan.md フェーズ4, FR-5)。
 */
export default async function MatchPage({ params }: MatchPageProps) {
  const { matchId } = await params;
  const profile = await requireInterviewed();
  const supabase = await createClient();

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .is("read_at", null);

  const { data: match } = await supabase
    .from("matches")
    .select("id, profile_a_id, profile_b_id, status, overall_score")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) {
    return (
      <AppShell unreadCount={unreadCount ?? 0}>
        <h1 className="screen-title" tabIndex={-1}>
          {COPY.report.axesTitle}
        </h1>
        <EmptyState icon="i-doc" message={COPY.report.empty} />
      </AppShell>
    );
  }

  const { data: ownDecisionRow } = await supabase
    .from("match_decisions")
    .select("decision")
    .eq("match_id", matchId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (ownDecisionRow?.decision === "decline") {
    redirect(`/matches/${matchId}/declined`);
  }

  const [{ data: conversation }, { data: report }] = await Promise.all([
    supabase
      .from("avatar_conversations")
      .select("turns, time_label")
      .eq("match_id", matchId)
      .maybeSingle(),
    supabase
      .from("compatibility_reports")
      .select("axes, summary, overall_score")
      .eq("match_id", matchId)
      .maybeSingle(),
  ]);

  const viewerIsProfileA = match.profile_a_id === profile.id;
  const turns = (conversation?.turns as unknown as ConversationTurn[] | undefined) ?? [];
  const axes = (report?.axes as unknown as ReportAxis[] | undefined) ?? [];
  const overallScore = report?.overall_score ?? match.overall_score ?? 0;

  return (
    <AppShell unreadCount={unreadCount ?? 0}>
      <Card className="partner">
        <div className="partner__row">
          <span className="icon-circle icon-circle--lg">
            <Icon name="i-user" className="icon--lg" />
          </span>
          <div className="partner__meta">
            <h1 className="partner__name" tabIndex={-1}>
              {COPY.report.partnerLabel}
            </h1>
            <p className="partner__sub">{COPY.report.partnerSub}</p>
          </div>
          <Badge>相性 {overallScore}%</Badge>
        </div>
        <p className="text-note">{COPY.report.partnerNote}</p>
      </Card>

      {conversation ? (
        <ConversationLog
          turns={turns}
          timeLabel={conversation.time_label}
          viewerIsProfileA={viewerIsProfileA}
        />
      ) : null}

      {axes.length > 0 ? <ReportAxes axes={axes} /> : null}

      {report ? (
        <Card>
          <SectionTitle flush>{COPY.report.summaryTitle}</SectionTitle>
          <p className="text-body">{report.summary}</p>
        </Card>
      ) : null}

      <DecisionPanel
        matchId={matchId}
        initialDecision={ownDecisionRow?.decision ?? null}
        initialMutual={match.status === "mutual"}
      />
    </AppShell>
  );
}
