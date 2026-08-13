import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

/**
 * Claude API 共通クライアント(docs/05-ai-pipeline.md §2)。
 */

export const AI_MODELS = {
  persona: process.env.ANTHROPIC_MODEL_CONVERSATION ?? "claude-sonnet-5",
  conversation: process.env.ANTHROPIC_MODEL_CONVERSATION ?? "claude-sonnet-5",
  evaluation: process.env.ANTHROPIC_MODEL_EVALUATION ?? "claude-opus-5",
} as const;

export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
}

export interface GenerateStructuredParams<T> {
  model: string;
  system: string;
  userMessage: string;
  tool: ToolDefinition;
  schema: ZodType<T>;
  maxTokens: number;
  /** 既定 2 */
  maxRetries?: number;
  /** 既定 60000 */
  timeoutMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * tool use で構造化出力を1件取得する。
 * - maxRetries 回まで指数バックオフで再試行(429 / 5xx / スキーマ違反)
 * - 最終的に失敗したら null を返す(例外を投げない)
 */
export async function generateStructured<T>(
  params: GenerateStructuredParams<T>,
): Promise<T | null> {
  if (!isAiEnabled()) {
    return null;
  }

  const { model, system, userMessage, tool, schema, maxTokens } = params;
  const maxRetries = params.maxRetries ?? 2;
  const timeoutMs = params.timeoutMs ?? 60_000;

  const client = getClient();

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: userMessage }],
          tools: [tool],
          tool_choice: { type: "tool", name: tool.name },
        },
        { timeout: timeoutMs },
      );

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      if (!toolUse) {
        throw new Error("tool_use ブロックが見つかりません");
      }

      const parsed = schema.safeParse(toolUse.input);
      if (!parsed.success) {
        throw new Error(`スキーマ検証に失敗しました: ${parsed.error.message}`);
      }

      return parsed.data;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) {
        return null;
      }
      const backoffMs = 500 * 2 ** attempt;
      await sleep(backoffMs);
      // 次の試行へ継続
      void error;
    }
  }

  return null;
}
