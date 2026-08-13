"use server";

import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/domain";

/**
 * 面談候補日時の選択(docs/04-api-contract.md §5, FR-6.4〜6.5)。
 */

export interface SelectSlotInput {
  matchId: string;
  slotId: string;
}

export async function selectSlot(
  input: SelectSlotInput,
): Promise<ActionResult<{ bothSelected: boolean; agreed: boolean }>> {
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS(slot_selections_upsert_self / _update_self)が相互accept成立と
  // 枠がこのマッチに属することを検査する。
  const { error } = await supabase.from("slot_selections").upsert(
    {
      match_id: input.matchId,
      profile_id: profile.id,
      slot_id: input.slotId,
    },
    { onConflict: "match_id,profile_id" },
  );

  if (error) {
    return { ok: false, error: "候補日時の選択に失敗しました" };
  }

  // 相互accept後は RLS が相手の選択も見せる(docs/03-data-model.md §4.3)。
  const { data: rows, error: selectError } = await supabase
    .from("slot_selections")
    .select("profile_id, slot_id")
    .eq("match_id", input.matchId);

  if (selectError || !rows) {
    return { ok: true, data: { bothSelected: false, agreed: false } };
  }

  const bothSelected = rows.length >= 2;
  const agreed = bothSelected && new Set(rows.map((row) => row.slot_id)).size === 1;

  return { ok: true, data: { bothSelected, agreed } };
}
