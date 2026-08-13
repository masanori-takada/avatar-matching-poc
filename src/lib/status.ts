import type { SupabaseClient } from "@supabase/supabase-js";
import { COPY } from "@/lib/constants";
import type { Database } from "@/types/database";
import type { MatchDecisionValue } from "@/types/domain";

/**
 * ホーム/待機画面で共有するステップ・状況文言の算出(poc/app.js currentStepIndex/statusText 相当)。
 * DB由来の状態から決定的に導出する。
 */

export interface HomeStateInput {
  /** 自分の最新の判断(未判断なら null) */
  latestDecision: MatchDecisionValue | null;
  /** 参照可能な(notified/mutual/closed)マッチが1件以上あるか */
  hasVisibleMatch: boolean;
  /** 直近の参照可能なマッチID(スコープ外: 複数マッチの同時進行UIは実装しないため、最新1件を扱う) */
  latestMatchId: string | null;
}

/**
 * finding #9: home/waiting/mypage の3ページがそれぞれ独自に
 * 「直近の判断」と「直近の参照可能マッチ」を別々のクエリで取得しており、
 * `latestDecision` が `latestMatchId` とは無関係などこかのマッチの
 * 最新判断になってしまっていた(例: 昔 decline した別マッチの判断が、
 * 今表示しようとしている最新マッチのステータスカードに「辞退しました」と
 * 出てしまう)。3ページから共通で呼べる1つの導出関数にまとめ、
 * 判断の取得を必ず `latestMatchId` にスコープすることで再発を防ぐ。
 */
export async function loadHomeState(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<HomeStateInput> {
  const { data: matchRows } = await supabase
    .from("matches")
    .select("id")
    .or(`profile_a_id.eq.${profileId},profile_b_id.eq.${profileId}`)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestMatchId = matchRows?.[0]?.id ?? null;
  const hasVisibleMatch = (matchRows?.length ?? 0) > 0;

  let latestDecision: MatchDecisionValue | null = null;
  if (latestMatchId) {
    const { data: decisionRow } = await supabase
      .from("match_decisions")
      .select("decision")
      .eq("profile_id", profileId)
      .eq("match_id", latestMatchId)
      .maybeSingle();
    latestDecision = decisionRow?.decision ?? null;
  }

  return { latestDecision, hasVisibleMatch, latestMatchId };
}

export function currentStepIndex(input: HomeStateInput): number {
  if (input.latestDecision) return 4;
  if (input.hasVisibleMatch) return 3;
  return 2;
}

export function statusText(input: HomeStateInput): string {
  if (input.latestDecision === "accept") return COPY.home.statusAcceptedText;
  if (input.latestDecision === "decline") return COPY.home.statusDeclinedText;
  if (input.hasVisibleMatch) return COPY.home.statusNotifiedText;
  return COPY.home.statusDefaultText;
}

export function statusActionLabel(input: HomeStateInput): string {
  return input.hasVisibleMatch ? COPY.home.statusActionNotified : COPY.home.statusActionDefault;
}

export function statusTargetHref(input: HomeStateInput): string {
  if (input.hasVisibleMatch && input.latestMatchId) {
    return `/matches/${input.latestMatchId}`;
  }
  return input.hasVisibleMatch ? "/notifications" : "/waiting";
}
