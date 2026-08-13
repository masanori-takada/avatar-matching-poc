import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generatePersona, type PersonaAnswerInput } from "@/lib/ai/persona";
import { generateConversation } from "@/lib/ai/conversation";
import { generateReport } from "@/lib/ai/compatibility";
import { computeOverallScore } from "@/lib/matching/scoring";
import { buildCandidatePairs, type CandidateProfile } from "@/lib/matching/candidates";
import {
  MATCH_BATCH_LIMIT,
  MATCH_NOTIFY_THRESHOLD,
  MAX_OPEN_MATCHES_PER_PROFILE,
} from "@/lib/constants";
import type { ConversationTurn, Persona } from "@/types/domain";
import type { Json, MatchStatusDb } from "@/types/database";

/**
 * バッチパイプライン(docs/05-ai-pipeline.md §6)。
 * 全ステップ service_role で実行し、各ステップは独立した try/catch で囲む。
 * 1件の失敗が全体を止めないこと。API呼び出しは直列にする。
 */

export interface MatchingBatchResult {
  personasGenerated: number;
  candidatesCreated: number;
  conversationsGenerated: number;
  reportsGenerated: number;
  notified: number;
  failed: number;
  durationMs: number;
}

const OPEN_MATCH_STATUSES: readonly MatchStatusDb[] = [
  "pending",
  "conversed",
  "evaluated",
  "notified",
  "mutual",
];

const MAX_ATTEMPTS = 3;

type AdminClient = ReturnType<typeof createAdminClient>;

// -----------------------------------------------------------------------------
// 1. ペルソナ未生成の参加者を処理
// -----------------------------------------------------------------------------

async function generateMissingPersonas(admin: AdminClient, limit: number): Promise<number> {
  const { data: candidates } = await admin
    .from("profiles")
    .select("id")
    .not("interview_completed_at", "is", null)
    .eq("is_active", true)
    .limit(500);

  if (!candidates || candidates.length === 0) return 0;

  const { data: existingPersonas } = await admin.from("personas").select("profile_id");
  const hasPersona = new Set((existingPersonas ?? []).map((p) => p.profile_id));

  const targets = candidates.filter((c) => !hasPersona.has(c.id)).slice(0, limit);

  let generated = 0;

  const { data: questionRows } = await admin
    .from("interview_questions")
    .select("id, code, text, kind, options, sort_order");
  const questionsById = new Map((questionRows ?? []).map((q) => [q.id, q]));

  for (const profile of targets) {
    try {
      const { data: answerRows } = await admin
        .from("interview_answers")
        .select("answer, question_id")
        .eq("profile_id", profile.id);

      if (!answerRows || answerRows.length === 0) continue;

      const answers: PersonaAnswerInput[] = answerRows
        .map((row) => {
          const question = questionsById.get(row.question_id);
          if (!question) return null;
          const options = Array.isArray(question.options)
            ? question.options.filter((o): o is string => typeof o === "string")
            : [];
          return {
            questionCode: question.code,
            questionText: question.text,
            kind: question.kind,
            options,
            answer: row.answer,
            sortOrder: question.sort_order,
          };
        })
        .filter((a): a is PersonaAnswerInput & { sortOrder: number } => a !== null)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      if (answers.length === 0) continue;

      const result = await generatePersona(answers);

      const { error } = await admin.from("personas").upsert(
        {
          profile_id: profile.id,
          summary: result.summary,
          traits: result.traits as unknown as Json,
          speaking_style: result.speakingStyle,
          model: result.model,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );

      if (!error) {
        generated += 1;
      }
    } catch {
      // 1件の失敗は無視して次の参加者へ進む
    }
  }

  return generated;
}

// -----------------------------------------------------------------------------
// 2. 新規マッチ候補を選定
// -----------------------------------------------------------------------------

async function createCandidates(admin: AdminClient, limit: number): Promise<number> {
  const { data: personaRows } = await admin.from("personas").select("profile_id");
  const personaProfileIds = (personaRows ?? []).map((p) => p.profile_id);
  if (personaProfileIds.length < 2) return 0;

  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("is_active", true)
    .in("id", personaProfileIds);

  if (!profileRows || profileRows.length < 2) return 0;

  const { data: matchRows } = await admin
    .from("matches")
    .select("profile_a_id, profile_b_id, status");

  const existingPairs = (matchRows ?? []).map((m) => ({
    profileAId: m.profile_a_id,
    profileBId: m.profile_b_id,
  }));

  const openCountByProfile = new Map<string, number>();
  for (const m of matchRows ?? []) {
    if (!OPEN_MATCH_STATUSES.includes(m.status)) continue;
    openCountByProfile.set(m.profile_a_id, (openCountByProfile.get(m.profile_a_id) ?? 0) + 1);
    openCountByProfile.set(m.profile_b_id, (openCountByProfile.get(m.profile_b_id) ?? 0) + 1);
  }

  const candidateProfiles: CandidateProfile[] = profileRows.map((p) => ({
    id: p.id,
    organizationId: p.organization_id,
    openMatchCount: openCountByProfile.get(p.id) ?? 0,
  }));

  const pairs = buildCandidatePairs(
    candidateProfiles,
    existingPairs,
    MAX_OPEN_MATCHES_PER_PROFILE,
    limit,
  );

  if (pairs.length === 0) return 0;

  const { data: inserted, error } = await admin
    .from("matches")
    .upsert(
      pairs.map((pair) => ({
        profile_a_id: pair.profileAId,
        profile_b_id: pair.profileBId,
        status: "pending" as const,
      })),
      { onConflict: "profile_a_id,profile_b_id", ignoreDuplicates: true },
    )
    .select("id");

  if (error) return 0;
  return inserted?.length ?? 0;
}

// -----------------------------------------------------------------------------
// persona 行 → ドメイン Persona への変換
// -----------------------------------------------------------------------------

interface PersonaRowLike {
  profile_id: string;
  summary: string;
  traits: Json;
  speaking_style: string;
  model: string;
  generated_at: string;
}

function toPersona(row: PersonaRowLike): Persona {
  return {
    profileId: row.profile_id,
    summary: row.summary,
    traits: row.traits as unknown as Persona["traits"],
    speakingStyle: row.speaking_style,
    model: row.model,
    generatedAt: row.generated_at,
  };
}

async function recordAttemptFailure(
  admin: AdminClient,
  matchId: string,
  attemptCount: number,
  errorMessage: string,
): Promise<void> {
  const nextAttempt = attemptCount + 1;
  const nextStatus: MatchStatusDb = nextAttempt >= MAX_ATTEMPTS ? "failed" : "pending";
  await admin
    .from("matches")
    .update({
      attempt_count: nextAttempt,
      last_error: errorMessage.slice(0, 500),
      status: nextStatus,
    })
    .eq("id", matchId);
}

// -----------------------------------------------------------------------------
// 3. 候補ごとに会話生成
// -----------------------------------------------------------------------------

async function generateConversations(admin: AdminClient, limit: number): Promise<number> {
  const { data: matches } = await admin
    .from("matches")
    .select("id, profile_a_id, profile_b_id, attempt_count")
    .eq("status", "pending")
    .lt("attempt_count", MAX_ATTEMPTS)
    .limit(limit);

  if (!matches || matches.length === 0) return 0;

  let generated = 0;

  for (const match of matches) {
    try {
      const { data: personaRows } = await admin
        .from("personas")
        .select("*")
        .in("profile_id", [match.profile_a_id, match.profile_b_id]);

      const personaA = personaRows?.find((p) => p.profile_id === match.profile_a_id);
      const personaB = personaRows?.find((p) => p.profile_id === match.profile_b_id);

      if (!personaA || !personaB) {
        await recordAttemptFailure(admin, match.id, match.attempt_count, "ペルソナが見つかりません");
        continue;
      }

      const result = await generateConversation(toPersona(personaA), toPersona(personaB));

      const { error: upsertError } = await admin.from("avatar_conversations").upsert(
        {
          match_id: match.id,
          turns: result.turns as unknown as Json,
          time_label: result.timeLabel,
          model: result.model,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "match_id" },
      );

      if (upsertError) {
        await recordAttemptFailure(admin, match.id, match.attempt_count, upsertError.message);
        continue;
      }

      await admin.from("matches").update({ status: "conversed" }).eq("id", match.id);
      generated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "会話生成に失敗しました";
      await recordAttemptFailure(admin, match.id, match.attempt_count, message);
    }
  }

  return generated;
}

// -----------------------------------------------------------------------------
// 4. 相性レポート生成
// -----------------------------------------------------------------------------

async function generateReports(admin: AdminClient, limit: number): Promise<number> {
  const { data: matches } = await admin
    .from("matches")
    .select("id, profile_a_id, profile_b_id, attempt_count")
    .eq("status", "conversed")
    .lt("attempt_count", MAX_ATTEMPTS)
    .limit(limit);

  if (!matches || matches.length === 0) return 0;

  let generated = 0;

  for (const match of matches) {
    try {
      const { data: conversation } = await admin
        .from("avatar_conversations")
        .select("turns")
        .eq("match_id", match.id)
        .maybeSingle();

      if (!conversation) {
        await recordAttemptFailure(admin, match.id, match.attempt_count, "会話ログが見つかりません");
        continue;
      }

      const { data: personaRows } = await admin
        .from("personas")
        .select("*")
        .in("profile_id", [match.profile_a_id, match.profile_b_id]);

      const personaA = personaRows?.find((p) => p.profile_id === match.profile_a_id);
      const personaB = personaRows?.find((p) => p.profile_id === match.profile_b_id);

      if (!personaA || !personaB) {
        await recordAttemptFailure(admin, match.id, match.attempt_count, "ペルソナが見つかりません");
        continue;
      }

      const turns = conversation.turns as unknown as ConversationTurn[];
      const result = await generateReport(toPersona(personaA), toPersona(personaB), turns);
      const overallScore = computeOverallScore(result.axes);

      const { error: upsertError } = await admin.from("compatibility_reports").upsert(
        {
          match_id: match.id,
          overall_score: overallScore,
          axes: result.axes as unknown as Json,
          summary: result.summary,
          model: result.model,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "match_id" },
      );

      if (upsertError) {
        await recordAttemptFailure(admin, match.id, match.attempt_count, upsertError.message);
        continue;
      }

      await admin
        .from("matches")
        .update({ status: "evaluated", overall_score: overallScore })
        .eq("id", match.id);
      generated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "相性評価に失敗しました";
      await recordAttemptFailure(admin, match.id, match.attempt_count, message);
    }
  }

  return generated;
}

// -----------------------------------------------------------------------------
// 5. 閾値以上なら notifications を両者に作成
// -----------------------------------------------------------------------------

async function notifyQualified(admin: AdminClient, limit: number): Promise<number> {
  const { data: matches } = await admin
    .from("matches")
    .select("id, profile_a_id, profile_b_id, overall_score")
    .eq("status", "evaluated")
    .gte("overall_score", MATCH_NOTIFY_THRESHOLD)
    .limit(limit);

  if (!matches || matches.length === 0) return 0;

  let notified = 0;

  for (const match of matches) {
    try {
      const now = new Date().toISOString();
      const rows = [match.profile_a_id, match.profile_b_id].flatMap((profileId) => [
        {
          profile_id: profileId,
          kind: "match_found" as const,
          title: "新しいマッチ候補がいます",
          body: "相性基準を満たしたペアが見つかりました。",
          match_id: match.id,
        },
        {
          profile_id: profileId,
          kind: "report_ready" as const,
          title: "相性レポートが準備できました",
          body: "会話ログと相性レポートを確認できます。",
          match_id: match.id,
        },
      ]);

      const { error: notifyError } = await admin.from("notifications").insert(rows);
      if (notifyError) continue;

      const { error: updateError } = await admin
        .from("matches")
        .update({ status: "notified", notified_at: now })
        .eq("id", match.id);

      if (!updateError) {
        notified += 1;
      }
    } catch {
      // 1件の失敗は無視して次のマッチへ進む
    }
  }

  return notified;
}

// -----------------------------------------------------------------------------
// エントリポイント
// -----------------------------------------------------------------------------

export async function runMatchingBatch(params: {
  limit?: number;
}): Promise<MatchingBatchResult> {
  const startedAt = Date.now();
  const limit = params.limit ?? MATCH_BATCH_LIMIT;
  const admin = createAdminClient();

  let personasGenerated = 0;
  let candidatesCreated = 0;
  let conversationsGenerated = 0;
  let reportsGenerated = 0;
  let notified = 0;

  try {
    personasGenerated = await generateMissingPersonas(admin, limit);
  } catch {
    // このステップの失敗はバッチ全体を止めない
  }

  try {
    candidatesCreated = await createCandidates(admin, limit);
  } catch {
    // このステップの失敗はバッチ全体を止めない
  }

  try {
    conversationsGenerated = await generateConversations(admin, limit);
  } catch {
    // このステップの失敗はバッチ全体を止めない
  }

  try {
    reportsGenerated = await generateReports(admin, limit);
  } catch {
    // このステップの失敗はバッチ全体を止めない
  }

  try {
    notified = await notifyQualified(admin, limit);
  } catch {
    // このステップの失敗はバッチ全体を止めない
  }

  let failed = 0;
  try {
    const { count } = await admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    failed = count ?? 0;
  } catch {
    failed = 0;
  }

  return {
    personasGenerated,
    candidatesCreated,
    conversationsGenerated,
    reportsGenerated,
    notified,
    failed,
    durationMs: Date.now() - startedAt,
  };
}
