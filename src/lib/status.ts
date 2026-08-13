import { COPY } from "@/lib/constants";
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
