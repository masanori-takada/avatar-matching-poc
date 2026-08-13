import type {
  AxisKey,
  ComfortPreference,
  ConversationStyle,
  ConversationTurn,
  FutureOrientation,
  Persona,
  PersonaTraits,
  ReportAxis,
  SocialEnergy,
} from "@/types/domain";
import type { InterviewQuestionKind } from "@/types/database";
import { AXIS_DEFINITIONS } from "@/lib/constants";

/**
 * ANTHROPIC_API_KEY 未設定・API失敗時の決定的フォールバック(docs/05-ai-pipeline.md §3〜5, NFR-4)。
 * すべて `model: 'fallback'` として保存する。
 */

export interface FallbackAnswerInput {
  questionCode: string;
  kind: InterviewQuestionKind;
  /** kind='choice' のときのみ非空 */
  options: string[];
  answer: string;
}

export interface FallbackPersonaResult {
  summary: string;
  traits: PersonaTraits;
  speakingStyle: string;
}

// -----------------------------------------------------------------------------
// キーワード抽出(自由記述から)
// -----------------------------------------------------------------------------

const SPLIT_PATTERN =
  /[、。,.\s　はがをにでとやのもへからまでよりですますでしたましたでしょう！？!?・「」『』（）()]+/u;

/**
 * 日本語の助詞・記号で分割し、2字以上の語を頻度順に最大 `limit` 語取る。
 * 頻度が同じ場合は出現順を保つ(決定的)。
 */
export function extractKeywords(texts: readonly string[], limit: number): string[] {
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const text of texts) {
    const tokens = text.split(SPLIT_PATTERN).filter((t) => t.length >= 2);
    for (const token of tokens) {
      if (!counts.has(token)) {
        counts.set(token, 0);
        order.push(token);
      }
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return order
    .slice()
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, limit);
}

// -----------------------------------------------------------------------------
// ペルソナ生成フォールバック
// -----------------------------------------------------------------------------

function choiceIndex(item: FallbackAnswerInput | undefined): number | null {
  if (!item || item.kind !== "choice") return null;
  const idx = item.options.indexOf(item.answer);
  return idx >= 0 ? idx : null;
}

const SOCIAL_ENERGY_TEXT: Record<SocialEnergy, string> = {
  outgoing: "休日は人と会って過ごすことが多く、",
  reserved: "休日は家で自分の時間を大切にする方で、",
  balanced: "休日は状況に応じて人と会ったり一人で過ごしたりする方で、",
};

const CONVERSATION_STYLE_TEXT: Record<ConversationStyle, string> = {
  initiator: "初対面でも自分から話しかけるタイプです。",
  listener: "初対面ではまず相手の話をじっくり聞くタイプです。",
  adaptive: "初対面では場の空気を見ながら振る舞うタイプです。",
};

const COMFORT_PREFERENCE_TEXT: Record<ComfortPreference, string> = {
  humor: "一緒にいて笑いのツボが合う相手といると心地よく感じます。",
  shared_values: "一緒にいて価値観や考え方が近い相手といると心地よく感じます。",
  new_perspectives: "一緒にいて自分にない視点をくれる相手といると心地よく感じます。",
};

const FUTURE_ORIENTATION_TEXT: Record<FutureOrientation, string> = {
  concrete: "将来については具体的に考えているタイプです。",
  vague: "将来についてはなんとなく考えているタイプです。",
  open: "将来についてはまだこれから考えたいタイプです。",
};

const CONVERSATION_STYLE_SPEAKING: Record<ConversationStyle, string> = {
  initiator: "話のテンポは速めで、自分から積極的に話題を広げます。",
  listener: "話のテンポはゆっくりで、相手の言葉を受け止めてから話します。",
  adaptive: "話のテンポは相手に合わせて変化させます。",
};

const SOCIAL_ENERGY_SPEAKING: Record<SocialEnergy, string> = {
  outgoing: "明るく朗らかな敬体で話します。",
  reserved: "落ち着いた静かな敬体で話します。",
  balanced: "穏やかで自然体な敬体で話します。",
};

/**
 * 選択式の回答を、選択肢のインデックスから決定的に traits へ写像する。
 * 設問コードが未知の場合(設問を差し替えたとき)は既定値にフォールバックする
 * (kind だけを見て、choice は無視、free はキーワード抽出に回す)。
 */
export function buildFallbackPersona(answers: readonly FallbackAnswerInput[]): FallbackPersonaResult {
  const byCode = new Map(answers.map((a) => [a.questionCode, a]));

  const q1Index = choiceIndex(byCode.get("q1"));
  const social_energy: SocialEnergy =
    q1Index === 0 ? "outgoing" : q1Index === 1 ? "reserved" : "balanced";

  const q2Index = choiceIndex(byCode.get("q2"));
  const conversation_style: ConversationStyle =
    q2Index === 0 ? "initiator" : q2Index === 1 ? "listener" : "adaptive";

  const q4Index = choiceIndex(byCode.get("q4"));
  const comfort_preference: ComfortPreference =
    q4Index === 0 ? "humor" : q4Index === 1 ? "shared_values" : "new_perspectives";

  const q5Index = choiceIndex(byCode.get("q5"));
  const future_orientation: FutureOrientation =
    q5Index === 0 ? "concrete" : q5Index === 1 ? "vague" : "open";

  const freeAnswers = answers.filter((a) => a.kind === "free" && a.answer.trim() !== "");
  const values_keywords = extractKeywords(
    freeAnswers.map((a) => a.answer),
    5,
  );

  const mustKnowSource = byCode.get("q6") ?? freeAnswers[freeAnswers.length - 1];
  const must_know = (mustKnowSource?.answer ?? "").slice(0, 80);

  const traits: PersonaTraits = {
    social_energy,
    conversation_style,
    values_keywords,
    comfort_preference,
    future_orientation,
    must_know,
  };

  const keywordsClause =
    values_keywords.length > 0 ? `最近は${values_keywords.join("や")}に関心があります。` : "";

  let summary =
    SOCIAL_ENERGY_TEXT[social_energy] +
    CONVERSATION_STYLE_TEXT[conversation_style] +
    COMFORT_PREFERENCE_TEXT[comfort_preference] +
    FUTURE_ORIENTATION_TEXT[future_orientation] +
    keywordsClause;

  if (summary.length > 200) {
    summary = summary.slice(0, 200);
  }
  if (summary.length < 80) {
    summary = summary.padEnd(80, "。");
  }

  let speakingStyle =
    CONVERSATION_STYLE_SPEAKING[conversation_style] + SOCIAL_ENERGY_SPEAKING[social_energy];
  if (speakingStyle.length > 80) {
    speakingStyle = speakingStyle.slice(0, 80);
  }
  if (speakingStyle.length < 20) {
    speakingStyle = speakingStyle.padEnd(20, "。");
  }

  return { summary, traits, speakingStyle };
}

// -----------------------------------------------------------------------------
// アバター間会話フォールバック
// -----------------------------------------------------------------------------

const SOCIAL_ENERGY_INTRO: Record<SocialEnergy, string> = {
  outgoing: "外に出て人と会うのが好きだと聞いています。",
  reserved: "静かに自分の時間を過ごすのが好きだと聞いています。",
  balanced: "その日の気分で過ごし方を変えるタイプだと聞いています。",
};

const SOCIAL_ENERGY_RESPONSE: Record<SocialEnergy, string> = {
  outgoing: "そうなんです、人と会うと元気をもらえるので。",
  reserved: "そうなんです、一人の時間があると落ち着きます。",
  balanced: "そうですね、そのときどきで違うんです。",
};

/**
 * `buildFallbackPersona` と同様、両ペルソナの traits から決定的に9ターンを組み立てる。
 * 必ず `future_orientation` または `comfort_preference`(全一致時は速度差)を相違点として含む。
 */
export function buildFallbackConversation(
  personaA: Pick<Persona, "traits">,
  personaB: Pick<Persona, "traits">,
): ConversationTurn[] {
  const a = personaA.traits;
  const b = personaB.traits;

  const aKeyword = a.values_keywords[0] ?? "最近気になっていること";
  const bKeyword = b.values_keywords[0] ?? "最近気になっていること";

  let differenceA: string;
  let differenceB: string;

  if (a.future_orientation !== b.future_orientation) {
    differenceA = "ただ、うちの人は将来のことについての考え方が、お相手とは少し違うかもしれません。";
    differenceB = "正直、そのあたりは私も本人なりのペースがあると思っています。";
  } else if (a.comfort_preference !== b.comfort_preference) {
    differenceA = "ただ、心地よく感じる相手のタイプは、うちの人とお相手で少し違うようです。";
    differenceB = "そうですね、そこは人によって違って当然だと思います。";
  } else {
    differenceA = "ただ、話すテンポは、うちの人とお相手で少し違うかもしれません。";
    differenceB = "そこは会話を重ねながら、お互いに合わせていけそうです。";
  }

  const turns: ConversationTurn[] = [
    { speaker: "a", text: "こんばんは。夜遅くにすみません。" + SOCIAL_ENERGY_INTRO[b.social_energy] },
    { speaker: "b", text: "こんばんは。" + SOCIAL_ENERGY_RESPONSE[b.social_energy] },
    { speaker: "a", text: `うちの人は最近、${aKeyword}に夢中になっているようです。` },
    { speaker: "b", text: `私の方は${bKeyword}に関心があるみたいです。近いところがありますね。` },
    { speaker: "a", text: COMFORT_PREFERENCE_TEXT[a.comfort_preference] },
    { speaker: "b", text: COMFORT_PREFERENCE_TEXT[b.comfort_preference] },
    { speaker: "a", text: differenceA },
    { speaker: "b", text: differenceB },
    { speaker: "a", text: "話を聞いていて、無理のない範囲で一度話してみるのはよさそうだと感じました。" },
  ];

  return turns;
}

// -----------------------------------------------------------------------------
// 相性評価フォールバック
// -----------------------------------------------------------------------------

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function pickTurnText(turns: readonly ConversationTurn[], preferredIndex: number): string {
  if (turns.length === 0) return "";
  const turn = turns[preferredIndex] ?? turns[turns.length - 1];
  return turn?.text ?? "";
}

function commentForScore(band: "high" | "mid" | "low", axis: AxisKey): string {
  const templates: Record<AxisKey, Record<"high" | "mid" | "low", string>> = {
    flow: {
      high: "会話のテンポが噛み合い、話題が途切れませんでした。",
      mid: "会話は概ね自然に進んでいました。",
      low: "会話のテンポにはややばらつきが見られました。",
    },
    values: {
      high: "大切にしていることの重なりが多く見られました。",
      mid: "価値観には一部共通点が見られました。",
      low: "価値観の重なりは限定的でした。",
    },
    humor: {
      high: "軽さやユーモアの感覚が近いようでした。",
      mid: "ユーモアの相性は対面での確認が必要です。",
      low: "ユーモアの方向性にはやや差がありました。",
    },
    interest: {
      high: "互いに質問を返し合い、関心の高さが見られました。",
      mid: "一定の関心のやり取りが見られました。",
      low: "関心のやり取りはやや控えめでした。",
    },
    conflict: {
      high: "相違点が目立ち、対面での擦り合わせが必要そうです。",
      mid: "小さな温度差はありますが、致命的ではありません。",
      low: "大きな対立点は見られませんでした。",
    },
  };
  return templates[axis][band];
}

function bandFor(axis: AxisKey, score: number): "high" | "mid" | "low" {
  // conflict は低いほど良いため、バンドの意味を反転して選ぶ(コメント文言の自然さのため)
  if (axis === "conflict") {
    if (score >= 50) return "high";
    if (score >= 25) return "mid";
    return "low";
  }
  if (score >= 80) return "high";
  if (score >= 60) return "mid";
  return "low";
}

const SUMMARY_TEMPLATES: Record<"high" | "mid" | "low", string> = {
  high:
    "価値観や生活リズムの重なりが大きく、会話のテンポも自然でした。相違点はありますが、関係を妨げるほどではなさそうです。",
  mid: "共通する部分もありつつ、これから対面ですり合わせていくとよさそうな点も見られました。焦らず様子を見るとよいかもしれません。",
  low: "重なりは限定的でしたが、会話を通じて少しずつ理解を深められそうな余地が見られました。",
};

function clampSummaryLength(text: string): string {
  let result = text;
  if (result.length > 160) {
    result = result.slice(0, 160);
  }
  if (result.length < 60) {
    result = result.padEnd(60, "。");
  }
  return result;
}

/**
 * ペルソナの一致度から決定的にスコアと総評を出す(docs/05-ai-pipeline.md §5)。
 */
export interface FallbackReportResult {
  axes: ReportAxis[];
  summary: string;
}

export function buildFallbackReport(
  personaA: Pick<Persona, "traits">,
  personaB: Pick<Persona, "traits">,
  turns: readonly ConversationTurn[],
): FallbackReportResult {
  const a = personaA.traits;
  const b = personaB.traits;

  // flow: ベース70 + conversation_style の補完性ボーナス
  let flowScore = 70;
  const stylePair = [a.conversation_style, b.conversation_style].sort().join("-");
  if (stylePair === "initiator-listener") {
    flowScore += 15;
  } else if (a.conversation_style === "adaptive" || b.conversation_style === "adaptive") {
    flowScore += 10;
  } else if (a.conversation_style === b.conversation_style) {
    flowScore += 5;
  }

  // values: ベース60 + values_keywords の共通語数 × 8(最大 +30)
  const commonKeywords = a.values_keywords.filter((k) => b.values_keywords.includes(k));
  const valuesScore = 60 + Math.min(30, commonKeywords.length * 8);

  // humor
  const humorScore =
    a.comfort_preference === "humor" && b.comfort_preference === "humor"
      ? 85
      : a.comfort_preference === "humor" || b.comfort_preference === "humor"
        ? 72
        : 65;

  // interest: ベース70 + 各ペルソナの must_know が非空なら +8
  let interestScore = 70;
  if (a.must_know.trim() !== "") interestScore += 8;
  if (b.must_know.trim() !== "") interestScore += 8;

  // conflict: ベース20 + future_orientation 不一致で +20、social_energy が outgoing×reserved で +10
  let conflictScore = 20;
  if (a.future_orientation !== b.future_orientation) conflictScore += 20;
  const energyPair = [a.social_energy, b.social_energy].sort().join("-");
  if (energyPair === "outgoing-reserved") conflictScore += 10;

  const rawScores: Record<AxisKey, number> = {
    flow: flowScore,
    values: valuesScore,
    humor: humorScore,
    interest: interestScore,
    conflict: conflictScore,
  };

  // quote は該当しそうなターンから機械的に選ぶ(固定インデックス、範囲外は最後のターン)
  const quoteIndex: Record<AxisKey, number> = {
    flow: 1,
    values: 3,
    humor: 4,
    interest: 2,
    conflict: 6,
  };

  const axes: ReportAxis[] = AXIS_DEFINITIONS.map((def) => {
    const score = clampScore(rawScores[def.key]);
    const band = bandFor(def.key, score);
    const quoteText = pickTurnText(turns, quoteIndex[def.key]);
    return {
      key: def.key,
      label: def.label,
      score,
      invertedGood: def.invertedGood,
      comment: commentForScore(band, def.key),
      quote: quoteText || "(会話ログがありません)",
    };
  });

  const overall =
    0.25 * (axes.find((x) => x.key === "flow")?.score ?? 0) +
    0.3 * (axes.find((x) => x.key === "values")?.score ?? 0) +
    0.15 * (axes.find((x) => x.key === "humor")?.score ?? 0) +
    0.2 * (axes.find((x) => x.key === "interest")?.score ?? 0) +
    0.1 * (100 - (axes.find((x) => x.key === "conflict")?.score ?? 0));

  const band = overall >= 80 ? "high" : overall >= 60 ? "mid" : "low";
  const summary = clampSummaryLength(SUMMARY_TEMPLATES[band]);

  return { axes, summary };
}
