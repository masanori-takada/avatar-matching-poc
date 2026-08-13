import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { InterviewChat } from "@/components/feature/InterviewChat";
import type { InterviewQuestion } from "@/types/domain";
import type { Json } from "@/types/database";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * AIインタビュー画面(docs/06-implementation-plan.md フェーズ3)。
 */
export default async function InterviewPage() {
  const profile = await requireProfile();

  if (profile.interviewCompletedAt) {
    redirect("/");
  }

  const supabase = await createClient();

  const { data: questionRows } = await supabase
    .from("interview_questions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const questions: InterviewQuestion[] = (questionRows ?? []).map((q) => ({
    id: q.id,
    code: q.code,
    sortOrder: q.sort_order,
    kind: q.kind,
    text: q.text,
    options: Array.isArray(q.options)
      ? (q.options as Json[]).filter((o): o is string => typeof o === "string")
      : [],
    isActive: q.is_active,
  }));

  const { data: answerRows } = await supabase
    .from("interview_answers")
    .select("question_id, answer")
    .eq("profile_id", profile.id);

  const initialAnswers = (answerRows ?? []).map((a) => ({
    questionId: a.question_id,
    answer: a.answer,
  }));

  return <InterviewChat questions={questions} initialAnswers={initialAnswers} />;
}
