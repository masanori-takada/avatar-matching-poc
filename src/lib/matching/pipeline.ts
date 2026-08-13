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
// ページング付き全件取得
//
// PostgREST は supabase/config.toml の `api.max_rows`(このプロジェクトでは
// 1000)を超える行を単一リクエストでは絶対に返さない。matches / personas /
// match_decisions のような「全件を読んで集計する」クエリをこの上限に
// 依存させると、件数がしきい値を超えた瞬間に結果が静かに切り詰められ、
// オープンマッチ数のカウントなどが過小評価される(finding #13)。
// `.range()` を使って明示的にページングし、この上限の影響を受けないようにする。
// -----------------------------------------------------------------------------

const FETCH_PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize: number = FETCH_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

// -----------------------------------------------------------------------------
// 1. ペルソナ未生成の参加者を処理
// -----------------------------------------------------------------------------

async function generateMissingPersonas(admin: AdminClient, limit: number): Promise<number> {
  // finding #12: 以前は `.limit(500)` を「ペルソナ未生成」フィルタより先に
  // 適用していたため、面談完了者が500人を超えると、501人目以降は
  // 「まだペルソナが無い」対象にすら選ばれず、恒久的にペルソナが生成されない
  // 可能性があった。ペルソナ未生成というフィルタをクエリ自体に組み込み、
  // interview_completed_at の昇順(先に面談を終えた人を優先)で決定的に
  // limit 件だけ取得することで、どの参加者も無限に待たされないようにする。
  const existingPersonas = await fetchAllPages<{ profile_id: string }>((from, to) =>
    admin.from("personas").select("profile_id").range(from, to),
  );
  const personaProfileIds = existingPersonas.map((p) => p.profile_id);

  let query = admin
    .from("profiles")
    .select("id")
    .not("interview_completed_at", "is", null)
    .eq("is_active", true)
    .order("interview_completed_at", { ascending: true });

  if (personaProfileIds.length > 0) {
    query = query.not("id", "in", `(${personaProfileIds.join(",")})`);
  }

  const { data: candidates } = await query.limit(limit);

  if (!candidates || candidates.length === 0) return 0;

  let generated = 0;

  const { data: questionRows } = await admin
    .from("interview_questions")
    .select("id, code, text, kind, options, sort_order");
  const questionsById = new Map((questionRows ?? []).map((q) => [q.id, q]));

  for (const profile of candidates) {
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
  const personaRows = await fetchAllPages<{ profile_id: string }>((from, to) =>
    admin.from("personas").select("profile_id").range(from, to),
  );
  const personaProfileIds = personaRows.map((p) => p.profile_id);
  if (personaProfileIds.length < 2) return 0;

  const { data: profileRows } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("is_active", true)
    .in("id", personaProfileIds);

  if (!profileRows || profileRows.length < 2) return 0;

  // finding #13: matches はページングして全件読む(max_rows での切り詰め対策)。
  const matchRows = await fetchAllPages<{
    id: string;
    profile_a_id: string;
    profile_b_id: string;
    status: MatchStatusDb;
  }>((from, to) =>
    admin.from("matches").select("id, profile_a_id, profile_b_id, status").range(from, to),
  );

  // finding #5: 「オープン」の定義。決定的に閉じたと言えるのは、
  // (a) どちらかが decline した、または (b) mutual に到達し両者が同じ枠に
  // 合意した(このバッチの後段 closeResolvedMatches が status='closed' にする)。
  // decline は matches.status を変えない(NFR-2: 変えると、相手側から
  // status の変化を通じて辞退が推測できてしまう。matches の SELECT ポリシーは
  // closed を当事者双方に返すため、'closed' に倒すと辞退した事実が相手にも
  // 見えてしまう)。そのため decline によるクローズは status 更新ではなく、
  // ここでの集計(オープン件数のカウント)からだけ除外する
  // decisions-aware なクエリで表現する。
  const declinedRows = await fetchAllPages<{ match_id: string }>((from, to) =>
    admin.from("match_decisions").select("match_id").eq("decision", "decline").range(from, to),
  );
  const declinedMatchIds = new Set(declinedRows.map((d) => d.match_id));

  const existingPairs = matchRows.map((m) => ({
    profileAId: m.profile_a_id,
    profileBId: m.profile_b_id,
  }));

  const openCountByProfile = new Map<string, number>();
  for (const m of matchRows) {
    if (!OPEN_MATCH_STATUSES.includes(m.status)) continue;
    if (declinedMatchIds.has(m.id)) continue;
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

/**
 * finding #6: 以前は失敗のたびに status を無条件で 'pending' に巻き戻していた。
 * これだと、レポート生成(4番目のステージ、status='conversed')の失敗が
 * 'pending' へ巻き戻し、次回実行時に会話生成からやり直され、既に保存済みの
 * 会話ログが上書きされてしまう。失敗しても現在のステージ(呼び出し元が渡す
 * `currentStatus`)はそのまま維持し、最大試行回数に達したときだけ 'failed' に
 * 進める。
 */
async function recordAttemptFailure(
  admin: AdminClient,
  matchId: string,
  attemptCount: number,
  currentStatus: MatchStatusDb,
  errorMessage: string,
): Promise<void> {
  const nextAttempt = attemptCount + 1;
  const nextStatus: MatchStatusDb = nextAttempt >= MAX_ATTEMPTS ? "failed" : currentStatus;
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
        await recordAttemptFailure(
          admin,
          match.id,
          match.attempt_count,
          "pending",
          "ペルソナが見つかりません",
        );
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
        await recordAttemptFailure(
          admin,
          match.id,
          match.attempt_count,
          "pending",
          upsertError.message,
        );
        continue;
      }

      await admin.from("matches").update({ status: "conversed" }).eq("id", match.id);
      generated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "会話生成に失敗しました";
      await recordAttemptFailure(admin, match.id, match.attempt_count, "pending", message);
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
        await recordAttemptFailure(
          admin,
          match.id,
          match.attempt_count,
          "conversed",
          "会話ログが見つかりません",
        );
        continue;
      }

      const { data: personaRows } = await admin
        .from("personas")
        .select("*")
        .in("profile_id", [match.profile_a_id, match.profile_b_id]);

      const personaA = personaRows?.find((p) => p.profile_id === match.profile_a_id);
      const personaB = personaRows?.find((p) => p.profile_id === match.profile_b_id);

      if (!personaA || !personaB) {
        await recordAttemptFailure(
          admin,
          match.id,
          match.attempt_count,
          "conversed",
          "ペルソナが見つかりません",
        );
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
        await recordAttemptFailure(
          admin,
          match.id,
          match.attempt_count,
          "conversed",
          upsertError.message,
        );
        continue;
      }

      await admin
        .from("matches")
        .update({ status: "evaluated", overall_score: overallScore })
        .eq("id", match.id);
      generated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "相性評価に失敗しました";
      await recordAttemptFailure(admin, match.id, match.attempt_count, "conversed", message);
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

      // finding #8: 通知の INSERT は status のフリップより前に行われる。この順序で
      // 途中失敗(status 更新の失敗)が起きると、次回実行時に同じ4行が重複挿入
      // されていた。順序を変えるのではなく、(profile_id, match_id, kind) の
      // unique 制約 + upsert(ignoreDuplicates) で冪等にする。これなら
      // 通知INSERTとstatus更新のどちらを先にしても安全(finding指示のとおり
      // 「順序に関わらず頑健」な方を採用)。
      const { error: notifyError } = await admin
        .from("notifications")
        .upsert(rows, { onConflict: "profile_id,match_id,kind", ignoreDuplicates: true });
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
// 6. mutual かつ両者が同じ枠に合意したマッチを closed にする
//
// finding #5: 「オープン」の定義を厳密化する。decline による解決は matches の
// SELECT ポリシーが closed を当事者双方に返す都合上、status を書き換えると
// 辞退していない側にも状態変化が漏れる(NFR-2)ため、status には触れず
// createCandidates 側の decisions-aware な集計だけで扱う(このファイル冒頭)。
//
// 一方 mutual → 両者合意 のクローズは安全に status へ反映できる: 相互accept
// した時点で両者は既にお互いの身元を確認し合っており(is_revealed_partner)、
// closed への遷移は「もう新しい情報を渡していない」ので NFR-2 の対象外。
// -----------------------------------------------------------------------------

async function closeResolvedMatches(admin: AdminClient): Promise<number> {
  const mutualMatches = await fetchAllPages<{ id: string }>((from, to) =>
    admin.from("matches").select("id").eq("status", "mutual").range(from, to),
  );
  if (mutualMatches.length === 0) return 0;

  const mutualMatchIds = new Set(mutualMatches.map((m) => m.id));

  const selections = await fetchAllPages<{ match_id: string; slot_id: string }>((from, to) =>
    admin.from("slot_selections").select("match_id, slot_id").range(from, to),
  );

  const slotIdsByMatch = new Map<string, string[]>();
  for (const selection of selections) {
    if (!mutualMatchIds.has(selection.match_id)) continue;
    const list = slotIdsByMatch.get(selection.match_id) ?? [];
    list.push(selection.slot_id);
    slotIdsByMatch.set(selection.match_id, list);
  }

  let closed = 0;
  for (const [matchId, slotIds] of slotIdsByMatch) {
    const agreed = slotIds.length === 2 && slotIds[0] === slotIds[1];
    if (!agreed) continue;

    const { error } = await admin
      .from("matches")
      .update({ status: "closed" })
      .eq("id", matchId)
      .eq("status", "mutual");

    if (!error) closed += 1;
  }

  return closed;
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

  try {
    // finding #5: mutual かつ両者合意のマッチを closed にする。docs/04-api-contract.md
    // §7 が定めるレスポンス形状は変えず、副作用としてのみ実行する。
    await closeResolvedMatches(admin);
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
