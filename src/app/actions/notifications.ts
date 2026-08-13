"use server";

import { requireProfile } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/domain";

/**
 * 通知(docs/04-api-contract.md §3)。
 */

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("profile_id", profile.id);

  if (error) {
    return { ok: false, error: "既読にできませんでした" };
  }

  return { ok: true, data: undefined };
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ updated: number }>> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profile.id)
    .is("read_at", null)
    .select("id");

  if (error) {
    return { ok: false, error: "既読にできませんでした" };
  }

  return { ok: true, data: { updated: data?.length ?? 0 } };
}
