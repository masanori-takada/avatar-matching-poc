import { z } from "zod";

/**
 * Claude の tool use 出力を検証する Zod スキーマ群(docs/05-ai-pipeline.md §3〜5)。
 */

// -----------------------------------------------------------------------------
// ペルソナ生成 (save_persona)
// -----------------------------------------------------------------------------

export const personaTraitsSchema = z.object({
  social_energy: z.enum(["outgoing", "reserved", "balanced"]),
  conversation_style: z.enum(["initiator", "listener", "adaptive"]),
  values_keywords: z.array(z.string().min(1)).max(5),
  comfort_preference: z.enum(["humor", "shared_values", "new_perspectives"]),
  future_orientation: z.enum(["concrete", "vague", "open"]),
  must_know: z.string().min(1).max(80),
});

export const personaGenerationSchema = z.object({
  summary: z.string().min(80).max(200),
  speaking_style: z.string().min(20).max(80),
  traits: personaTraitsSchema,
});

export type PersonaGenerationOutput = z.infer<typeof personaGenerationSchema>;

export const SAVE_PERSONA_TOOL = {
  name: "save_persona",
  description:
    "インタビュー回答から生成した、その人らしく振る舞うAIアバターの設定を保存する。",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "アバターの自己像。80〜200字の日本語。",
      },
      speaking_style: {
        type: "string",
        description: "口調・テンポ・敬語の度合い。20〜80字の日本語。",
      },
      traits: {
        type: "object",
        properties: {
          social_energy: { type: "string", enum: ["outgoing", "reserved", "balanced"] },
          conversation_style: { type: "string", enum: ["initiator", "listener", "adaptive"] },
          values_keywords: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
            description: "自由記述から抽出したキーワード。最大5語。",
          },
          comfort_preference: {
            type: "string",
            enum: ["humor", "shared_values", "new_perspectives"],
          },
          future_orientation: { type: "string", enum: ["concrete", "vague", "open"] },
          must_know: {
            type: "string",
            description: "相手に知っておいてほしいことの要約。80字以内。",
          },
        },
        required: [
          "social_energy",
          "conversation_style",
          "values_keywords",
          "comfort_preference",
          "future_orientation",
          "must_know",
        ],
      },
    },
    required: ["summary", "speaking_style", "traits"],
  },
} as const;

// -----------------------------------------------------------------------------
// アバター間会話生成 (save_conversation)
// -----------------------------------------------------------------------------

export const conversationTurnSchema = z.object({
  speaker: z.enum(["a", "b"]),
  text: z.string().min(1).max(200),
});

export const conversationGenerationSchema = z.object({
  turns: z.array(conversationTurnSchema).min(1),
  time_label: z.string().min(1).optional(),
});

export type ConversationGenerationOutput = z.infer<typeof conversationGenerationSchema>;

export function buildSaveConversationTool(turnCount: number) {
  return {
    name: "save_conversation",
    description: "2体のAIアバターの深夜の会話ログを保存する。",
    input_schema: {
      type: "object",
      properties: {
        turns: {
          type: "array",
          description: `会話のターン列。Aから始まり、${turnCount}ターン前後で終える。`,
          items: {
            type: "object",
            properties: {
              speaker: { type: "string", enum: ["a", "b"] },
              text: { type: "string", description: "1ターンの発言。40〜120字。" },
            },
            required: ["speaker", "text"],
          },
        },
      },
      required: ["turns"],
    },
  } as const;
}

// -----------------------------------------------------------------------------
// 相性評価 (save_report)
// -----------------------------------------------------------------------------

export const axisKeySchema = z.enum(["flow", "values", "humor", "interest", "conflict"]);

export const reportAxisGenerationSchema = z.object({
  key: axisKeySchema,
  score: z.number(),
  comment: z.string().min(1).max(50),
  quote: z.string().min(1),
});

export const reportGenerationSchema = z.object({
  axes: z.array(reportAxisGenerationSchema).min(5).max(5),
  summary: z.string().min(1).max(400),
});

export type ReportGenerationOutput = z.infer<typeof reportGenerationSchema>;

export const SAVE_REPORT_TOOL = {
  name: "save_report",
  description: "2体のAIアバターの会話ログから算出した相性評価を保存する。",
  input_schema: {
    type: "object",
    properties: {
      axes: {
        type: "array",
        description: "5軸の評価。flow, values, humor, interest, conflict を過不足なく1回ずつ。",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              enum: ["flow", "values", "humor", "interest", "conflict"],
            },
            score: { type: "number", description: "0〜100の整数。" },
            comment: { type: "string", description: "50字以内。断定を避けた観察コメント。" },
            quote: { type: "string", description: "会話ログに実在する発言をそのまま引用する。" },
          },
          required: ["key", "score", "comment", "quote"],
        },
      },
      summary: { type: "string", description: "総評。60〜160字。" },
    },
    required: ["axes", "summary"],
  },
} as const;
