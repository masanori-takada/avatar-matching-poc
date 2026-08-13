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
    // 未知コードは無視されるので、投票が1件も無く既定値になる
    expect(result.traits.social_energy).toBe("balanced");
    expect(result.traits.conversation_style).toBe("adaptive");
    expect(result.traits.comfort_preference).toBe("new_perspectives");
    expect(result.traits.future_orientation).toBe("open");
  });

  it("ignores unknown/extra question codes mixed in with known ones, without throwing", () => {
    const withExtras: FallbackAnswerInput[] = [
      ...ANSWERS,
      { questionCode: "q999", kind: "choice", options: ["x", "y"], answer: "x" },
      { questionCode: "q_typo", kind: "free", options: [], answer: "無視されるはずのテキスト" },
    ];
    expect(() => buildFallbackPersona(withExtras)).not.toThrow();
    const withoutExtras = buildFallbackPersona(ANSWERS);
    const withExtrasResult = buildFallbackPersona(withExtras);
    // 追加の free 回答はキーワード抽出には混ざるが、choice trait には影響しない
    expect(withExtrasResult.traits.social_energy).toBe(withoutExtras.traits.social_energy);
    expect(withExtrasResult.traits.conversation_style).toBe(withoutExtras.traits.conversation_style);
    expect(withExtrasResult.traits.comfort_preference).toBe(withoutExtras.traits.comfort_preference);
    expect(withExtrasResult.traits.future_orientation).toBe(withoutExtras.traits.future_orientation);
  });

  it("only the original 6 questions answered still produce today's exact traits (regression guard)", () => {
    // ANSWERS/ANSWERS_B は q1,q2,q3,q4,q5,q6 のみ。20問構成でも、この6問だけ
    // 回答した場合の traits は多数決導入前とビット単位で同じでなければならない。
    const resultA = buildFallbackPersona(ANSWERS);
    expect(resultA.traits.social_energy).toBe("reserved");
    expect(resultA.traits.conversation_style).toBe("listener");
    expect(resultA.traits.comfort_preference).toBe("shared_values");
    expect(resultA.traits.future_orientation).toBe("open");

    const resultB = buildFallbackPersona(ANSWERS_B);
    expect(resultB.traits.social_energy).toBe("outgoing");
    expect(resultB.traits.conversation_style).toBe("initiator");
    expect(resultB.traits.comfort_preference).toBe("humor");
    expect(resultB.traits.future_orientation).toBe("concrete");
  });

  it("majority vote: 3 of 4 social_energy questions answered outgoing-ish wins outgoing", () => {
    const answers: FallbackAnswerInput[] = [
      {
        questionCode: "q1",
        kind: "choice",
        options: ["外に出かけて人と会う", "家でゆっくり自分の時間", "日によって半々くらい"],
        answer: "外に出かけて人と会う", // outgoing
      },
      {
        questionCode: "q7",
        kind: "choice",
        options: ["もっと人と話したくなる", "ひとりの時間で充電したい", "そのときの気分による"],
        answer: "もっと人と話したくなる", // outgoing
      },
      {
        questionCode: "q11",
        kind: "choice",
        options: ["誰かを誘って出かける", "家でやりたかったことをする", "その日の気分で決める"],
        answer: "誰かを誘って出かける", // outgoing
      },
      {
        questionCode: "q16",
        kind: "choice",
        options: ["うれしくてすぐ乗る", "予定を崩したくない", "内容次第で決める"],
        answer: "予定を崩したくない", // reserved (the odd one out)
      },
    ];
    const result = buildFallbackPersona(answers);
    expect(result.traits.social_energy).toBe("outgoing");
  });

  it("tie-break is deterministic: earliest canonical value wins on a tie", () => {
    // q1 → outgoing, q7 → reserved: 1 vote each, tie.
    // 正準順(outgoing, reserved, balanced)で先に現れる outgoing が勝つ。
    const answers: FallbackAnswerInput[] = [
      {
        questionCode: "q1",
        kind: "choice",
        options: ["外に出かけて人と会う", "家でゆっくり自分の時間", "日によって半々くらい"],
        answer: "外に出かけて人と会う", // outgoing
      },
      {
        questionCode: "q7",
        kind: "choice",
        options: ["もっと人と話したくなる", "ひとりの時間で充電したい", "そのときの気分による"],
        answer: "ひとりの時間で充電したい", // reserved
      },
    ];
    const result = buildFallbackPersona(answers);
    expect(result.traits.social_energy).toBe("outgoing");

    // 逆の並びでも同じ結果になること(投票の到着順ではなく正準順で決まる)を確認
    const reordered = [...answers].reverse();
    const reorderedResult = buildFallbackPersona(reordered);
    expect(reorderedResult.traits.social_energy).toBe("outgoing");
  });

  it("caps values_keywords at 5 entries even with 6 free answers", () => {
    const sixFreeAnswers: FallbackAnswerInput[] = [
      { questionCode: "q3", kind: "free", options: [], answer: "アルファ ベータ ガンマ デルタ" },
      { questionCode: "q10", kind: "free", options: [], answer: "イプシロン ゼータ イータ シータ" },
      { questionCode: "q14", kind: "free", options: [], answer: "アイオタ カッパ ラムダ ミュー" },
      { questionCode: "q18", kind: "free", options: [], answer: "ニュー クサイ オミクロン パイ" },
      { questionCode: "q20", kind: "free", options: [], answer: "ロー シグマ タウ ウプシロン" },
      { questionCode: "q6", kind: "free", options: [], answer: "ファイ カイ プサイ オメガ" },
    ];
    const result = buildFallbackPersona(sixFreeAnswers);
    expect(result.traits.values_keywords.length).toBeLessThanOrEqual(5);
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
