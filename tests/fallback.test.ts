import { describe, expect, it } from "vitest";
import {
  buildFallbackConversation,
  buildFallbackPersona,
  buildFallbackReport,
  type FallbackAnswerInput,
} from "@/lib/ai/fallback";
import { conversationTurnSchema, personaGenerationSchema } from "@/lib/ai/schema";
import { AXIS_DEFINITIONS } from "@/lib/constants";
import type { Persona } from "@/types/domain";

const ANSWERS: FallbackAnswerInput[] = [
  {
    questionCode: "q1",
    kind: "choice",
    options: ["外に出かけて人と会う", "家でゆっくり自分の時間", "日によって半々くらい"],
    answer: "家でゆっくり自分の時間",
  },
  {
    questionCode: "q2",
    kind: "choice",
    options: ["自分から話しかける方", "相手が話すのを聞く方", "場の空気を見て決める"],
    answer: "相手が話すのを聞く方",
  },
  {
    questionCode: "q3",
    kind: "free",
    options: [],
    answer: "短い文章を書くことに夢中になりました。書くことで気持ちが整理されます。",
  },
  {
    questionCode: "q4",
    kind: "choice",
    options: ["笑いのツボが合う人", "価値観や考え方が近い人", "自分にない視点をくれる人"],
    answer: "価値観や考え方が近い人",
  },
  {
    questionCode: "q5",
    kind: "choice",
    options: ["具体的に考えている", "なんとなく考えている", "まだこれから考えたい"],
    answer: "まだこれから考えたい",
  },
  {
    questionCode: "q6",
    kind: "free",
    options: [],
    answer: "文章を書くのが好きです。よろしくお願いします。",
  },
];

const ANSWERS_B: FallbackAnswerInput[] = [
  {
    questionCode: "q1",
    kind: "choice",
    options: ["外に出かけて人と会う", "家でゆっくり自分の時間", "日によって半々くらい"],
    answer: "外に出かけて人と会う",
  },
  {
    questionCode: "q2",
    kind: "choice",
    options: ["自分から話しかける方", "相手が話すのを聞く方", "場の空気を見て決める"],
    answer: "自分から話しかける方",
  },
  {
    questionCode: "q3",
    kind: "free",
    options: [],
    answer: "写真を撮ることに夢中です。残しておきたい気持ちがあります。",
  },
  {
    questionCode: "q4",
    kind: "choice",
    options: ["笑いのツボが合う人", "価値観や考え方が近い人", "自分にない視点をくれる人"],
    answer: "笑いのツボが合う人",
  },
  {
    questionCode: "q5",
    kind: "choice",
    options: ["具体的に考えている", "なんとなく考えている", "まだこれから考えたい"],
    answer: "具体的に考えている",
  },
  {
    questionCode: "q6",
    kind: "free",
    options: [],
    answer: "初対面でも気負わず話したいです。",
  },
];

function toPersona(result: ReturnType<typeof buildFallbackPersona>): Pick<Persona, "traits"> {
  return { traits: result.traits };
}

describe("buildFallbackPersona", () => {
  it("is deterministic for the same input", () => {
    const a = buildFallbackPersona(ANSWERS);
    const b = buildFallbackPersona(ANSWERS);
    expect(a).toEqual(b);
  });

  it("produces schema-valid output", () => {
    const result = buildFallbackPersona(ANSWERS);
    const parsed = personaGenerationSchema.safeParse({
      summary: result.summary,
      speaking_style: result.speakingStyle,
      traits: result.traits,
    });
    expect(parsed.success).toBe(true);
  });

  it("maps choice answers to the documented trait values", () => {
    const result = buildFallbackPersona(ANSWERS);
    expect(result.traits.social_energy).toBe("reserved");
    expect(result.traits.conversation_style).toBe("listener");
    expect(result.traits.comfort_preference).toBe("shared_values");
    expect(result.traits.future_orientation).toBe("open");
  });

  it("falls back to defaults when the question set changes (unknown codes)", () => {
    const unknownCodeAnswers: FallbackAnswerInput[] = ANSWERS.map((a) => ({
      ...a,
      questionCode: `custom_${a.questionCode}`,
    }));
    expect(() => buildFallbackPersona(unknownCodeAnswers)).not.toThrow();
    const result = buildFallbackPersona(unknownCodeAnswers);
    const parsed = personaGenerationSchema.safeParse({
      summary: result.summary,
      speaking_style: result.speakingStyle,
      traits: result.traits,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("buildFallbackConversation", () => {
  it("is deterministic for the same personas", () => {
    const personaA = toPersona(buildFallbackPersona(ANSWERS));
    const personaB = toPersona(buildFallbackPersona(ANSWERS_B));
    const first = buildFallbackConversation(personaA, personaB);
    const second = buildFallbackConversation(personaA, personaB);
    expect(first).toEqual(second);
  });

  it("produces exactly 9 schema-valid turns starting with speaker 'a'", () => {
    const personaA = toPersona(buildFallbackPersona(ANSWERS));
    const personaB = toPersona(buildFallbackPersona(ANSWERS_B));
    const turns = buildFallbackConversation(personaA, personaB);

    expect(turns).toHaveLength(9);
    expect(turns[0]?.speaker).toBe("a");
    for (const turn of turns) {
      expect(conversationTurnSchema.safeParse(turn).success).toBe(true);
    }
  });
});

describe("buildFallbackReport", () => {
  const personaA = toPersona(buildFallbackPersona(ANSWERS));
  const personaB = toPersona(buildFallbackPersona(ANSWERS_B));
  const turns = buildFallbackConversation(personaA, personaB);

  it("is deterministic for the same personas and turns", () => {
    const first = buildFallbackReport(personaA, personaB, turns);
    const second = buildFallbackReport(personaA, personaB, turns);
    expect(first).toEqual(second);
  });

  it("produces exactly 5 axes with the 5 required keys, each with a valid score", () => {
    const result = buildFallbackReport(personaA, personaB, turns);
    expect(result.axes).toHaveLength(5);
    const keys = result.axes.map((a) => a.key).sort();
    expect(keys).toEqual(AXIS_DEFINITIONS.map((d) => d.key).slice().sort());
    for (const axis of result.axes) {
      expect(axis.score).toBeGreaterThanOrEqual(0);
      expect(axis.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(axis.score)).toBe(true);
    }
  });

  it("produces quotes that are substrings of an actual conversation turn", () => {
    const result = buildFallbackReport(personaA, personaB, turns);
    for (const axis of result.axes) {
      const isSubstring = turns.some((t) => t.text.includes(axis.quote));
      expect(isSubstring).toBe(true);
    }
  });

  it("produces a summary within the documented 60-160 character range", () => {
    const result = buildFallbackReport(personaA, personaB, turns);
    expect(result.summary.length).toBeGreaterThanOrEqual(60);
    expect(result.summary.length).toBeLessThanOrEqual(160);
  });
});
