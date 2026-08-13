import { NextResponse, type NextRequest } from "next/server";
import { runMatchingBatch } from "@/lib/matching/pipeline";

/**
 * マッチングバッチ(docs/04-api-contract.md §7, docs/05-ai-pipeline.md §6)。
 * CRON_SECRET が未設定、または不一致なら常に401を返す。
 *
 * GET と POST の両方を受け付ける:
 * - Vercel Cron はスケジュール実行時に **GET** で叩き、`CRON_SECRET` を
 *   環境変数に設定しておくと `Authorization: Bearer <CRON_SECRET>` を
 *   自動的に付与する(https://vercel.com/docs/cron-jobs/manage-cron-jobs)。
 *   GET を実装していないと 405 になり、cron が永久に動かない。
 * - POST は手動実行(curl)や、Vercel 以外のスケジューラ向けに残す。
 */
async function handle(request: NextRequest): Promise<NextResponse> {
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
