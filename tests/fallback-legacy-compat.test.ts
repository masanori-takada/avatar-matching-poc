/**
 * 設問を6問から20問へ拡張した際の後方互換ガード。
 * trait 導出を多数決へ書き換えたため、元の6問だけに回答した場合は
 * 旧実装(単純な三項演算)と完全に同じ traits を返さなければならない。
 * q1/q2/q4/q5 の全81通りを総当たりで比較する。
 */
import { describe, it, expect } from "vitest";
import { buildFallbackPersona } from "@/lib/ai/fallback";

// 旧実装(6問時代)のロジックをそのまま再現
function legacy(idx: Record<string, number | null>) {
  const q1 = idx.q1, q2 = idx.q2, q4 = idx.q4, q5 = idx.q5;
  return {
    social_energy: q1 === 0 ? "outgoing" : q1 === 1 ? "reserved" : "balanced",
    conversation_style: q2 === 0 ? "initiator" : q2 === 1 ? "listener" : "adaptive",
    comfort_preference: q4 === 0 ? "humor" : q4 === 1 ? "shared_values" : "new_perspectives",
    future_orientation: q5 === 0 ? "concrete" : q5 === 1 ? "vague" : "open",
  };
}

const OPTS: Record<string, string[]> = {
  q1: ["外に出かけて人と会う", "家でゆっくり自分の時間", "日によって半々くらい"],
  q2: ["自分から話しかける方", "相手が話すのを聞く方", "場の空気を見て決める"],
  q4: ["笑いのツボが合う人", "価値観や考え方が近い人", "自分にない視点をくれる人"],
  q5: ["具体的に考えている", "なんとなく考えている", "まだこれから考えたい"],
};

describe("6問のみ回答時の後方互換(総当たり)", () => {
  it("q1/q2/q4/q5 の全81通りで旧実装と一致する", () => {
    let checked = 0;
    for (const a of [0, 1, 2]) for (const b of [0, 1, 2])
    for (const c of [0, 1, 2]) for (const d of [0, 1, 2]) {
      const idx = { q1: a, q2: b, q4: c, q5: d };
      const answers = (["q1", "q2", "q4", "q5"] as const).map((code) => ({
        questionCode: code,
        kind: "choice" as const,
        options: OPTS[code]!,
        answer: OPTS[code]![idx[code]]!,
      }));
      const got = buildFallbackPersona(answers).traits;
      const want = legacy(idx);
      expect({
        social_energy: got.social_energy,
        conversation_style: got.conversation_style,
        comfort_preference: got.comfort_preference,
        future_orientation: got.future_orientation,
      }).toEqual(want);
      checked++;
    }
    expect(checked).toBe(81);
  });

  it("未回答時も旧実装の既定値と一致する", () => {
    const got = buildFallbackPersona([]).traits;
    expect(got).toMatchObject(legacy({ q1: null, q2: null, q4: null, q5: null }));
  });
});
