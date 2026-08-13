"use server";

import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/domain";
import type { Json } from "@/types/database";

/**
 * AIインタビュー(docs/04-api-contract.md §2)。
 */

export interface SubmitAnswerInput {
  questionId: string;
  answer: string;
}

export interface SubmitAnswerData {
  answeredCount: number;
  totalCount: number;
  done: boolean;
}

export async function submitAnswer(
  input: SubmitAnswerInput,
): Promise<ActionResult<SubmitAnswerData>> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const trimmed = input.answer.trim();
  if (trimmed === "") {
    return { ok: false, error: "回答を入力してください" };
  }
  if (trimmed.length > 200) {
    return { ok: false, error: "回答は200字以内で入力してください" };
  }

  const { data: questions } = await supabase
    .from("interview_questions")
    .select("id, kind, options")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (!questions || questions.length === 0) {
    return { ok: false, error: "設問が見つかりません" };
  }

  const target = questions.find((q) => q.id === input.questionId);
  if (!target) {
    return { ok: false, error: "指定された設問が見つかりません" };
  }

  if (target.kind === "choice") {
    const options = Array.isArray(target.options)
      ? (target.options as Json[]).filter((o): o is string => typeof o === "string")
      : [];
    if (!options.includes(trimmed)) {
      return { ok: false, error: "選択肢から選んでください" };
    }
  }

  const { data: answeredRows } = await supabase
    .from("interview_answers")
    .select("question_id")
    .eq("profile_id", profile.id);

  const answeredIds = new Set((answeredRows ?? []).map((a) => a.question_id));

  // 回答順の強制: 未回答の設問のうち sort_order が最小のものと一致しない questionId は拒否
  const nextQuestion = questions.find((q) => !answeredIds.has(q.id));
  if (!nextQuestion || nextQuestion.id !== input.questionId) {
    if (!answeredIds.has(input.questionId)) {
      return { ok: false, error: "回答の順序が正しくありません" };
    }
  }

  const { error } = await supabase.from("interview_answers").upsert(
    {
      profile_id: profile.id,
      question_id: input.questionId,
      answer: trimmed,
    },
    { onConflict: "profile_id,question_id" },
  );

  if (error) {
    return { ok: false, error: "回答の保存に失敗しました" };
  }

  const answeredCount = answeredIds.has(input.questionId)
    ? answeredIds.size
    : answeredIds.size + 1;
  const totalCount = questions.length;

  return {
    ok: true,
    data: { answeredCount, totalCount, done: answeredCount >= totalCount },
  };
}

export async function completeInterview(): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: questions } = await supabase
    .from("interview_questions")
    .select("id")
    .eq("is_active", true);

  const { data: answeredRows } = await supabase
    .from("interview_answers")
    .select("question_id")
    .eq("profile_id", profile.id);

  const answeredIds = new Set((answeredRows ?? []).map((a) => a.question_id));
  const allAnswered =
    (questions ?? []).length > 0 && (questions ?? []).every((q) => answeredIds.has(q.id));

  if (!allAnswered) {
    return { ok: false, error: "まだ回答していない質問があります" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ interview_completed_at: new Date().toISOString() })
    .eq("id", profile.id);

  if (error) {
    return { ok: false, error: "完了処理に失敗しました" };
  }

  // 注意(仕様からの逸脱): docs/04-api-contract.md §2 はここで同期的にペルソナ生成を
  // 試行するとしているが、`personas` への INSERT は service_role 専任
  // (docs/03-data-model.md §4.1)であり、本タスクの制約でも admin クライアントの
  // 使用は `api/cron/*` と招待コード検証のみに限定されている。そのためここでは
  // 生成を試みず、`interview_completed_at` の更新のみを行い、ペルソナ生成は
  // バッチ(`/api/cron/matching`)に委ねる。FR-2.6 の「生成が失敗しても待機状態に
  // 進む」という要求は、この経路でも満たされる。

  return { ok: true, data: undefined };
}

/** 開発・展示用。NODE_ENV !== 'production' のみ有効 */
export async function resetInterview(): Promise<ActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "この機能は本番環境では利用できません" };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  await supabase.from("interview_answers").delete().eq("profile_id", profile.id);

  // 注意(仕様からの逸脱): `personas` の DELETE は service_role 専任のため、
  // 本タスクの admin クライアント使用制限の下ではここから削除できない。
  // 開発用リセットのため、回答と完了フラグのみを初期化する。

  const { error } = await supabase
    .from("profiles")
    .update({ interview_completed_at: null })
    .eq("id", profile.id);

  if (error) {
    return { ok: false, error: "リセットに失敗しました" };
  }

  return { ok: true, data: undefined };
}
