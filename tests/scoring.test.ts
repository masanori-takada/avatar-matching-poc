import { describe, expect, it } from "vitest";
import { AXIS_WEIGHTS, computeOverallScore, normalizeAxes } from "@/lib/matching/scoring";
import { AXIS_DEFINITIONS } from "@/lib/constants";
import type { ConversationTurn, ReportAxis } from "@/types/domain";

function makeAxis(overrides: Partial<ReportAxis> & Pick<ReportAxis, "key">): ReportAxis {
  const def = AXIS_DEFINITIONS.find((d) => d.key === overrides.key);
  if (!def) throw new Error("unknown axis key in test fixture");
  return {
    label: def.label,
    invertedGood: def.invertedGood,
    score: 50,
    comment: "テストコメント",
    quote: "テスト引用",
    ...overrides,
  };
}

describe("AXIS_WEIGHTS", () => {
  it("sums to 1.0", () => {
    const total = Object.values(AXIS_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });
});

describe("computeOverallScore", () => {
  it("inverts the conflict axis (lower conflict score -> higher overall contribution)", () => {
    const baseAxes: ReportAxis[] = [
      makeAxis({ key: "flow", score: 80 }),
      makeAxis({ key: "values", score: 80 }),
      makeAxis({ key: "humor", score: 80 }),
      makeAxis({ key: "interest", score: 80 }),
      makeAxis({ key: "conflict", score: 10 }),
    ];
    const worseConflictAxes: ReportAxis[] = baseAxes.map((axis) =>
      axis.key === "conflict" ? { ...axis, score: 90 } : axis,
    );

    const lowConflictOverall = computeOverallScore(baseAxes);
    const highConflictOverall = computeOverallScore(worseConflictAxes);

    // conflict は低いほど良いため、conflict スコアが高い(悪い)方が総合点は下がる
    expect(lowConflictOverall).toBeGreaterThan(highConflictOverall);
  });

  it("computes the documented weighted sum", () => {
    const axes: ReportAxis[] = [
      makeAxis({ key: "flow", score: 88 }),
      makeAxis({ key: "values", score: 84 }),
      makeAxis({ key: "humor", score: 79 }),
      makeAxis({ key: "interest", score: 86 }),
      makeAxis({ key: "conflict", score: 24 }),
    ];
    // 0.25*88 + 0.30*84 + 0.15*79 + 0.20*86 + 0.10*(100-24)
    const expected = Math.round(0.25 * 88 + 0.3 * 84 + 0.15 * 79 + 0.2 * 86 + 0.1 * (100 - 24));
    expect(computeOverallScore(axes)).toBe(expected);
  });
});

describe("normalizeAxes", () => {
  const turns: ConversationTurn[] = [
    { speaker: "a", text: "こんばんは。休日は家でゆっくり過ごすことが多いみたいです。" },
    { speaker: "b", text: "そうなんですね。私も似ています。" },
  ];

  const fallbackAxes: ReportAxis[] = AXIS_DEFINITIONS.map((def) =>
    makeAxis({ key: def.key, score: 60, quote: turns[0]?.text ?? "" }),
  );

  it("repairs a quote that is not a substring of any turn", () => {
    const rawAxes = AXIS_DEFINITIONS.map((def) => ({
      key: def.key,
      score: 70,
      comment: "コメント",
      quote: "これはどの発言にも含まれない引用です",
    }));

    const result = normalizeAxes(rawAxes, turns, fallbackAxes);

    for (const axis of result) {
      const isSubstring = turns.some((t) => t.text.includes(axis.quote));
      expect(isSubstring).toBe(true);
    }
  });

  it("returns exactly 5 axes with the 5 required keys", () => {
    const rawAxes = [
      { key: "flow" as const, score: 70, comment: "c", quote: turns[0]?.text.slice(0, 5) ?? "" },
    ];
    const result = normalizeAxes(rawAxes, turns, fallbackAxes);
    expect(result).toHaveLength(5);
    const keys = result.map((a) => a.key).sort();
    expect(keys).toEqual(["conflict", "flow", "humor", "interest", "values"]);
  });

  it("clamps out-of-range scores and rounds non-integers", () => {
    const rawAxes = AXIS_DEFINITIONS.map((def) => ({
      key: def.key,
      score: def.key === "flow" ? 150 : def.key === "values" ? -20 : 55.6,
      comment: "c",
      quote: turns[0]?.text.slice(0, 5) ?? "",
    }));
    const result = normalizeAxes(rawAxes, turns, fallbackAxes);
    const byKey = new Map(result.map((a) => [a.key, a.score]));
    expect(byKey.get("flow")).toBe(100);
    expect(byKey.get("values")).toBe(0);
    expect(byKey.get("humor")).toBe(56);
  });
});
