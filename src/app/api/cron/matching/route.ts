import { NextResponse, type NextRequest } from "next/server";
import { runMatchingBatch } from "@/lib/matching/pipeline";

/**
 * マッチングバッチ(docs/04-api-contract.md §7, docs/05-ai-pipeline.md §6)。
 * CRON_SECRET が未設定、または不一致なら常に401を返す。
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runMatchingBatch({});

  return NextResponse.json(result, { status: 200 });
}
