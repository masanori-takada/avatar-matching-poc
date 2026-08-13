import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase のメールOTPリンクからのコールバック(docs/04-api-contract.md §7)。
 * `next` は先頭が単一の `/` の相対パスのみ許可する(オープンリダイレクト防止)。
 * `//host` や絶対URLは拒否する。
 */
function sanitizeNext(rawNext: string | null): string {
  if (!rawNext) return "/";
  if (!rawNext.startsWith("/")) return "/";
  if (rawNext.startsWith("//")) return "/";
  // `/\evil.com` のようなバックスラッシュ経由の迂回も拒否する
  if (rawNext.startsWith("/\\")) return "/";
  return rawNext;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
