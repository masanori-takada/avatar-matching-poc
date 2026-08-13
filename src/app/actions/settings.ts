"use server";

import { redirect } from "next/navigation";
import { requireProfile, requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/types/domain";

/**
 * 設定(docs/04-api-contract.md §6, FR-8.3〜8.4)。
 */

export async function updateNotificationSetting(enabled: boolean): Promise<ActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ notifications_enabled: enabled })
    .eq("id", profile.id);

  if (error) {
    return { ok: false, error: "設定の保存に失敗しました" };
  }

  return { ok: true, data: undefined };
}

/**
 * アカウントと全データの削除。
 *
 * `auth.admin.deleteUser` は service_role キーでのみ呼び出せる管理API のため、
 * ここでの admin クライアント使用はドキュメント上許可された3箇所目
 * (invite.ts / matching/pipeline.ts に次ぐ)。ユーザーは自分自身の requireUser()
 * で認証済みの上で自分の user.id のみを削除対象にしており、他人のアカウントを
 * 操作する経路は存在しない。`profiles` 以下は ON DELETE CASCADE で連鎖削除される。
 */
export async function deleteAccount(): Promise<ActionResult> {
  const user = await requireUser();

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return { ok: false, error: "削除に失敗しました。もう一度お試しください。" };
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect("/login");
}
