"use server";

import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, MatchDecisionValue } from "@/types/domain";

/**
 * マッチへの判断(docs/04-api-contract.md §4)。
 */

export interface DecideMatchInput {
  matchId: string;
  decision: MatchDecisionValue;
}

export async function decideMatch(
  input: DecideMatchInput,
): Promise<ActionResult<{ mutual: boolean }>> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.from("match_decisions").insert({
    match_id: input.matchId,
    profile_id: profile.id,
    decision: input.decision,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "すでに判断済みです" };
    }
    return { ok: false, error: "判断の記録に失敗しました" };
  }

  // decline は matches.status を変更しない(相手から推測可能になるため。NFR-2)
  if (input.decision !== "accept") {
    return { ok: true, data: { mutual: false } };
  }

  const { data: mutual, error: rpcError } = await supabase.rpc("finalize_match_if_mutual", {
    p_match_id: input.matchId,
  });

  if (rpcError) {
    // 判断そのものは記録済みのため、相互成立の確認だけ失敗として扱う
    return { ok: true, data: { mutual: false } };
  }

  return { ok: true, data: { mutual: Boolean(mutual) } };
}
