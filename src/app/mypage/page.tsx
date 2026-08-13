import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { STEPS, COPY } from "@/lib/constants";
import { currentStepIndex } from "@/lib/status";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * マイページ(docs/06-implementation-plan.md フェーズ5, FR-2.7, FR-8.1)。
 * 現在のステップと、自分のインタビュー回答一覧を表示する。
 */
export default async function MypagePage() {
  const profile = await requireInterviewed();
  const supabase = await createClient();

  const [
    { count: unreadCount },
    { data: decisionRows },
    { count: visibleMatchCount },
    { data: questionRows },
    { data: answerRows },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .is("read_at", null),
    supabase
      .from("match_decisions")
      .select("decision")
      .eq("profile_id", profile.id)
      .order("decided_at", { ascending: false })
      .limit(1),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .or(`profile_a_id.eq.${profile.id},profile_b_id.eq.${profile.id}`),
    supabase
      .from("interview_questions")
      .select("id, text, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("interview_answers").select("question_id, answer").eq("profile_id", profile.id),
  ]);

  const hasVisibleMatch = (visibleMatchCount ?? 0) > 0;
  const latestDecision = decisionRows?.[0]?.decision ?? null;
  const stepIndex = currentStepIndex({ latestDecision, hasVisibleMatch, latestMatchId: null });
  const stepLabel = STEPS[stepIndex]?.label ?? "";

  const answerByQuestionId = new Map((answerRows ?? []).map((a) => [a.question_id, a.answer]));
  const answers = (questionRows ?? [])
    .map((q) => ({ questionText: q.text, answer: answerByQuestionId.get(q.id) }))
    .filter(
      (item): item is { questionText: string; answer: string } => item.answer !== undefined,
    );

  return (
    <AppShell unreadCount={unreadCount ?? 0}>
      <h1 className="screen-title" tabIndex={-1}>
        {COPY.mypage.title}
      </h1>

      <Card>
        <p className="card-title">{COPY.mypage.currentStep}</p>
        <p className="text-body">{stepLabel}</p>
      </Card>

      <SectionTitle>{COPY.mypage.answersTitle}</SectionTitle>

      {answers.length === 0 ? (
        <Card>
          <p className="text-body">{COPY.mypage.noAnswers}</p>
        </Card>
      ) : (
        answers.map((item) => (
          <Card key={item.questionText} className="qa">
            <p className="qa__q">{item.questionText}</p>
            <p className="qa__a">{item.answer}</p>
          </Card>
        ))
      )}
    </AppShell>
  );
}
