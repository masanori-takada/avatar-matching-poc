import { redirect } from "next/navigation";
import { requireInterviewed } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

/**
 * 認証Cookieに依存するため、静的プリレンダリングの対象から外す。
 */
export const dynamic = "force-dynamic";

/**
 * ルートの振り分け(docs/04-api-contract.md §8)。
 */
export default async function RootPage() {
  const profile = await requireInterviewed();

  const supabase = await createClient();
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .or(`profile_a_id.eq.${profile.id},profile_b_id.eq.${profile.id}`);

  if (!count || count === 0) {
    redirect("/waiting");
  }

  redirect("/home");
}
