import { AXIS_DEFINITIONS } from "@/lib/constants";
import type { AxisKey, ConversationTurn, ReportAxis } from "@/types/domain";

/**
 * 相性スコアの算出とレポートの検証(docs/03-data-model.md §5.3, docs/05-ai-pipeline.md §5)。
 */

export const AXIS_WEIGHTS: Record<AxisKey, number> = {
  flow: 0.25,
  values: 0.3,
  humor: 0.15,
  interest: 0.2,
  conflict: 0.1,
};

/** conflict は (100 - score) を使う(低いほど良いため) */
export function computeOverallScore(axes: readonly ReportAxis[]): number {
  let total = 0;
  for (const axis of axes) {
    const weight = AXIS_WEIGHTS[axis.key];
    const contribution = axis.key === "conflict" ? 100 - axis.score : axis.score;
    total += weight * contribution;
  }
  return Math.round(total);
}

export interface RawReportAxis {
  key: AxisKey;
  score: number;
  comment: string;
  quote: string;
}

function clampAndRoundScore(score: number): number {
  const rounded = Math.round(score);
  return Math.max(0, Math.min(100, rounded));
}

function findLongestTurn(turns: readonly ConversationTurn[]): ConversationTurn | null {
  if (turns.length === 0) return null;
  return turns.reduce((longest, turn) => (turn.text.length > longest.text.length ? turn : longest));
}

function isSubstringOfAnyTurn(quote: string, turns: readonly ConversationTurn[]): boolean {
  if (quote.trim() === "") return false;
  return turns.some((turn) => turn.text.includes(quote));
}

/**
 * 生成された axes を検証・補正する。
 * 1. axes がちょうど5件、key が5種を過不足なく含む(不足はフォールバックの該当軸で補完)
 * 2. score は 0-100 の整数(範囲外はクランプ、非整数は四捨五入)
 * 3. quote が turns のいずれかの text の部分文字列であること
 *    満たさない場合、最長のターンの先頭60字に差し替える
 */
export function normalizeAxes(
  rawAxes: readonly RawReportAxis[],
  turns: readonly ConversationTurn[],
  fallbackAxes: readonly ReportAxis[],
): ReportAxis[] {
  const byKey = new Map(rawAxes.map((axis) => [axis.key, axis]));
  const fallbackByKey = new Map(fallbackAxes.map((axis) => [axis.key, axis]));
  const longestTurn = findLongestTurn(turns);

  return AXIS_DEFINITIONS.map((def) => {
    const raw = byKey.get(def.key);
    const fallback = fallbackByKey.get(def.key);

    const score = clampAndRoundScore(raw?.score ?? fallback?.score ?? 50);
    const comment = raw?.comment.trim() || fallback?.comment || "";
    let quote = raw?.quote ?? fallback?.quote ?? "";

    if (!isSubstringOfAnyTurn(quote, turns)) {
      quote = longestTurn ? longestTurn.text.slice(0, 60) : fallback?.quote ?? "";
    }

    return {
      key: def.key,
      label: def.label,
      score,
      invertedGood: def.invertedGood,
      comment,
      quote,
    };
  });
}
